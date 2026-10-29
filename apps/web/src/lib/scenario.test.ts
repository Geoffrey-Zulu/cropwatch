import { describe, expect, it } from 'vitest'
import type { DashObservation } from '../hooks/useLive'
import { fetchRainOutlook } from './rainOutlook'
import { bandFor, campScenarios, STAGE_TABLE, stageRowFor, type RainOutlook } from './scenario'

const NOW = Date.parse('2026-10-29T10:00:00.000Z')

const obs = (over: Partial<DashObservation>): DashObservation => ({
  id: `obs-${Math.random().toString(36).slice(2)}`,
  createdAt: '2026-10-27T09:00:00.000Z',
  crop: 'maize',
  district: 'Chipata',
  districtSlug: 'chipata',
  province: 'Eastern',
  camp: 'Chipata Camp A',
  location: { latitude: -13.6, longitude: 32.6 },
  status: 'complete',
  verification: 'AI_ASSESSED',
  verifiedIssue: null,
  suspectedIssue: 'fall_armyworm',
  issue: 'fall_armyworm',
  band: 'high',
  severity: 'moderate',
  needsReview: false,
  reviewReason: null,
  symptoms: [],
  modelId: null,
  promptVersion: null,
  photoPaths: [],
  reporterRole: 'farmer',
  orgId: null,
  recommendationId: null,
  description: null,
  plantingDate: '2026-10-10',
  growthStage: null,
  sim: true,
  ...over,
})

const wet = new Map<string, RainOutlook>([['chipata', { rainMm: 60, days: 14 }]])
const dry = new Map<string, RainOutlook>([['chipata', { rainMm: 4, days: 14 }]])

describe('scenario: camps to monitor if the next 14 days turn dry', () => {
  it('reads the crop stage from the planting date', () => {
    expect(stageRowFor('maize', 20)?.stage).toBe('Early vegetative')
    expect(stageRowFor('maize', 50)?.stage).toBe('Late vegetative')
    expect(stageRowFor('maize', 90)?.stage).toBe('Tasselling and later')
    expect(stageRowFor('tomato', 200)?.concern).toBe('high')
  })

  it('cites a guide or says it is a Phytos assumption on every scored row', () => {
    for (const row of STAGE_TABLE.filter(r => r.concern !== 'none'))
      expect(row.source !== null || /Phytos assumption/.test(row.basis)).toBe(true)
  })

  it('never ranks a camp above routine when the forecast is not dry', () => {
    const rows = campScenarios({
      observations: [obs({ verification: 'FIELD_VERIFIED' })],
      rain: wet,
      mode: 'forecast',
      now: NOW,
    })
    expect(rows[0]).toMatchObject({ band: 'routine', dry: false, rainMm: 60 })
  })

  it('the canned dry spell overrides the forecast', () => {
    const rows = campScenarios({
      observations: [obs({ verification: 'FIELD_VERIFIED' })],
      rain: wet,
      mode: 'dry_spell',
      now: NOW,
    })
    expect(rows[0]).toMatchObject({ band: 'closer', dry: true, concern: 'high' })
    expect(rows[0].verified).toEqual([{ issue: 'fall_armyworm', count: 1 }])
  })

  it('counts only officer-verified reports, and only in the window', () => {
    const rows = campScenarios({
      observations: [
        obs({ verification: 'AI_ASSESSED' }),
        obs({ verification: 'EXPERT_CONFIRMED', createdAt: '2026-10-01T09:00:00.000Z' }),
      ],
      rain: dry,
      mode: 'forecast',
      now: NOW,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].verified).toEqual([])
    expect(rows[0].band).toBe('watch')
  })

  it('works with no forecast at all, and orders closer before watch before routine', () => {
    const rows = campScenarios({
      observations: [
        obs({ camp: 'B', crop: 'cabbage', issue: 'diamondback_moth' }),
        obs({ camp: 'A', verification: 'FIELD_VERIFIED' }),
        obs({ camp: 'C', plantingDate: null }),
      ],
      rain: new Map(),
      mode: 'dry_spell',
      now: NOW,
    })
    expect(rows.map(r => [r.camp, r.band])).toEqual([
      ['A', 'closer'],
      ['C', 'watch'],
      ['B', 'routine'],
    ])
    expect(rows[1]).toMatchObject({ stageUnknown: true, concern: 'moderate' })
  })

  it('bands are an ordering from the rules, nothing else', () => {
    expect(bandFor({ dry: null, concern: 'high', verified: 3 })).toBe('routine')
    expect(bandFor({ dry: true, concern: 'none', verified: 2 })).toBe('closer')
    expect(bandFor({ dry: true, concern: 'low', verified: 0 })).toBe('routine')
  })
})

describe('rain outlook', () => {
  it('sums the next 14 days per district from one Open-Meteo request', async () => {
    let asked = ''
    const fake = (async (url: string) => {
      asked = url
      return new Response(
        JSON.stringify([
          { daily: { time: ['a', 'b'], precipitation_sum: [2.3, null] } },
          { daily: { time: ['a', 'b'], precipitation_sum: [10, 5.5] } },
        ])
      )
    }) as unknown as typeof fetch
    const outlook = await fetchRainOutlook(['lusaka', 'chipata', 'lusaka', 'nowhere'], fake)
    expect(asked).toContain('forecast_days=14')
    expect(asked.split('latitude=')[1].split('&')[0].split(',')).toHaveLength(2)
    expect(outlook.get('lusaka')).toEqual({ rainMm: 2.3, days: 2 })
    expect(outlook.get('chipata')).toEqual({ rainMm: 15.5, days: 2 })
  })
})
