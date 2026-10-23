import { describe, expect, it, vi } from 'vitest'
import type {
  KnowledgeDocument,
  KnowledgeIndex,
  Observation,
  RegisteredProduct,
} from '@repo/shared'
import type { GenerateFn } from '../diagnosisModel'
import { parsePrompt } from '../prompt'
import { OFFICER_REFERRAL, recommend } from './ipmLadder'
import type { KnowledgeQuery } from './knowledge'
import {
  checkComposition,
  ragKnowledge,
  relevant,
  retrievalQuery,
  selectExcerpts,
  type RetrievedContext,
} from './ragKnowledge'
import { cachedIndex, parseGcsUri, withRetrieveRetry } from './vertexRag'

const doc = (
  id: string,
  tier: number,
  extra: Partial<KnowledgeDocument> = {}
): KnowledgeDocument => ({
  id,
  title: `Title ${id}`,
  gcs_uri: `gs://crop-watch01-knowledge/knowledge/${id}.pdf`,
  source_url: `https://example.org/${id}`,
  tier,
  source: 'Publisher',
  country: 'ZM',
  crop: ['tomato'],
  issue: ['late_blight'],
  year: 2021,
  licence: null,
  ...extra,
})

const INDEX: KnowledgeIndex = {
  corpus: 'projects/crop-watch01/locations/europe-west4/ragCorpora/123',
  generated_at: '2026-10-23T08:00:00.000Z',
  documents: [
    doc('pw-late-blight-2021', 5),
    doc('moa-tomato-2025', 1, { issue: [] }),
    doc('fao-faw-2018', 4, { crop: ['maize'], issue: ['fall_armyworm'] }),
    doc('research-blight-2019', 6),
  ],
}

const QUERY: KnowledgeQuery = {
  crop: 'tomato',
  issue: 'late_blight',
  growth_stage: 'flowering',
  severity_band: 'moderate',
  district: 'Chongwe',
}

const ctx = (id: string, text: string): RetrievedContext => ({
  sourceUri: `gs://crop-watch01-knowledge/knowledge/${id}.pdf`,
  text,
})

const PROMPT = parsePrompt(`---
version: recommend-test
---

## system
Compose from excerpts.

## user
{{crop}} {{issue}} {{growth_stage}} {{severity}} {{district}}
{{excerpts}}`)

describe('retrieval', () => {
  it('shapes the query from the situation, not a chat question', () => {
    const query = retrievalQuery(QUERY)
    expect(query).toContain('crop=tomato issue=late_blight growth_stage=flowering')
    expect(query).toContain('severity=moderate district=Chongwe')
    expect(query).toContain('IPM-first')
    expect(query).toContain('Late blight on Tomato')
  })

  it('keeps documents about this issue, or general guides to this crop', () => {
    expect(relevant(INDEX.documents[0], QUERY)).toBe(true)
    expect(relevant(INDEX.documents[1], QUERY)).toBe(true)
    expect(relevant(INDEX.documents[2], QUERY)).toBe(false)
    expect(relevant(INDEX.documents[0], { ...QUERY, issue: 'unknown' })).toBe(false)
  })

  it('drops off-topic and unindexed chunks, caps per document, and orders by authority', () => {
    const excerpts = selectExcerpts(
      [
        ctx('research-blight-2019', 'Research finding on blight.'),
        ctx('fao-faw-2018', 'Scout maize whorls.'),
        ctx('pw-late-blight-2021', 'Remove infected leaves.'),
        ctx('pw-late-blight-2021', 'Avoid overhead irrigation.'),
        ctx('pw-late-blight-2021', 'Rotate away from potato.'),
        ctx('pw-late-blight-2021', 'A fourth excerpt from the same guide.'),
        ctx('unknown-doc', 'Not in the index.'),
        ctx('moa-tomato-2025', 'Ministry tomato guidance.'),
        ctx('moa-tomato-2025', 'Ministry tomato guidance.'),
      ],
      INDEX,
      QUERY
    )
    expect(excerpts.map(e => [e.ref, e.document.id, e.text])).toEqual([
      ['S1', 'moa-tomato-2025', 'Ministry tomato guidance.'],
      ['S2', 'pw-late-blight-2021', 'Remove infected leaves.'],
      ['S3', 'pw-late-blight-2021', 'Avoid overhead irrigation.'],
      ['S4', 'pw-late-blight-2021', 'Rotate away from potato.'],
      ['S5', 'research-blight-2019', 'Research finding on blight.'],
    ])
    expect(excerpts[0].chunkId).toMatch(/^[0-9a-f]{12}$/)
  })
})

