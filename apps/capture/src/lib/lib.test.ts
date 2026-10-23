import { describe, expect, it } from 'vitest'
import {
  CONFIDENCE_BANDS,
  findDistrict,
  OBSERVATION_STATUSES,
  ObservationIdSchema,
} from '@repo/shared'
import { parseRoute, hrefFor } from '../hooks/useRoute'
import { confidenceText, stampFor, waitingText } from './copy'
import { nearestDistrict } from './location'
import { buildReport, newObsId, photoPath, reportNumber } from './report'

describe('report', () => {
  it('builds a POST /observations body that the frozen contract accepts', () => {
    const obsId = newObsId()
    const report = buildReport({
      obsId,
      uid: 'farmerUid0001',
      crop: 'tomato',
      district: 'chongwe',
      location: { latitude: -15.33, longitude: 28.68 },
      plantingDate: '2026-09-02',
      description: '  holes in the fruit  ',
    })
    expect(report).toMatchObject({
      obs_id: obsId,
      district: 'Chongwe',
      province: 'Lusaka',
      photo_paths: [`observations/farmerUid0001/${obsId}/0.jpg`],
      farmer_description: 'holes in the fruit',
      planting_date: '2026-09-02',
    })
  })

  it('makes ids the contract accepts and short report numbers', () => {
    for (let i = 0; i < 50; i++)
      expect(ObservationIdSchema.safeParse(newObsId()).success).toBe(true)
    expect(reportNumber('k3J9xQ2mW8pL5vR1tY7u')).toBe('K3J9')
    expect(photoPath('u', 'o', 1)).toBe('observations/u/o/1.jpg')
  })

  it('refuses a district it cannot place', () => {
    expect(() =>
      buildReport({
        obsId: newObsId(),
        uid: 'u1',
        crop: 'maize',
        district: 'Atlantis',
        location: { latitude: 0, longitude: 0 },
        plantingDate: null,
        description: '',
      })
    ).toThrow('Unknown district')
  })
})

describe('location', () => {
  it('picks the district whose town is nearest the GPS fix', () => {
    expect(nearestDistrict(findDistrict('Chongwe')!.center).name).toBe('Chongwe')
    expect(nearestDistrict(findDistrict('Chipata')!.center).name).toBe('Chipata')
  })
})

describe('wording (CLAUDE.md invariants 2–3)', () => {
  it('states confidence in words only', () => {
    for (const band of CONFIDENCE_BANDS) {
      const text = confidenceText(band)
      expect(text).toMatch(/^AI assessment: (low|medium|high) confidence$/)
      expect(text).not.toMatch(/\d|%|probab/i)
    }
  })

  it('has a stamp for every status, and treats unknown ones as in progress', () => {
    for (const status of OBSERVATION_STATUSES) expect(stampFor(status).word).toBeTruthy()
    expect(stampFor('complete')).toMatchObject({
      word: 'Advice ready',
      tone: 'leaf',
      waiting: false,
    })
    expect(stampFor('awaiting_expert_review').tone).toBe('maize')
    expect(stampFor('something_new')).toMatchObject({ word: 'In progress', waiting: true })
    expect(waitingText('recommending')).toContain('guides')
  })
})

describe('routes', () => {
  it('round-trips every screen through the hash', () => {
    for (const route of [
      { page: 'home' },
      { page: 'diagnose' },
      { page: 'sent', obsId: 'abc' },
      { page: 'report', obsId: 'abc' },
    ] as const) {
      expect(parseRoute(hrefFor(route))).toEqual(route)
    }
    expect(parseRoute('#/nonsense')).toEqual({ page: 'home' })
  })
})
