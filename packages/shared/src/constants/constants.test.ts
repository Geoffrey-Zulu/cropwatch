import { describe, it, expect } from 'vitest'
import { CROPS, CROP_LABELS } from './crops'
import { ISSUES, ISSUE_LABELS, KNOWN_ISSUES } from './issues'
import { VERIFICATION_STATES, VERIFICATION_WEIGHTS } from './verification'

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