describe('checkComposition (the model is checked, never trusted)', () => {
  const excerpts = selectExcerpts(
    [
      ctx('moa-tomato-2025', 'Ministry tomato guidance.'),
      ctx('pw-late-blight-2021', 'Remove infected leaves.'),
    ],
    INDEX,
    QUERY
  )

  it('keeps cited steps and maps excerpt refs to documents and chunks', () => {
    const { result, dropped } = checkComposition(
      {
        steps: [
          {
            rung: 'scout',
            text: 'Check leaves twice a week for dark, water-soaked patches.',
            source_refs: ['S2'],
          },
          {
            rung: 'cultural',
            text: 'Remove and destroy infected leaves  and fruit.',
            source_refs: ['S1', 'S2', 'S9'],
          },
        ],
        chemical_candidates: [
          { active_ingredient: 'Mancozeb', source_refs: ['S2'] },
          { active_ingredient: 'mancozeb', source_refs: ['S2'] },
          { active_ingredient: 'Invented', source_refs: ['S7'] },
        ],
      },
      excerpts
    )
    expect(dropped).toEqual([])
    expect(result.steps).toEqual([
      {
        rung: 'scout',
        text: 'Check leaves twice a week for dark, water-soaked patches.',
        source_ids: ['pw-late-blight-2021'],
      },
      {
        rung: 'cultural',
        text: 'Remove and destroy infected leaves and fruit.',
        source_ids: ['moa-tomato-2025', 'pw-late-blight-2021'],
      },
    ])
    expect(result.chemical_candidates).toEqual([
      { active_ingredient: 'Mancozeb', source_ids: ['pw-late-blight-2021'] },
    ])
    expect(result.sources.map(s => [s.id, s.tier, s.uri, s.chunk_ids.length])).toEqual([
      ['pw-late-blight-2021', 5, 'https://example.org/pw-late-blight-2021', 1],
      ['moa-tomato-2025', 1, 'https://example.org/moa-tomato-2025', 1],
    ])
  })

  it.each([
    ['no valid citation', 'Remove infected leaves.', ['S9']],
    ['dose or interval in step text', 'Spray neem extract at 50 ml per 20 litres.', ['S1']],
    ['dose or interval in step text', 'Observe the PHI of 7 days.', ['S1']],
    ['pesticide named in step text', 'Spray copper oxychloride when spots appear.', ['S1']],
    ['pesticide named in step text', 'Apply a fungicide preventively.', ['S1']],
    ['pesticide named in step text', 'Use Bt products on young larvae.', ['S1']],
  ])('drops a step with %s', (reason, text, refs) => {
    const { result, dropped } = checkComposition(
      { steps: [{ rung: 'biological', text, source_refs: refs }], chemical_candidates: [] },
      excerpts
    )
    expect(result.steps).toEqual([])
    expect(dropped).toEqual([{ text, reason }])
  })

  it('ignores a chemical rung and malformed replies', () => {
    expect(
      checkComposition({ steps: [{ rung: 'chemical', text: 'x', source_refs: ['S1'] }] }, excerpts)
        .result.steps
    ).toEqual([])
    expect(checkComposition('nonsense', excerpts).result).toEqual({
      steps: [],
      chemical_candidates: [],
      sources: [],
    })
  })
})

