import type { ConfidenceBand, ObservationStatus, RiskLevel, SeverityBand } from '@repo/shared'

// Every user-facing status and confidence string lives here, so a test can hold the line:
// confidence is words only, never a number, never "probability" (CLAUDE.md invariants 2–3).

export const confidenceText = (band: ConfidenceBand) => `AI assessment: ${band} confidence`

export const SEVERITY_TEXT: Record<SeverityBand, string> = {
  none: 'No visible damage',
  low: 'Light damage',
  moderate: 'Moderate damage',
  severe: 'Severe damage',
}

export type StampTone = 'outline' | 'maize' | 'leaf'

export interface StampSpec {
  word: string
  tone: StampTone
  // Something is still happening: the stamp shows a waiting ellipsis.
  waiting: boolean
}

// Clients treat an unrecognised status as generic in-progress (frozen contract).
export function stampFor(status: ObservationStatus | string): StampSpec {
  switch (status) {
    case 'diagnosing':
      return { word: 'Assessing', tone: 'outline', waiting: true }
    case 'recommending':
      return { word: 'Assessed', tone: 'outline', waiting: true }
    case 'awaiting_expert_review':
      return { word: 'With an officer', tone: 'maize', waiting: false }
    case 'complete':
      return { word: 'Advice ready', tone: 'leaf', waiting: false }
    default:
      return { word: 'In progress', tone: 'outline', waiting: true }
  }
}

export function waitingText(status: ObservationStatus | string) {
  if (status === 'diagnosing') return 'Looking at your photo'
  if (status === 'recommending') return 'Finding advice in Zambian and FAO guides'
  return 'Working on your report'
}

export const TIER_NAMES: Record<number, string> = {
  1: 'Ministry of Agriculture',
  2: 'ZARI',
  3: 'Zambia Meteorological Dept',
  4: 'FAO',
  5: 'CABI Plantwise',
  6: 'Research',
}

export const LEVEL_TEXT: Record<RiskLevel, string> = {
  LOW: 'Low',
  ELEVATED: 'Watch',
  HIGH: 'Act now',
}

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
