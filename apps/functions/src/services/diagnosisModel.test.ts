import { describe, it, expect, vi } from 'vitest'
import { CROPS, DiagnosisModelOutputSchema, ISSUES } from '@repo/shared'
import {
  buildModelRequest,
  DIAGNOSIS_RESPONSE_SCHEMA,
  diagnosisRecords,
  isTransient,
  runDiagnosis,
  withTransientRetry,
  type GenerateFn,
} from './diagnosisModel'
import { loadPrompt } from './prompt'

const valid = {
  crop: 'maize',
  visible_symptoms: ['ragged holes in whorl leaves', 'sawdust-like frass'],
  suspected_issue: 'fall_armyworm',
  model_confidence: 0.86,
  severity_pct: 30,
  growth_stage: 'V6',
  needs_expert_review: false,
  reasoning_summary: 'Whorl feeding with frass is characteristic of fall armyworm.',
}

const reply = (body: unknown) => ({
  text: typeof body === 'string' ? body : JSON.stringify(body),
  modelVersion: 'gemini-2.5-flash',
})

const request = { system: 's', user: 'u', photos: [] }
const NOW = '2026-10-22T09:30:05.000Z'

describe('DIAGNOSIS_RESPONSE_SCHEMA', () => {
  it('asks for exactly the technicaldoc §6 fields', () => {
    expect(Object.keys(DIAGNOSIS_RESPONSE_SCHEMA.properties).sort()).toEqual(
      Object.keys(DiagnosisModelOutputSchema.shape).sort()
    )
    expect([...DIAGNOSIS_RESPONSE_SCHEMA.required].sort()).toEqual(
      Object.keys(DiagnosisModelOutputSchema.shape).sort()
    )
  })

  it('constrains crop and issue to the controlled vocabularies', () => {
    expect(DIAGNOSIS_RESPONSE_SCHEMA.properties.crop.enum).toEqual([...CROPS])
    expect(DIAGNOSIS_RESPONSE_SCHEMA.properties.suspected_issue.enum).toEqual([...ISSUES])
  })
})

describe('runDiagnosis', () => {
  it('returns the first valid reply', async () => {
    const generate = vi.fn<GenerateFn>().mockResolvedValue(reply(valid))
    const run = await runDiagnosis(generate, request, { modelId: 'fallback' })
    expect(run).toMatchObject({ attempts: 1, invalidOutput: null, modelId: 'gemini-2.5-flash' })
    expect(run.output?.suspected_issue).toBe('fall_armyworm')
  })

  it('retries once after invalid JSON and keeps the bad reply for tuning', async () => {
    const generate = vi
      .fn<GenerateFn>()
      .mockResolvedValueOnce(reply('{"crop": "maize", "suspected_'))
      .mockResolvedValueOnce(reply(valid))
    const run = await runDiagnosis(generate, request, { modelId: 'fallback' })
    expect(generate).toHaveBeenCalledTimes(2)
    expect(run.attempts).toBe(2)
    expect(run.output).not.toBeNull()
    expect(run.invalidOutput).toBe('{"crop": "maize", "suspected_')
  })

  it('treats a schema mismatch (issue outside the vocabulary) as invalid', async () => {
    const generate = vi
      .fn<GenerateFn>()
      .mockResolvedValue(reply({ ...valid, suspected_issue: 'locusts' }))
    const run = await runDiagnosis(generate, request, { modelId: 'fallback' })
    expect(generate).toHaveBeenCalledTimes(2)
    expect(run.output).toBeNull()
  })

  it('gives up after two invalid replies without throwing', async () => {
    const generate = vi.fn<GenerateFn>().mockResolvedValue(reply('not json at all'))
    const run = await runDiagnosis(generate, request, { modelId: 'fallback' })
    expect(run).toMatchObject({ output: null, attempts: 2, invalidOutput: 'not json at all' })
  })

  it('survives failing calls (timeouts, 5xx) the same way', async () => {
    const generate = vi.fn<GenerateFn>().mockRejectedValue(new Error('DEADLINE_EXCEEDED'))
    const run = await runDiagnosis(generate, request, { modelId: 'gemini-2.5-flash' })
    expect(run).toMatchObject({ output: null, attempts: 2, modelId: 'gemini-2.5-flash' })
    expect(run.invalidOutput).toContain('DEADLINE_EXCEEDED')
  })
})

