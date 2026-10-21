import { describe, it, expect } from 'vitest'
import { CROPS, CROP_LABELS } from './crops'
import { DISTRICTS, districtSlug, findDistrict } from './districts'
import { ISSUES, ISSUE_LABELS, KNOWN_ISSUES } from './issues'
import { PROVINCES } from './provinces'
import { severityBand } from './severity'
import {
  confidenceBand,
  EXPERT_REVIEW_CONFIDENCE_THRESHOLD,
  VERIFICATION_STATES,
  VERIFICATION_WEIGHTS,
} from './verification'

// These lists are the contract between the Gemini response schema, the regulatory DB, the
// dashboard and the mobile app. Changing one is a contract change, so pin them here.
describe('controlled vocabularies', () => {
  it('crops match technicaldoc.md §4.1', () => {
    expect(CROPS).toEqual(['maize', 'tomato', 'cabbage', 'cassava', 'soybean'])
  })

  it('issues match technicaldoc.md §6, with unknown last', () => {
    expect(ISSUES).toEqual([
      'fall_armyworm',
      'tuta_absoluta',
      'late_blight',
      'early_blight',
      'diamondback_moth',
      'cassava_mosaic',
      'cassava_brown_streak',
      'maize_lethal_necrosis',
      'unknown',
    ])
    expect(KNOWN_ISSUES).not.toContain('unknown')
  })

  it('verification states are ordered weakest to strongest', () => {
    expect(VERIFICATION_STATES).toEqual([
      'UNVERIFIED',
      'AI_ASSESSED',
      'FIELD_VERIFIED',
      'EXPERT_CONFIRMED',
    ])
    const weights = VERIFICATION_STATES.map(s => VERIFICATION_WEIGHTS[s])
    expect(weights).toEqual([...weights].sort((a, b) => a - b))
  })

  it('every slug has a display label', () => {
    expect(Object.keys(CROP_LABELS).sort()).toEqual([...CROPS].sort())
    expect(Object.keys(ISSUE_LABELS).sort()).toEqual([...ISSUES].sort())
  })
})

describe('confidenceBand', () => {
  it('starts low exactly at the expert-review threshold, so low always means review', () => {
    expect(confidenceBand(EXPERT_REVIEW_CONFIDENCE_THRESHOLD - 0.001)).toBe('low')
    expect(confidenceBand(EXPERT_REVIEW_CONFIDENCE_THRESHOLD)).toBe('medium')
  })

  it.each([
    [0, 'low'],
    [0.59, 'low'],
    [0.79, 'medium'],
    [0.8, 'high'],
    [1, 'high'],
  ] as const)('%s → %s', (confidence, band) => {
    expect(confidenceBand(confidence)).toBe(band)
  })
})

describe('severityBand', () => {
  it.each([
    [0, 'none'],
    [1, 'low'],
    [24.9, 'low'],
    [25, 'moderate'],
    [49.9, 'moderate'],
    [50, 'severe'],
    [100, 'severe'],
  ] as const)('%s → %s', (pct, band) => {
    expect(severityBand(pct)).toBe(band)
  })
})

describe('districts', () => {
  it('have unique slugs, each in a real province', () => {
    expect(new Set(DISTRICTS.map(d => d.slug)).size).toBe(DISTRICTS.length)
    for (const d of DISTRICTS) expect(PROVINCES).toContain(d.province)
  })

  it('include both demo storylines', () => {
    expect(findDistrict('Chipata')?.province).toBe('Eastern')
    expect(findDistrict('Chongwe')?.province).toBe('Lusaka')
  })

  it.each([
    ['Kapiri Mposhi', 'kapiri-mposhi'],
    ['  CHONGWE ', 'chongwe'],
    ['Chongwe District', 'chongwe'],
    ['chongwe', 'chongwe'],
  ])('slugs %s as %s and finds it', (input, slug) => {
    expect(districtSlug(input)).toBe(slug)
    expect(findDistrict(input)?.slug).toBe(slug)
  })

  it('slugs a district outside the list without finding it', () => {
    expect(districtSlug('Itezhi-Tezhi')).toBe('itezhi-tezhi')
    expect(findDistrict('Itezhi-Tezhi')).toBeUndefined()
  })
})
