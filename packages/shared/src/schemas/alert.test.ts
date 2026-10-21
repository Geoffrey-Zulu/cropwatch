import { describe, it, expect } from 'vitest'
import { AlertSchema } from './alert'
import { OrgSchema, UserProfileSchema } from './org'

const alert = {
  type: 'cluster',
  issue: 'fall_armyworm',
  district: 'Chipata',
  geo_center: { latitude: -13.64, longitude: 32.65 },
  radius_km: 10,
  level: 'ELEVATED',
  contributing_factors: ['Cluster of 6 reports within 8 km in 72 h'],
  observation_ids: ['a', 'b', 'c', 'd', 'e', 'f'],
  channels_sent: ['fcm', 'sms'],
  created_at: '2026-10-21T10:00:00Z',
  sim: true,
}

describe('AlertSchema', () => {
  it('accepts a cluster alert', () => {
    expect(AlertSchema.safeParse(alert).success).toBe(true)
  })

  it('never carries a bare level without contributing factors', () => {
    expect(AlertSchema.safeParse({ ...alert, contributing_factors: [] }).success).toBe(false)
  })

  it('rejects numeric risk levels', () => {
    expect(AlertSchema.safeParse({ ...alert, level: 0.73 }).success).toBe(false)
  })
})

describe('OrgSchema', () => {
  it('accepts the demo outgrower, flagged as simulated', () => {
    const result = OrgSchema.safeParse({
      name: 'DEMO OUTGROWER CO.',
      type: 'outgrower',
      enrolled_farmer_count: 1200,
      sim: true,
    })
    expect(result.success).toBe(true)
  })
})

describe('UserProfileSchema', () => {
  it('rejects a role outside the vocabulary', () => {
    const result = UserProfileSchema.safeParse({
      role: 'superuser',
      org_id: null,
      district: 'Lusaka',
      province: 'Lusaka',
      channel: 'app',
      sim: false,
    })
    expect(result.success).toBe(false)
  })
})
