import { describe, it, expect } from 'vitest'
import {
  alertTopic,
  CreateObservationRequestSchema,
  InterventionRequestSchema,
  OutcomeRequestSchema,
} from './api'

const uid = 'Vn1rKk5yQhWcXz0pB2sLqT4uEa83'
const obsId = 'k3J9xQ2mW8pL5vR1tY7u'

const createRequest = {
  obs_id: obsId,
  crop: 'tomato',
  location: { latitude: -15.4167, longitude: 28.2833 },
  district: 'Chongwe',
  province: 'Lusaka',
  photo_paths: [`observations/${uid}/${obsId}/0.jpg`, `observations/${uid}/${obsId}/1.jpg`],
}

describe('CreateObservationRequestSchema', () => {
  it('accepts the minimal request, with optional fields omitted', () => {
    expect(CreateObservationRequestSchema.safeParse(createRequest).success).toBe(true)
  })

  it('rejects photos outside the observation folder', () => {
    const result = CreateObservationRequestSchema.safeParse({
      ...createRequest,
      photo_paths: [`observations/${uid}/someoneElsesObsId01/0.jpg`],
    })
    expect(result.success).toBe(false)
  })

  it('rejects the pre-freeze path without a uid', () => {
    const result = CreateObservationRequestSchema.safeParse({
      ...createRequest,
      photo_paths: [`observations/${obsId}/0.jpg`],
    })
    expect(result.success).toBe(false)
  })

  it('rejects photos from more than one uploader', () => {
    const result = CreateObservationRequestSchema.safeParse({
      ...createRequest,
      photo_paths: [`observations/${uid}/${obsId}/0.jpg`, `observations/otherUid/${obsId}/1.jpg`],
    })
    expect(result.success).toBe(false)
  })

  it('requires at least one photo', () => {
    const result = CreateObservationRequestSchema.safeParse({ ...createRequest, photo_paths: [] })
    expect(result.success).toBe(false)
  })

  it('rejects a short or malformed obs_id', () => {
    for (const bad of ['short', 'has/slash/inside!!!!']) {
      const result = CreateObservationRequestSchema.safeParse({
        ...createRequest,
        obs_id: bad,
        photo_paths: [`observations/${uid}/${bad}/0.jpg`],
      })
      expect(result.success, bad).toBe(false)
    }
  })

  it('rejects a province outside the ten', () => {
    const result = CreateObservationRequestSchema.safeParse({
      ...createRequest,
      province: 'Lusaka Province',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a district outside the known list', () => {
    const result = CreateObservationRequestSchema.safeParse({
      ...createRequest,
      district: 'Shibuyunji',
    })
    expect(result.success).toBe(true)
  })
})

describe('InterventionRequestSchema', () => {
  const base = { applied_at: '2026-10-22T08:00:00Z', products: [] }

  it('allows a cultural intervention without products', () => {
    expect(InterventionRequestSchema.safeParse({ ...base, type: 'cultural' }).success).toBe(true)
  })

  it('requires a registered product for a chemical intervention', () => {
    expect(InterventionRequestSchema.safeParse({ ...base, type: 'chemical' }).success).toBe(false)
  })
})

describe('OutcomeRequestSchema', () => {
  it('takes a severity band, not a percentage', () => {
    const outcome = { followup_at: '2026-10-29T08:00:00Z', resolved: false }
    expect(OutcomeRequestSchema.safeParse({ ...outcome, severity_band: 'low' }).success).toBe(true)
    expect(OutcomeRequestSchema.safeParse({ ...outcome, severity_band: 30 }).success).toBe(false)
  })
})

describe('alertTopic', () => {
  it.each([
    ['Chongwe', 'alerts-chongwe'],
    ['Kapiri Mposhi', 'alerts-kapiri-mposhi'],
    ['kapiri-mposhi', 'alerts-kapiri-mposhi'],
    ['Chongwe District', 'alerts-chongwe'],
    ["Shang'ombo", 'alerts-shang-ombo'],
    ['  Lusaka  ', 'alerts-lusaka'],
  ])('%s → %s', (district, topic) => {
    expect(alertTopic(district)).toBe(topic)
  })
})
