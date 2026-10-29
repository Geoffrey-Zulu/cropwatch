import { z } from '../zod'
import { CropSchema } from '../constants/crops'
import { IssueSchema } from '../constants/issues'
import { SeverityBandSchema } from '../constants/severity'
import { ConfidenceBandSchema, VerificationStateSchema } from '../constants/verification'
import { RiskLevelSchema } from './alert'
import { DistrictSlugSchema, TimestampSchema } from './common'
import { ExpertReviewReasonSchema } from './diagnosis'
import { ObservationStatusSchema } from './observation'
import { ProductSourceSchema } from './registeredProduct'

// Command Center dashboard (tRPC /trpc), not the frozen mobile contract. Outputs are parsed
// with these schemas on the server, so what they leave out cannot leak: Evidence has no field
// for model_confidence (CLAUDE.md invariant 3) and the Outgrower View has none for a
// coordinate (invariant 6).

// ---------------------------------------------------------------- Evidence panel

export const ObservationEvidenceSchema = z.object({
  obs_id: z.string(),
  status: ObservationStatusSchema,
  verification_state: VerificationStateSchema,
  verified_issue: IssueSchema.nullable(),
  diagnosis: z
    .object({
      suspected_issue: IssueSchema,
      confidence_band: ConfidenceBandSchema,
      needs_expert_review: z.boolean(),
      expert_review_reason: ExpertReviewReasonSchema.nullable(),
      model_id: z.string(),
      prompt_version: z.string(),
      attempts: z.number().int().nullable(),
    })
    .nullable(),
  // Retrieval for the recommendation: what was asked, what came back, what was refused.
  retrieval: z
    .object({
      query: z.string(),
      retrieved: z.number().int(),
      excerpts: z.array(
        z.object({
          ref: z.string(),
          document_id: z.string(),
          title: z.string(),
          tier: z.number().int(),
          source_url: z.string().nullable(),
        })
      ),
      dropped: z.array(z.object({ text: z.string(), reason: z.string() })),
      model_id: z.string().nullable(),
      prompt_version: z.string().nullable(),
    })
    .nullable(),
  // The deterministic register check (invariant 1).
  regulatory: z
    .object({
      outcome: z.enum(['recommendation', 'referral']),
      passed: z.array(
        z.object({
          registration_no: z.string(),
          trade_name: z.string(),
          active_ingredient: z.string(),
          label_dose: z.string(),
          // e.g. plantwise_pmdg: then registration_no is an internal id, not a registration.
          source: ProductSourceSchema.nullish(),
        })
      ),
      rejected: z.array(z.object({ candidate: z.string(), reason: z.string() })),
      sources: z.array(z.object({ title: z.string(), tier: z.number().int(), uri: z.string() })),
    })
    .nullable(),
  sim: z.boolean(),
})
export type ObservationEvidence = z.infer<typeof ObservationEvidenceSchema>

// ---------------------------------------------------------------- Outgrower View

// Why a farm is on a visit list, as codes the view renders as chips; `reasons` keeps the sentences.
export const VISIT_REASONS = [
  'cluster',
  'severe',
  'moderate',
  'awaiting_review',
  'high_district',
] as const
export const VisitReasonSchema = z.enum(VISIT_REASONS)
export type VisitReason = z.infer<typeof VisitReasonSchema>

export const VisitSchema = z.object({
  report_number: z.string(),
  farm_label: z.string(),
  camp: z.string(),
  district: z.string(),
  crop: CropSchema,
  issue: IssueSchema.nullable(),
  issue_label: z.string(),
  severity_band: SeverityBandSchema.nullable(),
  last_report_at: TimestampSchema,
  // 1 visit first; an ordinal, never a likelihood.
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  reasons: z.array(z.string()).min(1),
  reason_codes: z.array(VisitReasonSchema).optional(),
  sim: z.boolean(),
})
export type Visit = z.infer<typeof VisitSchema>

export const OutgrowerOverviewSchema = z.object({
  org_id: z.string(),
  name: z.string(),
  enrolled_farmers: z.number().int(),
  sim: z.boolean(),
  window_days: z.number().int(),
  reports: z.number().int(),
  verified_reports: z.number().int(),
  top_issue: z
    .object({
      issue: IssueSchema,
      issue_label: z.string(),
      this_week: z.number().int(),
      last_week: z.number().int(),
    })
    .nullable(),
  camps: z.array(
    z.object({
      camp: z.string(),
      district: z.string(),
      district_slug: DistrictSlugSchema,
      reports: z.number().int(),
      top_issue_label: z.string().nullable(),
      damaged: z.number().int(),
      in_cluster: z.number().int(),
      awaiting_review: z.number().int(),
      district_level: RiskLevelSchema.nullable(),
      attention: z.boolean(),
    })
  ),
  officers: z.array(
    z.object({
      officer_id: z.string(),
      label: z.string(),
      district: z.string(),
      visits: z.array(VisitSchema),
    })
  ),
  unassigned: z.array(VisitSchema),
})
export type OutgrowerOverview = z.infer<typeof OutgrowerOverviewSchema>

// ---------------------------------------------------------------- Weather context

const DailyWeatherSchema = z.object({
  date: z.string(),
  tmean: z.number().nullable(),
  tmax: z.number().nullable(),
  tmin: z.number().nullable(),
  rain: z.number().nullable(),
  humidity: z.number().nullable(),
})

export const DistrictWeatherSchema = z.object({
  district: z.string(),
  district_slug: DistrictSlugSchema,
  past: z.array(DailyWeatherSchema),
  forecast: z.array(DailyWeatherSchema),
  fetched_at: TimestampSchema,
  conditions: z.array(
    z.object({
      issue: IssueSchema,
      favourable: z.boolean(),
      observed: z.string(),
      guide: z.string(),
      document_title: z.string(),
      threshold: z.string(),
    })
  ),
  source: z.object({ name: z.string(), url: z.string(), licence: z.string() }),
})
export type DistrictWeather = z.infer<typeof DistrictWeatherSchema>
