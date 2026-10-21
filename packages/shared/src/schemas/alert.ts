import { z } from 'zod'
import { IssueSchema } from '../constants/issues'
import { GeoPointSchema, TimestampSchema } from './common'

// Qualitative prototype signal only. No numeric probabilities anywhere (CLAUDE.md invariant 2).
export const RISK_LEVELS = ['LOW', 'ELEVATED', 'HIGH'] as const
export const RiskLevelSchema = z.enum(RISK_LEVELS)
export type RiskLevel = z.infer<typeof RiskLevelSchema>

// A level is never shown bare: contributing factors travel with it (invariant 2).
export const ContributingFactorsSchema = z.array(z.string().min(1)).min(1)

export const AlertTypeSchema = z.enum(['cluster', 'risk_change', 'org_priority'])
export const AlertChannelSchema = z.enum(['fcm', 'sms'])

// alerts/{alertId} (technicaldoc.md §4.1).
export const AlertSchema = z.object({
  type: AlertTypeSchema,
  issue: IssueSchema,
  district: z.string().min(1),
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
})
export type Alert = z.infer<typeof AlertSchema>