describe('ragKnowledge', () => {
  const reply = (body: unknown): GenerateFn =>
    vi.fn(async () => ({ text: JSON.stringify(body), modelVersion: 'gemini-2.5-flash-001' }))
  const layer = (compose: GenerateFn, contexts: RetrievedContext[]) =>
    ragKnowledge({
      loadIndex: async () => INDEX,
      retrieve: async () => contexts,
      compose,
      prompt: PROMPT,
      modelId: 'gemini-2.5-flash',
    })

  it('composes cited steps and records how', async () => {
    const compose = reply({
      steps: [{ rung: 'cultural', text: 'Remove infected leaves.', source_refs: ['S1'] }],
      chemical_candidates: [],
    })
    const result = await layer(compose, [
      ctx('pw-late-blight-2021', 'Remove infected leaves.'),
    ]).retrieve(QUERY)
    expect(result.steps).toHaveLength(1)
    expect(result.trace).toMatchObject({
      retrieved: 1,
      model_id: 'gemini-2.5-flash-001',
      prompt_version: 'recommend-test',
      excerpts: [{ ref: 'S1', document_id: 'pw-late-blight-2021', tier: 5 }],
    })
    const request = vi.mocked(compose).mock.calls[0][0]
    expect(request.user).toContain('[S1] tier 5 · Publisher · Title pw-late-blight-2021 (2021)')
    expect(request.photos).toEqual([])
  })

  it('does not call the model when nothing relevant was retrieved', async () => {
    const compose = reply({})
    const result = await layer(compose, [ctx('fao-faw-2018', 'Scout maize whorls.')]).retrieve(
      QUERY
    )
    expect(result.steps).toEqual([])
    expect(compose).not.toHaveBeenCalled()
  })

  it('retries one unusable reply, then gives up with no steps', async () => {
    const compose = vi.fn(async () => ({ text: 'not json', modelVersion: null }))
    const result = await layer(compose, [
      ctx('pw-late-blight-2021', 'Remove infected leaves.'),
    ]).retrieve(QUERY)
    expect(compose).toHaveBeenCalledTimes(2)
    expect(result.steps).toEqual([])
  })

  it('no citations means no recommendation: officer referral instead (buildplan §4.3)', async () => {
    const observation = {
      crop: 'tomato',
      growth_stage: null,
      district: 'Chongwe',
      verified_issue: null,
      diagnosis: { suspected_issue: 'late_blight', severity_band: 'moderate' },
      sim: false,
    } as unknown as Observation
    const outcome = await recommend(
      {
        knowledge: layer(reply({ steps: [], chemical_candidates: [] }), [
          ctx('pw-late-blight-2021', 'x'),
        ]),
        products: [],
      },
      { obsId: 'obs1', observation, now: '2026-10-23T09:00:00.000Z' }
    )
    expect(outcome.kind).toBe('insufficient_evidence')
  })

  it('model-named chemicals pass the regulatory filter or are dropped; placeholders stay gated', async () => {
    const placeholder = {
      registration_no: 'PLACEHOLDER-001',
      trade_name: 'Demo Mancozeb 80WP',
      active_ingredient: 'mancozeb',
      registrant: 'Demo',
      approved_crops: ['tomato'],
      approved_issues: ['late_blight'],
      label_dose: '2.5 kg/ha (placeholder)',
      phi_days: 7,
      who_class: 'U',
      source: 'placeholder',
      source_doc: 'tools/regulatory/placeholder-products.csv',
      expiry: null,
    } as RegisteredProduct
    const observation = {
      crop: 'tomato',
      growth_stage: null,
      district: 'Chongwe',
      verified_issue: null,
      diagnosis: { suspected_issue: 'late_blight', severity_band: 'moderate' },
      sim: false,
    } as unknown as Observation
    const knowledge = layer(
      reply({
        steps: [{ rung: 'cultural', text: 'Remove infected leaves.', source_refs: ['S1'] }],
        chemical_candidates: [{ active_ingredient: 'mancozeb', source_refs: ['S1'] }],
      }),
      [ctx('pw-late-blight-2021', 'Remove infected leaves. Mancozeb is effective.')]
    )
    const outcome = await recommend(
      { knowledge, products: [placeholder] },
      { obsId: 'obs1', observation, now: '2026-10-23T09:00:00.000Z' }
    )
    if (outcome.kind !== 'recommendation') throw new Error(outcome.kind)
    expect(outcome.recommendation.chemical_options).toEqual([])
    expect(outcome.recommendation.ipm_steps[outcome.recommendation.ipm_steps.length - 1]).toBe(
      OFFICER_REFERRAL
    )
    expect(outcome.recommendation.rag_sources).toHaveLength(1)
    expect(outcome.rejected).toEqual([{ candidate: 'mancozeb', reason: 'placeholder' }])
  })
})

describe('withRetrieveRetry', () => {
  it('waits out embedding-quota 429s, and gives up on other errors', async () => {
    const quota = Object.assign(new Error('Quota exceeded'), { response: { status: 429 } })
    const retrieve = vi.fn().mockRejectedValueOnce(quota).mockResolvedValueOnce([])
    const waits: number[] = []
    const retried = withRetrieveRetry(retrieve, { sleep: async ms => void waits.push(ms) })
    expect(await retried('c', 'q', 5)).toEqual([])
    expect(waits).toEqual([4000])

    const denied = Object.assign(new Error('Permission denied'), { response: { status: 403 } })
    const failing = withRetrieveRetry(vi.fn().mockRejectedValue(denied), { sleep: async () => {} })
    await expect(failing('c', 'q', 5)).rejects.toThrow('Permission denied')
  })
})

describe('knowledge index', () => {
  it('re-reads after its TTL and keeps the last good index if a reload fails', async () => {
    let clock = 0
    const read = vi
      .fn()
      .mockResolvedValueOnce(Buffer.from(JSON.stringify(INDEX)))
      .mockRejectedValueOnce(new Error('storage down'))
    const load = cachedIndex(read, () => clock)
    expect((await load()).corpus).toBe(INDEX.corpus)
    clock = 5 * 60_000
    await load()
    expect(read).toHaveBeenCalledTimes(1)
    clock = 11 * 60_000
    expect((await load()).corpus).toBe(INDEX.corpus)
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('parses gs:// URIs', () => {
    expect(parseGcsUri('gs://crop-watch01-knowledge/index.json')).toEqual({
      bucket: 'crop-watch01-knowledge',
      object: 'index.json',
    })
    expect(() => parseGcsUri('https://x')).toThrow()
  })
})
