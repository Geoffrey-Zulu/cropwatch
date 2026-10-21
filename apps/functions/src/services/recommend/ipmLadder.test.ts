import { describe, it, expect, vi } from 'vitest'
import { RegisteredProductSchema, type Observation } from '@repo/shared'
import { toRecommendationView } from '../observationModel'
import {
  buildRecommendation,
  CHEMICAL_LAST_RESORT,
  lusakaDate,
  OFFICER_REFERRAL,
  recommend,
} from './ipmLadder'
import { knowledgeNotReady, type KnowledgeLayer, type KnowledgeResult } from './knowledge'
import type { FilterResult } from './regulatoryFilter'

const NOW = '2026-10-21T09:31:00.000Z'

const knowledge: KnowledgeResult = {
  sources: [
    {
      id: 'cabi',
      title: 'CABI factsheet',
      tier: 5,
      uri: 'gs://corpus/cabi.pdf',
      chunk_ids: ['c9'],
    },
    { id: 'moa', title: 'MoA FAW manual', tier: 1, uri: 'gs://corpus/moa.pdf', chunk_ids: ['c1'] },
    { id: 'unused', title: 'Uncited', tier: 2, uri: 'gs://corpus/x.pdf', chunk_ids: [] },
  ],
  // Deliberately out of ladder order.
  steps: [
    { rung: 'biological', text: 'Encourage natural enemies.', source_ids: ['cabi'] },
    { rung: 'scout', text: 'Scout 10 plants per station.', source_ids: ['moa'] },
    { rung: 'chemical', text: 'Spray 50 ml of anything per litre.', source_ids: ['moa'] },
    { rung: 'cultural', text: 'Plant early, intercrop.', source_ids: ['moa'] },
    { rung: 'cultural', text: 'An uncited claim.', source_ids: [] },
    { rung: 'cultural', text: 'Cites a source we do not have.', source_ids: ['ghost'] },
  ],
  chemical_candidates: [{ active_ingredient: 'emamectin benzoate', source_ids: ['moa'] }],
}

const product = RegisteredProductSchema.parse({
  registration_no: 'ZM-001',
  trade_name: 'Alpha 5 EC',
  active_ingredient: 'emamectin benzoate',
  registrant: 'Registrant A',
  approved_crops: ['maize'],
  approved_issues: ['fall_armyworm'],
  label_dose: '10 ml / 15 L knapsack',
  phi_days: 14,
  who_class: 'II',
  source: 'label',
  source_doc: 'gs://labels/alpha.pdf',
  expiry: null,
})

const option = {
  registration_no: 'ZM-001',
  trade_name: 'Alpha 5 EC',
  active_ingredient: 'emamectin benzoate',
  label_dose: '10 ml / 15 L knapsack',
  phi_days: 14,
  source_doc: 'gs://labels/alpha.pdf',
}

const build = (filtered: FilterResult = { options: [option], rejected: [] }, result = knowledge) =>
  buildRecommendation({ obsId: 'obs-1', sim: false, now: NOW, knowledge: result, filtered })

