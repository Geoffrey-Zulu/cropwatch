import { z } from '../zod'

// Qualitative severity, the only form severity takes in UI-bound data. The model's numeric
// visual estimate (severity_pct) stays internal.
export const SEVERITY_BANDS = ['none', 'low', 'moderate', 'severe'] as const

export const SeverityBandSchema = z.enum(SEVERITY_BANDS).openapi('SeverityBand', {
  description: 'Qualitative extent of visible damage.',
})
export type SeverityBand = z.infer<typeof SeverityBandSchema>

// v0 cut-points over the model's 0–100 visual estimate; agronomist to confirm.
export function severityBand(severityPct: number): SeverityBand {
  if (severityPct <= 0) return 'none'
  if (severityPct < 25) return 'low'
  if (severityPct < 50) return 'moderate'
  return 'severe'
}
