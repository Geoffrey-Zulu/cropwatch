import { describe, it, expect } from 'vitest'
import {
  OBSERVATION_ROW_BIGQUERY_SCHEMA,
  ObservationRowSchema,
  toObservationRow,
} from './analytics'
import { ObservationSchema } from './observation'

const observation = ObservationSchema.parse({
  reporter_id: 'uid-123',
  reporter_role: 'farmer',
  org_id: 'demo-outgrower',
  created_at: '2026-10-21T09:30:00.000Z',
  location: { latitude: -13.63, longitude: 32.65 },
  geohash: 'kv8mqs',
  district: 'Chipata',
  district_slug: 'chipata',
  province: 'Eastern',
  camp: null,
  crop: 'maize',
  planting_date: null,
  growth_stage: 'V6',
  photo_paths: [],
  farmer_description: null,
  status: 'recommending',
  diagnosis: {
    suspected_issue: 'fall_armyworm',
    confidence_band: 'high',
    severity_band: 'moderate',
    visible_symptoms: [],
    needs_expert_review: false,
    expert_review_reason: null,
    model_id: 'gemini-2.5-flash',
    prompt_version: 'diagnose-v1',
    diagnosed_at: '2026-10-21T09:30:08.000Z',
  },
  verification_state: 'FIELD_VERIFIED',
  verified_by: 'officer-1',
  verified_issue: 'fall_armyworm',
  recommendation_id: null,
  intervention: null,
  outcome: null,
  sim: true,
})

const internal = {
  model_confidence: 0.86,
  severity_pct: 30,
  reasoning_summary: null,
  model_crop: 'maize' as const,
  model_growth_stage: 'V6',
  invalid_output: null,
  attempts: 1,
  model_id: 'gemini-2.5-flash',
  prompt_version: 'diagnose-v1',
  created_at: '2026-10-21T09:30:08.000Z',
}

describe('OBSERVATION_ROW_BIGQUERY_SCHEMA', () => {
  it('has exactly the row schema fields, with matching nullability', () => {
    const shape = ObservationRowSchema.shape
    expect(OBSERVATION_ROW_BIGQUERY_SCHEMA.map(f => f.name).sort()).toEqual(
      Object.keys(shape).sort()
    )
    for (const field of OBSERVATION_ROW_BIGQUERY_SCHEMA) {
      expect(field.mode === 'NULLABLE', field.name).toBe(shape[field.name].isNullable())
    }
  })
})

describe('toObservationRow', () => {
  it('flattens the observation and carries the internal numbers', () => {
    const row = toObservationRow('obs-1', observation, internal)
    expect(row).toMatchObject({
      obs_id: 'obs-1',
      geo: 'POINT(32.65 -13.63)',
      issue: 'fall_armyworm',
      confidence_band: 'high',
      model_confidence: 0.86,
      severity_pct: 30,
      verification_weight: 0.8,
      sim: true,
    })
    expect(row).not.toHaveProperty('reporter_id')
  })

  it('counts the officer-verified issue when it differs from the AI', () => {
    const corrected = { ...observation, verified_issue: 'unknown' as const }
    expect(toObservationRow('obs-1', corrected, internal).issue).toBe('unknown')
  })

  it('handles an observation still being diagnosed', () => {
    const pending = {
      ...observation,
      diagnosis: null,
      verified_issue: null,
      status: 'diagnosing' as const,
    }
    const row = toObservationRow('obs-1', pending, null)
    expect(row).toMatchObject({ issue: null, model_confidence: null, confidence_band: null })
  })
})
