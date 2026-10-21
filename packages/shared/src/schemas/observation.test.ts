import { describe, it, expect } from 'vitest'
import { ObservationSchema, PhotoPathSchema } from './observation'

const observation = {
  reporter_id: 'uid-123',
  reporter_role: 'farmer',
  org_id: null,
  created_at: '2026-10-21T09:30:00Z',
  location: { latitude: -15.4167, longitude: 28.2833 },
  geohash: 'kv2mqs',
  district: 'Chongwe',
  province: 'Lusaka',
  camp: 'Chongwe Central',
  crop: 'tomato',
  planting_date: '2026-08-15',
  growth_stage: 'flowering',
  photo_paths: ['observations/abc123/0.jpg'],
  farmer_description: null,
  diagnosis: {
    suspected_issue: 'tuta_absoluta',
    model_confidence: 0.45,
    confidence_band: 'low',
    severity_pct: 20,
    visible_symptoms: ['leaf mines'],
    needs_expert_review: true,
    model_id: 'gemini-test',
    prompt_version: 'diagnose-v0',
  },
  verification_state: 'UNVERIFIED',
  verified_by: null,
  verified_issue: null,
  recommendation_id: null,
  intervention: null,
  outcome: null,
  sim: false,
}

describe('ObservationSchema', () => {
  it('accepts a valid observation', () => {
    expect(ObservationSchema.safeParse(observation).success).toBe(true)
  })

  it('accepts an observation before diagnosis lands', () => {
    expect(ObservationSchema.safeParse({ ...observation, diagnosis: null }).success).toBe(true)
  })

  it('never marks an expert-review observation AI_ASSESSED', () => {
    const result = ObservationSchema.safeParse({
      ...observation,
      verification_state: 'AI_ASSESSED',
    })
    expect(result.success).toBe(false)
  })

  it('lets an officer verify an expert-review observation', () => {
    const result = ObservationSchema.safeParse({
      ...observation,
      verification_state: 'FIELD_VERIFIED',
      verified_by: 'officer-1',
      verified_issue: 'tuta_absoluta',
    })
    expect(result.success).toBe(true)
  })

  it('requires an explicit sim flag', () => {
    const withoutSim: Record<string, unknown> = { ...observation }
    delete withoutSim.sim
    expect(ObservationSchema.safeParse(withoutSim).success).toBe(false)
  })

  it('rejects an invalid geohash', () => {
    expect(ObservationSchema.safeParse({ ...observation, geohash: 'kv2mail' }).success).toBe(false)
  })

  it('rejects free-text intervention products', () => {
    const result = ObservationSchema.safeParse({
      ...observation,
      intervention: {
        applied_at: '2026-10-22T08:00:00Z',
        type: 'chemical',
        products: [''],
        notes: '',
      },
    })
    expect(result.success).toBe(false)
  })
})

describe('PhotoPathSchema', () => {
  it('accepts the Storage upload path from the contract', () => {
    expect(PhotoPathSchema.safeParse('observations/Xy-9_z/12.jpg').success).toBe(true)
  })

  it.each([
    'gs://bucket/observations/abc/0.jpg',
    'observations/abc/0.png',
    'observations/abc/../x/0.jpg',
    'observations/abc/100.jpg',
  ])('rejects %s', path => {
    expect(PhotoPathSchema.safeParse(path).success).toBe(false)
  })
})
