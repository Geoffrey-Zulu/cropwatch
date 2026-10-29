import type {
  AlertClass,
  ConfidenceBand,
  ExpertReviewReason,
  ObservationStatus,
  RiskLevel,
  SeverityBand,
  VerificationState,
} from '@repo/shared'

// Every dashboard label lives here, so one test holds the line: words, never odds or a model
// number; no em dashes (design-system/phytos/MASTER.md §9).

export const LEVEL_TEXT: Record<RiskLevel, string> = {
  HIGH: 'High',
  ELEVATED: 'Elevated',
  LOW: 'Low',
}

export const confidenceText = (band: ConfidenceBand) => `AI assessment: ${band} confidence`

export const SEVERITY_TEXT: Record<SeverityBand, string> = {
  none: 'No visible damage',
  low: 'Light damage',
  moderate: 'Moderate damage',
  severe: 'Severe damage',
}

export const STATUS_TEXT: Record<ObservationStatus, string> = {
  diagnosing: 'Assessing photo',
  recommending: 'Finding advice',
  awaiting_expert_review: 'With an officer',
  complete: 'Advice sent',
}

export const VERIFICATION_TEXT: Record<VerificationState, string> = {
  UNVERIFIED: 'Not verified',
  AI_ASSESSED: 'AI-assessed',
  FIELD_VERIFIED: 'Verified in the field',
  EXPERT_CONFIRMED: 'Confirmed by an expert',
}

export const REVIEW_REASON_TEXT: Record<ExpertReviewReason, string> = {
  low_confidence: 'The AI assessment had low confidence',
  unknown_issue: 'The AI could not identify the problem',
  invalid_model_output: 'The AI answer was unusable',
}

export const REJECTION_TEXT: Record<string, string> = {
  not_registered: 'Not on the register',
  wrong_crop: 'Not registered for this crop',
  wrong_issue: 'Not registered for this problem',
  expired: 'Registration expired',
  placeholder: 'Placeholder row, not yet confirmed from a label',
}

export const TIER_NAMES: Record<number, string> = {
  1: 'Ministry of Agriculture',
  2: 'ZARI',
  3: 'Zambia Meteorological Dept',
  4: 'FAO',
  5: 'CABI Plantwise',
  6: 'Research',
}

// What happens to a verification: evaluation data, never automatic learning (CLAUDE.md 9).
export const EVALUATION_NOTE =
  'Officer verifications are kept as evaluation data: every correction becomes a test case for the next prompt or model version. The model does not learn from them automatically.'

// The short form of alertUncertainty for one-line alert rows; the full sentence stays on hover
// and on the outbreak detail (CLAUDE.md invariant 10).
export function uncertaintyShort(
  alertClass: AlertClass,
  { verified, reports }: { verified: number; reports: number }
) {
  if (alertClass === 'weather_advisory') return 'Forecast only'
  if (alertClass === 'verified_cluster') return `${verified} of ${reports} verified`
  return 'Not yet verified'
}

// The capture app's number (the id's first four characters); simulated ids
// ("sim-tuta-lusaka-0001") read as their storyline and serial, e.g. "TUT-0001".
export function reportNumber(obsId: string) {
  const sim = /^sim-([a-z]+)-.*?(\d+)$/.exec(obsId)
  if (sim) return `${sim[1].slice(0, 3).toUpperCase()}-${sim[2]}`
  return obsId.slice(0, 4).toUpperCase()
}

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function dateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Lusaka',
  })
}

// "3 h ago", "2 days ago": the age of a report or signal.
export function ago(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000))
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} days ago`
}
