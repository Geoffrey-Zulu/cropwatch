import { z } from '../zod'
import { IssueSchema } from '../constants/issues'
import { DistrictSlugSchema, GeoPointSchema, TimestampSchema } from './common'

// Qualitative prototype signal only. No numeric probabilities anywhere (CLAUDE.md invariant 2).
export const RISK_LEVELS = ['LOW', 'ELEVATED', 'HIGH'] as const
export const RiskLevelSchema = z.enum(RISK_LEVELS).openapi('RiskLevel', {
  description:
    'Qualitative prototype signal (Phytos Risk Model v0). Never a probability; always shown with its contributing factors.',
})
export type RiskLevel = z.infer<typeof RiskLevelSchema>

// A level is never shown bare: contributing factors travel with it (invariant 2).
export const ContributingFactorsSchema = z.array(z.string().min(1)).min(1)

export const AlertTypeSchema = z
  .enum(['cluster', 'risk_change', 'org_priority'])
  .openapi('AlertType')
export const AlertChannelSchema = z.enum(['fcm', 'sms'])

// What an alert rests on (design-system/phytos/MASTER.md §3). Added after the contract freeze as
// an optional field: older alerts carry none, and clients treat a missing or unknown class as a
// model risk signal, the least certain.
export const ALERT_CLASSES = ['weather_advisory', 'verified_cluster', 'model_risk_signal'] as const
export const AlertClassSchema = z.enum(ALERT_CLASSES).openapi('AlertClass', {
  description:
    'weather_advisory: forecast conditions only, no report confirms it. verified_cluster: the cluster rule is met and at least one report in it was verified by an officer. model_risk_signal: Risk Model v0 over AI-assessed reports, not yet verified. Treat a missing or unknown value as model_risk_signal.',
})
export type AlertClass = z.infer<typeof AlertClassSchema>

export const ALERT_CLASS_LABELS: Record<AlertClass, string> = {
  weather_advisory: 'Weather advisory',
  verified_cluster: 'Verified cluster alert',
  model_risk_signal: 'Model risk signal',
}

// The class a stored alert shows: an explicit class wins; otherwise the least certain.
export const alertClassOf = (alert: { alert_class?: AlertClass | null }): AlertClass =>
  alert.alert_class ?? 'model_risk_signal'

// One line saying how sure the alert is, in words (invariants 2 and 3).
export function alertUncertainty(
  alertClass: AlertClass,
  { verified = 0, reports = 0 }: { verified?: number; reports?: number } = {}
) {
  switch (alertClass) {
    case 'weather_advisory':
      return 'Forecast conditions only. No report confirms this.'
    case 'verified_cluster':
      return verified >= reports
        ? `All ${reports} reports verified by an officer.`
        : `${verified} of ${reports} reports verified by an officer; the rest are AI-assessed.`
    case 'model_risk_signal':
      return 'Prototype signal from AI-assessed reports. Not yet verified by an officer.'
  }
}

// alerts/{alertId} (technicaldoc.md §4.1).
export const AlertSchema = z.object({
  type: AlertTypeSchema,
  issue: IssueSchema,
  district: z.string().min(1),
  district_slug: DistrictSlugSchema,
  // Cluster centroid, not a farm location.
  geo_center: GeoPointSchema,
  radius_km: z.number().positive(),
  level: RiskLevelSchema,
  contributing_factors: ContributingFactorsSchema,
  observation_ids: z.array(z.string().min(1)),
  channels_sent: z.array(AlertChannelSchema),
  created_at: TimestampSchema,
  // TRUE when generated from any simulated observation.
  sim: z.boolean(),
  // Optional: alerts raised before the classes existed have none (alertClassOf).
  alert_class: AlertClassSchema.nullish(),
  // Reports in the alert verified by an officer (cluster alerts); kept current as officers verify.
  verified_reports: z.number().int().min(0).nullish(),
})
export type Alert = z.infer<typeof AlertSchema>
