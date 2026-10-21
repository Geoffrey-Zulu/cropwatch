import { describe, it, expect } from 'vitest'
import {
  DiagnosisInternalSchema,
  DiagnosisModelOutputSchema,
  DiagnosisSchema,
  expertReviewReason,
  requiresExpertReview,
} from './diagnosis'

const diagnosis = {
  suspected_issue: 'fall_armyworm',
  confidence_band: 'high',
  severity_band: 'moderate',
  visible_symptoms: ['window-pane feeding', 'frass in whorl'],
  needs_expert_review: false,
  expert_review_reason: null,
  model_id: 'gemini-test',
  prompt_version: 'diagnose-v1',
  diagnosed_at: '2026-10-22T09:30:05Z',
}

describe('expertReviewReason', () => {
  it('flags confidence below 0.6', () => {
    expect(expertReviewReason({ model_confidence: 0.59, suspected_issue: 'fall_armyworm' })).toBe(
      'low_confidence'
    )
  })

  it('does not flag confidence of exactly 0.6', () => {
    expect(expertReviewReason({ model_confidence: 0.6, suspected_issue: 'fall_armyworm' })).toBe(
      null
    )
  })

  it('flags an unknown issue regardless of confidence', () => {
    expect(expertReviewReason({ model_confidence: 0.99, suspected_issue: 'unknown' })).toBe(
      'unknown_issue'
    )
    expect(requiresExpertReview({ model_confidence: 0.99, suspected_issue: 'unknown' })).toBe(true)
  })
})

describe('DiagnosisSchema (public, on the observation document)', () => {
  it('accepts a confident, known diagnosis', () => {
    expect(DiagnosisSchema.safeParse(diagnosis).success).toBe(true)
  })

  it('rejects a low band that is not routed to expert review', () => {
    const result = DiagnosisSchema.safeParse({ ...diagnosis, confidence_band: 'low' })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown issue that is not routed to expert review', () => {
    const result = DiagnosisSchema.safeParse({ ...diagnosis, suspected_issue: 'unknown' })
    expect(result.success).toBe(false)
  })

  it('accepts a low band when routed, with a reason', () => {
    const result = DiagnosisSchema.safeParse({
      ...diagnosis,
      confidence_band: 'low',
      needs_expert_review: true,
      expert_review_reason: 'low_confidence',
    })
    expect(result.success).toBe(true)
  })

  it('keeps the routing flag and the reason in step', () => {
    expect(
      DiagnosisSchema.safeParse({ ...diagnosis, needs_expert_review: true }).success,
      'flag without reason'
    ).toBe(false)
    expect(
      DiagnosisSchema.safeParse({ ...diagnosis, expert_review_reason: 'low_confidence' }).success,
      'reason without flag'
    ).toBe(false)
  })

  it('records unusable model output as unknown with no severity', () => {
    const result = DiagnosisSchema.safeParse({
      ...diagnosis,
      suspected_issue: 'unknown',
      confidence_band: 'low',
      severity_band: null,
      visible_symptoms: [],
      needs_expert_review: true,
      expert_review_reason: 'invalid_model_output',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an issue outside the controlled vocabulary', () => {
    const result = DiagnosisSchema.safeParse({ ...diagnosis, suspected_issue: 'locusts' })
    expect(result.success).toBe(false)
  })

  it('carries no numeric confidence', () => {
    const parsed = DiagnosisSchema.parse({ ...diagnosis, model_confidence: 0.82 })
    expect(parsed).not.toHaveProperty('model_confidence')
  })
})

describe('DiagnosisInternalSchema', () => {
  it('holds the numbers, nullable when the output was unusable', () => {
    const record = {
      model_confidence: null,
      severity_pct: null,
      reasoning_summary: null,
      invalid_output: '{"crop": "maize", "suspected_issue": "locusts"',
      attempts: 2,
      model_id: 'gemini-test',
      prompt_version: 'diagnose-v1',
      created_at: '2026-10-22T09:30:05Z',
    }
    expect(DiagnosisInternalSchema.safeParse(record).success).toBe(true)
    expect(DiagnosisInternalSchema.safeParse({ ...record, model_confidence: 82 }).success).toBe(
      false
    )
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
      // The model may get this wrong; the server re-applies expertReviewReason().
      needs_expert_review: false,
      reasoning_summary: 'Leaf damage is not characteristic of any listed issue.',
    })
    expect(result.success).toBe(true)
  })
})