describe('diagnosisRecords', () => {
  const run = (output: typeof valid | null, extra = {}) => ({
    output: output ? DiagnosisModelOutputSchema.parse(output) : null,
    attempts: 1,
    invalidOutput: null,
    modelId: 'gemini-2.5-flash',
    ...extra,
  })

  it('accepts a confident known diagnosis as AI_ASSESSED, bands only in public', () => {
    const records = diagnosisRecords(run(valid), 'diagnose-v1', NOW)
    expect(records.status).toBe('recommending')
    expect(records.verificationState).toBe('AI_ASSESSED')
    expect(records.diagnosis).toMatchObject({
      suspected_issue: 'fall_armyworm',
      confidence_band: 'high',
      severity_band: 'moderate',
      needs_expert_review: false,
      expert_review_reason: null,
      model_id: 'gemini-2.5-flash',
      prompt_version: 'diagnose-v1',
    })
    expect(records.diagnosis).not.toHaveProperty('model_confidence')
    expect(records.diagnosis).not.toHaveProperty('severity_pct')
    expect(records.internal).toMatchObject({ model_confidence: 0.86, severity_pct: 30 })
  })

  it('routes low confidence to expert review even when the model says it is fine', () => {
    const records = diagnosisRecords(
      run({ ...valid, model_confidence: 0.45, needs_expert_review: false }),
      'diagnose-v1',
      NOW
    )
    expect(records.status).toBe('awaiting_expert_review')
    expect(records.verificationState).toBe('UNVERIFIED')
    expect(records.diagnosis).toMatchObject({
      confidence_band: 'low',
      needs_expert_review: true,
      expert_review_reason: 'low_confidence',
    })
  })

  it('routes unknown to expert review regardless of confidence', () => {
    const records = diagnosisRecords(
      run({ ...valid, suspected_issue: 'unknown', model_confidence: 0.95 }),
      'diagnose-v1',
      NOW
    )
    expect(records.diagnosis.expert_review_reason).toBe('unknown_issue')
    expect(records.verificationState).toBe('UNVERIFIED')
  })

  it('records unusable output as unknown with no numbers, routed to experts', () => {
    const records = diagnosisRecords(
      run(null, { attempts: 2, invalidOutput: 'not json' }),
      'diagnose-v1',
      NOW
    )
    expect(records.status).toBe('awaiting_expert_review')
    expect(records.diagnosis).toMatchObject({
      suspected_issue: 'unknown',
      confidence_band: 'low',
      severity_band: null,
      expert_review_reason: 'invalid_model_output',
    })
    expect(records.internal).toMatchObject({
      model_confidence: null,
      severity_pct: null,
      invalid_output: 'not json',
      attempts: 2,
    })
  })
})

describe('buildModelRequest', () => {
  const prompt = loadPrompt('diagnose-v1')

  it('fills every placeholder and lists every issue slug', () => {
    const built = buildModelRequest(
      prompt,
      {
        crop: 'maize',
        district: 'Chipata',
        province: 'Eastern',
        planting_date: null,
        growth_stage: null,
        farmer_description: 'holes in the leaves',
      },
      []
    )
    expect(built.system + built.user).not.toMatch(/\{\{|\}\}/)
    for (const issue of ISSUES) expect(built.system).toContain(issue)
    expect(built.user).toContain('Chipata district, Eastern Province')
    expect(built.user).toContain('Planting date: not given')
  })

  it('never sends coordinates', () => {
    expect(prompt.user).not.toMatch(/latitude|longitude|location\.|geohash/i)
  })
})

describe('withTransientRetry', () => {
  const quota = Object.assign(new Error('Resource exhausted'), { status: 429 })
  const noSleep = { sleep: async () => {} }

  it('retries quota and server errors, then succeeds', async () => {
    const generate = vi
      .fn<GenerateFn>()
      .mockRejectedValueOnce(quota)
      .mockRejectedValueOnce(Object.assign(new Error('unavailable'), { status: 503 }))
      .mockResolvedValueOnce(reply(valid))
    const result = await withTransientRetry(generate, noSleep)(request)
    expect(generate).toHaveBeenCalledTimes(3)
    expect(result.text).toContain('fall_armyworm')
  })

  it('gives up after the retry budget and rethrows', async () => {
    const generate = vi.fn<GenerateFn>().mockRejectedValue(quota)
    await expect(withTransientRetry(generate, { retries: 2, ...noSleep })(request)).rejects.toBe(
      quota
    )
    expect(generate).toHaveBeenCalledTimes(3)
  })

  it('does not retry client errors such as a bad request', async () => {
    const badRequest = Object.assign(new Error('invalid argument'), { status: 400 })
    const generate = vi.fn<GenerateFn>().mockRejectedValue(badRequest)
    await expect(withTransientRetry(generate, noSleep)(request)).rejects.toBe(badRequest)
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('backs off exponentially', async () => {
    const delays: number[] = []
    const generate = vi.fn<GenerateFn>().mockRejectedValue(quota)
    await withTransientRetry(generate, {
      retries: 3,
      baseDelayMs: 1000,
      sleep: async ms => void delays.push(ms),
    })(request).catch(() => {})
    expect(delays).toHaveLength(3)
    expect(delays[0]).toBeGreaterThanOrEqual(750)
    expect(delays[2]).toBeGreaterThanOrEqual(3000)
  })

  it('recognises transient errors without a status', () => {
    expect(isTransient(new Error('8 RESOURCE_EXHAUSTED: quota'))).toBe(true)
    expect(isTransient(new TypeError('fetch failed'))).toBe(true)
    expect(isTransient(new Error('schema mismatch'))).toBe(false)
  })
})
