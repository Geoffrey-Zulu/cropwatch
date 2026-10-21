import { describe, it, expect } from 'vitest'
import { DiagnosisSchema, DiagnosisModelOutputSchema, requiresExpertReview } from './diagnosis'

const diagnosis = {
  suspected_issue: 'fall_armyworm',
  model_confidence: 0.82,
  confidence_band: 'high',
  severity_pct: 35,
  visible_symptoms: ['window-pane feeding', 'frass in whorl'],
  needs_expert_review: false,
  model_id: 'gemini-test',
  prompt_version: 'diagnose-v0',
}

describe('requiresExpertReview', () => {
  it('flags confidence below 0.6', () => {
    expect(requiresExpertReview({ model_confidence: 0.59, suspected_issue: 'fall_armyworm' })).toBe(
      true
    )
  })

  it('does not flag confidence of exactly 0.6', () => {
    expect(requiresExpertReview({ model_confidence: 0.6, suspected_issue: 'fall_armyworm' })).toBe(
      false
    )
  })

  it('flags an unknown issue regardless of confidence', () => {
    expect(requiresExpertReview({ model_confidence: 0.99, suspected_issue: 'unknown' })).toBe(true)
  })
})

describe('DiagnosisSchema', () => {
  it('accepts a confident, known diagnosis', () => {
    expect(DiagnosisSchema.safeParse(diagnosis).success).toBe(true)
  })

  it('rejects low confidence that is not routed to expert review', () => {
    const result = DiagnosisSchema.safeParse({ ...diagnosis, model_confidence: 0.4 })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown issue that is not routed to expert review', () => {
    const result = DiagnosisSchema.safeParse({ ...diagnosis, suspected_issue: 'unknown' })
    expect(result.success).toBe(false)
  })

  it('accepts low confidence when routed to expert review', () => {
    const result = DiagnosisSchema.safeParse({
      ...diagnosis,
      model_confidence: 0.4,
      confidence_band: 'low',
      needs_expert_review: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects an issue outside the controlled vocabulary', () => {
    const result = DiagnosisSchema.safeParse({ ...diagnosis, suspected_issue: 'locusts' })
    expect(result.success).toBe(false)
  })

  it('rejects model_confidence outside 0–1', () => {
    expect(DiagnosisSchema.safeParse({ ...diagnosis, model_confidence: 82 }).success).toBe(false)
  })
})

describe('DiagnosisModelOutputSchema', () => {
  it('accepts the technicaldoc §6 contract shape', () => {
    const result = DiagnosisModelOutputSchema.safeParse({
      crop: 'maize',
      suspected_issue: 'unknown',
      model_confidence: 0.3,
      severity_pct: 10,
      growth_stage: null,
      visible_symptoms: [],
      // The model may get this wrong; the server re-applies requiresExpertReview().
      needs_expert_review: false,
      reasoning_summary: 'Leaf damage is not characteristic of any listed issue.',
    })
    expect(result.success).toBe(true)
  })
})
