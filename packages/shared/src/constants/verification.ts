import { z } from '../zod'

// Verification ladder (technicaldoc.md §4.1). AI predictions are never ground truth:
// every observation carries one of these states.
export const VERIFICATION_STATES = [
  'UNVERIFIED',
  'AI_ASSESSED',
  'FIELD_VERIFIED',
  'EXPERT_CONFIRMED',
] as const

export const VerificationStateSchema = z.enum(VERIFICATION_STATES).openapi('VerificationState', {
  description: 'Weakest to strongest. AI_ASSESSED is never set on an expert-review observation.',
})
export type VerificationState = z.infer<typeof VerificationStateSchema>

// v0 placeholders (technicaldoc.md §4.3), agronomist to redefine. INTERNAL: used only
// inside cluster/risk scoring, never displayed as science.
export const VERIFICATION_WEIGHTS: Record<VerificationState, number> = {
  UNVERIFIED: 0.2,
  AI_ASSESSED: 0.5,
  FIELD_VERIFIED: 0.8,
  EXPERT_CONFIRMED: 1.0,
}

// Below this model_confidence a diagnosis must route to the officer queue
// (CLAUDE.md invariant 4, technicaldoc.md §6).
export const EXPERT_REVIEW_CONFIDENCE_THRESHOLD = 0.6

// Qualitative bands are the ONLY way confidence reaches the UI (CLAUDE.md invariant 3).
export const CONFIDENCE_BANDS = ['low', 'medium', 'high'] as const
export const ConfidenceBandSchema = z.enum(CONFIDENCE_BANDS).openapi('ConfidenceBand', {
  description:
    'Qualitative AI assessment ("AI assessment: high confidence"). Never shown as a number. low always means expert review.',
})
export type ConfidenceBand = z.infer<typeof ConfidenceBandSchema>

// v0 cut-points. 'low' starts exactly at the review threshold, so a low band always means
// expert review.
export const HIGH_CONFIDENCE_FROM = 0.8

export function confidenceBand(modelConfidence: number): ConfidenceBand {
  if (modelConfidence < EXPERT_REVIEW_CONFIDENCE_THRESHOLD) return 'low'
  if (modelConfidence < HIGH_CONFIDENCE_FROM) return 'medium'
  return 'high'
}