describe('buildRecommendation', () => {
  it('orders the ladder scout → cultural → biological → chemical', () => {
    const outcome = build()
    if (outcome.kind !== 'recommendation') throw new Error(outcome.kind)
    expect(outcome.recommendation.ipm_steps).toEqual([
      'Scout 10 plants per station.',
      'Plant early, intercrop.',
      'Encourage natural enemies.',
      CHEMICAL_LAST_RESORT,
    ])
  })

  it('drops uncited steps and never uses retrieved chemical text (doses come from labels)', () => {
    const outcome = build()
    if (outcome.kind !== 'recommendation') throw new Error(outcome.kind)
    const text = outcome.recommendation.ipm_steps.join('\n')
    expect(text).not.toContain('uncited')
    expect(text).not.toContain('source we do not have')
    expect(text).not.toContain('50 ml')
  })

  it('ships IPM-only with the officer referral when no chemical survives', () => {
    const outcome = build({
      options: [],
      rejected: [{ candidate: 'DDT', reason: 'not_registered' }],
    })
    if (outcome.kind !== 'recommendation') throw new Error(outcome.kind)
    const { recommendation } = outcome
    expect(recommendation.chemical_options).toEqual([])
    expect(recommendation.ipm_steps[recommendation.ipm_steps.length - 1]).toBe(OFFICER_REFERRAL)
    expect(recommendation.regulatory_check).toEqual({
      passed: false,
      rejected_products: ['DDT: not_registered'],
    })
    expect(toRecommendationView(recommendation).officer_referral).toBe(true)
  })

  it('cites only sources the steps use, most authoritative first', () => {
    const outcome = build()
    if (outcome.kind !== 'recommendation') throw new Error(outcome.kind)
    expect(outcome.recommendation.rag_sources.map(s => s.title)).toEqual([
      'MoA FAW manual',
      'CABI factsheet',
    ])
  })

  it('refuses to recommend without cited evidence', () => {
    const uncited = { ...knowledge, steps: knowledge.steps.map(s => ({ ...s, source_ids: [] })) }
    expect(build(undefined, uncited)).toEqual({ kind: 'insufficient_evidence' })
  })

  it('carries the observation sim flag', () => {
    const outcome = buildRecommendation({
      obsId: 'obs-1',
      sim: true,
      now: NOW,
      knowledge,
      filtered: { options: [], rejected: [] },
    })
    if (outcome.kind !== 'recommendation') throw new Error(outcome.kind)
    expect(outcome.recommendation.sim).toBe(true)
  })
})

describe('recommend', () => {
  const observation = {
    crop: 'maize',
    district: 'Chipata',
    growth_stage: 'V6',
    verified_issue: null,
    sim: false,
    diagnosis: { suspected_issue: 'fall_armyworm', severity_band: 'moderate' },
  } as unknown as Observation

  const fakeKnowledge = (): KnowledgeLayer => ({ retrieve: vi.fn(async () => knowledge) })

  it('runs knowledge → regulatory filter → ladder, with the registered dose', async () => {
    const layer = fakeKnowledge()
    const outcome = await recommend(
      { knowledge: layer, products: [product] },
      { obsId: 'obs-1', observation, now: NOW }
    )
    expect(layer.retrieve).toHaveBeenCalledWith({
      crop: 'maize',
      issue: 'fall_armyworm',
      growth_stage: 'V6',
      severity_band: 'moderate',
      district: 'Chipata',
    })
    if (outcome.kind !== 'recommendation') throw new Error(outcome.kind)
    expect(outcome.recommendation.chemical_options).toEqual([option])
  })

  it("uses the officer's verified issue over the AI's", async () => {
    const layer = fakeKnowledge()
    await recommend(
      { knowledge: layer, products: [product] },
      {
        obsId: 'obs-1',
        observation: { ...observation, verified_issue: 'maize_lethal_necrosis' },
        now: NOW,
      }
    )
    expect(vi.mocked(layer.retrieve).mock.calls[0][0].issue).toBe('maize_lethal_necrosis')
  })

  it('does not recommend for an unknown issue', async () => {
    const layer = fakeKnowledge()
    const unknown = { ...observation, diagnosis: { suspected_issue: 'unknown' } } as Observation
    expect(
      await recommend(
        { knowledge: layer, products: [] },
        { obsId: 'o', observation: unknown, now: NOW }
      )
    ).toEqual({ kind: 'unknown_issue' })
    expect(layer.retrieve).not.toHaveBeenCalled()
  })

  it('refuses until the D4 knowledge layer exists', async () => {
    await expect(
      recommend(
        { knowledge: knowledgeNotReady, products: [] },
        { obsId: 'o', observation, now: NOW }
      )
    ).rejects.toThrow('D4')
  })
})

describe('lusakaDate', () => {
  it('uses the Zambian calendar day for expiry checks', () => {
    expect(lusakaDate('2026-10-21T21:59:00Z')).toBe('2026-10-21')
    expect(lusakaDate('2026-10-21T22:30:00Z')).toBe('2026-10-22')
  })
})
