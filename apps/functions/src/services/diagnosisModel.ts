import {
  CROPS,
  ISSUE_LABELS,
  ISSUES,
  confidenceBand,
  DiagnosisInternalSchema,
  DiagnosisModelOutputSchema,
  DiagnosisSchema,
  expertReviewReason,
  severityBand,
  type Crop,
  type Diagnosis,
  type DiagnosisInternal,
  type DiagnosisModelOutput,
  type ObservationStatus,
  type VerificationState,
} from '@repo/shared'
import { render, type Prompt } from './prompt'

// Handed to Gemini as responseJsonSchema: the technicaldoc §6 contract, with enums from the
// controlled vocabularies so only known slugs can come back. Key order is generation order,
// so the model describes symptoms before naming an issue.
export const DIAGNOSIS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    crop: { type: 'string', enum: [...CROPS] },
    visible_symptoms: { type: 'array', items: { type: 'string' } },
    suspected_issue: { type: 'string', enum: [...ISSUES] },
    model_confidence: { type: 'number', minimum: 0, maximum: 1 },
    severity_pct: { type: 'number', minimum: 0, maximum: 100 },
    growth_stage: { type: ['string', 'null'] },
    needs_expert_review: { type: 'boolean' },
    reasoning_summary: { type: 'string' },
  },
  required: [
    'crop',
    'visible_symptoms',
    'suspected_issue',
    'model_confidence',
    'severity_pct',
    'growth_stage',
    'needs_expert_review',
    'reasoning_summary',
  ],
} as const

export interface Photo {
  mimeType: 'image/jpeg'
  // base64
  data: string
}

// What the farmer reported. Location is district-level only: precise coordinates never go to
// the model (technicaldoc §6).
export interface DiagnosisContext {
  crop: Crop
  district: string
  province: string
  planting_date: string | null
  growth_stage: string | null
  farmer_description: string | null
}

export interface ModelRequest {
  system: string
  user: string
  photos: Photo[]
}

export interface ModelReply {
  text: string
  modelVersion: string | null
}

export type GenerateFn = (request: ModelRequest) => Promise<ModelReply>

const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504])

// Quota (429) and server errors are the service's problem, not the model's: retry them with
// backoff before they count as an unusable reply. Vertex's shared quota returns 429 under
// bursts, which would otherwise route a perfectly good photo to expert review.
export function isTransient(error: unknown) {
  const status = (error as { status?: unknown } | null)?.status
  if (typeof status === 'number') return TRANSIENT_STATUS.has(status)
  const message = error instanceof Error ? error.message : String(error)
  return /RESOURCE_EXHAUSTED|UNAVAILABLE|DEADLINE_EXCEEDED|fetch failed|ECONNRESET|ETIMEDOUT/.test(
    message
  )
}

export function withTransientRetry(
  generate: GenerateFn,
  {
    retries = 3,
    baseDelayMs = 1000,
    sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
  } = {}
): GenerateFn {
  return async request => {
    for (let retry = 0; ; retry++) {
      try {
        return await generate(request)
      } catch (error) {
        if (retry >= retries || !isTransient(error)) throw error
        // 1 s, 2 s, 4 s, with jitter so concurrent requests don't retry in lockstep.
        await sleep(baseDelayMs * 2 ** retry * (0.75 + Math.random() / 2))
      }
    }
  }
}

export function buildModelRequest(
  prompt: Prompt,
  context: DiagnosisContext,
  photos: Photo[]
): ModelRequest {
  const notGiven = (value: string | null) => value ?? 'not given'
  return {
    system: render(prompt.system, {
      issues: ISSUES.map(slug => `- ${slug}: ${ISSUE_LABELS[slug]}`).join('\n'),
      crops: CROPS.join(', '),
    }),
    user: render(prompt.user, {
      crop: context.crop,
      district: context.district,
      province: context.province,
      planting_date: notGiven(context.planting_date),
      growth_stage: notGiven(context.growth_stage),
      farmer_description: notGiven(context.farmer_description),
    }),
    photos,
  }
}

export interface DiagnosisRun {
  output: DiagnosisModelOutput | null
  attempts: number
  // The last unusable reply (or call error), kept for prompt tuning even if a retry succeeded.
  invalidOutput: string | null
  modelId: string
}

const MAX_INVALID_OUTPUT = 20000

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

// One retry on an unusable reply (bad JSON, schema mismatch, or a failed call), then stop and
// let the caller route to expert review. Model failures never throw.
export async function runDiagnosis(
  generate: GenerateFn,
  request: ModelRequest,
  { maxAttempts = 2, modelId }: { maxAttempts?: number; modelId: string }
): Promise<DiagnosisRun> {
  let invalidOutput: string | null = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let text: string
    try {
      const reply = await generate(request)
      modelId = reply.modelVersion || modelId
      text = reply.text
    } catch (error) {
      text = `call failed: ${error instanceof Error ? error.message : String(error)}`
    }
    const parsed = DiagnosisModelOutputSchema.safeParse(parseJson(text))
    if (parsed.success) return { output: parsed.data, attempts: attempt, invalidOutput, modelId }
    invalidOutput = text.slice(0, MAX_INVALID_OUTPUT)
  }
  return { output: null, attempts: maxAttempts, invalidOutput, modelId }
}

export interface DiagnosisRecords {
  // observations/{id}.diagnosis: bands only.
  diagnosis: Diagnosis
  // observations/{id}/internal/diagnosis: the numbers.
  internal: DiagnosisInternal
  status: ObservationStatus
  verificationState: VerificationState
}

// Applies the routing rule server-side (the model's own needs_expert_review is ignored) and
// splits the result into the public bands and the internal numbers. Both are re-validated, so
// a routing bug fails loudly instead of being stored.
export function diagnosisRecords(
  run: DiagnosisRun,
  promptVersion: string,
  now: string
): DiagnosisRecords {
  const { output } = run
  const reason = output ? expertReviewReason(output) : 'invalid_model_output'
  const stamp = { model_id: run.modelId, prompt_version: promptVersion }

  const diagnosis = DiagnosisSchema.parse({
    suspected_issue: output?.suspected_issue ?? 'unknown',
    confidence_band: output ? confidenceBand(output.model_confidence) : 'low',
    severity_band: output ? severityBand(output.severity_pct) : null,
    visible_symptoms: output?.visible_symptoms ?? [],
    needs_expert_review: reason !== null,
    expert_review_reason: reason,
    ...stamp,
    diagnosed_at: now,
  })

  const internal = DiagnosisInternalSchema.parse({
    model_confidence: output?.model_confidence ?? null,
    severity_pct: output?.severity_pct ?? null,
    reasoning_summary: output?.reasoning_summary ?? null,
    model_crop: output?.crop ?? null,
    model_growth_stage: output?.growth_stage ?? null,
    invalid_output: run.invalidOutput,
    attempts: run.attempts,
    ...stamp,
    created_at: now,
  })

  return {
    diagnosis,
    internal,
    status: reason ? 'awaiting_expert_review' : 'recommending',
    verificationState: reason ? 'UNVERIFIED' : 'AI_ASSESSED',
  }
}
