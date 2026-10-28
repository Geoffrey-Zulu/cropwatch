import { z } from '../zod'
import { CropSchema } from '../constants/crops'
import { DISTRICTS, districtSlug } from '../constants/districts'
import { IssueSchema } from '../constants/issues'
import { PROVINCES, ProvinceSchema } from '../constants/provinces'
import { SeverityBandSchema } from '../constants/severity'
import { VerificationStateSchema } from '../constants/verification'
import {
  AlertClassSchema,
  AlertTypeSchema,
  ContributingFactorsSchema,
  RiskLevelSchema,
} from './alert'
import { DateSchema, DistrictSlugSchema, GeoPointSchema, TimestampSchema } from './common'
import { DiagnosisBaseSchema } from './diagnosis'
import {
  InterventionSchema,
  InterventionTypeSchema,
  ObservationIdSchema,
  ObservationStatusSchema,
  OutcomeSchema,
  parsePhotoPath,
  PhotoPathSchema,
} from './observation'
import { ChemicalOptionSchema, RagSourceSchema } from './recommendation'
import { RegistrationNoSchema } from './registeredProduct'

// REST v1 (/api/v1): the mobile contract (buildplan.md §2). contracts/openapi.json is generated
// from these. After the freeze, only add optional fields: no renames, removals or type changes.
// Every UI-bound shape carries qualitative bands only, never a confidence number or percentage.

const NotesSchema = z.string().max(2000)

export const ErrorResponseSchema = z
  .object({
    error: z.enum([
      'unauthorized',
      'forbidden',
      'not_found',
      'validation_failed',
      'conflict',
      'not_implemented',
      'internal',
    ]),
    message: z.string().optional(),
    issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  })
  .openapi('Error')
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>

export const HealthResponseSchema = z
  .object({ status: z.literal('ok'), version: z.string() })
  .openapi('Health')

// ---------------------------------------------------------------- POST /observations

const KNOWN_DISTRICTS = PROVINCES.map(
  province =>
    `${province}: ${DISTRICTS.filter(d => d.province === province)
      .map(d => d.name)
      .join(', ')}`
).join('. ')

export const CreateObservationRequestSchema = z
  .object({
    obs_id: ObservationIdSchema,
    crop: CropSchema,
    location: GeoPointSchema,
    district: z
      .string()
      .min(1)
      .max(64)
      .openapi({
        description: `Offer these names in the picker; any other name is accepted and normalised to a district_slug. ${KNOWN_DISTRICTS}.`,
        example: 'Chongwe',
      }),
    province: ProvinceSchema,
    camp: z.string().min(1).max(64).nullish(),
    planting_date: DateSchema.nullish(),
    growth_stage: z.string().min(1).max(64).nullish().openapi({ example: 'flowering' }),
    photo_paths: z.array(PhotoPathSchema).min(1).max(5),
    farmer_description: NotesSchema.nullish(),
  })
  .refine(r => r.photo_paths.every(p => parsePhotoPath(p)?.obsId === r.obs_id), {
    message: 'Every photo path must be under observations/{uid}/{obs_id}/',
    path: ['photo_paths'],
  })
  .refine(r => new Set(r.photo_paths.map(p => parsePhotoPath(p)?.uid)).size === 1, {
    message: 'All photos must belong to one uploader',
    path: ['photo_paths'],
  })
  .openapi('CreateObservationRequest', {
    description:
      'Upload the photos to Storage first, then send this. location is the device GPS fix. The uid in every photo path must be the caller (otherwise 403).',
  })
export type CreateObservationRequest = z.infer<typeof CreateObservationRequestSchema>

export const ObservationCreatedSchema = z
  .object({ obs_id: ObservationIdSchema, status: ObservationStatusSchema })
  .openapi('ObservationCreated')

// ---------------------------------------------------------------- GET /observations/{id}

export const DiagnosisViewSchema = DiagnosisBaseSchema.pick({
  suspected_issue: true,
  confidence_band: true,
  severity_band: true,
  visible_symptoms: true,
  needs_expert_review: true,
  expert_review_reason: true,
  diagnosed_at: true,
})
  .extend({ suspected_issue_label: z.string() })
  .openapi('Diagnosis', {
    description:
      'AI assessment. Show confidence_band as words ("AI assessment: high confidence"), never as a number. When needs_expert_review is true, show that an officer will review instead of treatment advice.',
  })
export type DiagnosisView = z.infer<typeof DiagnosisViewSchema>

export const SourceSchema = RagSourceSchema.pick({ title: true, tier: true, uri: true }).openapi(
  'Source'
)

export const RecommendationViewSchema = z
  .object({
    ipm_steps: z
      .array(z.string().min(1))
      .min(1)
      .openapi({ description: 'Ordered IPM ladder: scout → cultural → biological → chemical.' }),
    chemical_options: z.array(ChemicalOptionSchema),
    officer_referral: z.boolean().openapi({
      description:
        'true when no registered product passed the filter: show "Consult an extension officer for chemical options".',
    }),
    sources: z.array(SourceSchema).min(1),
  })
  .openapi('Recommendation', {
    description:
      'IPM-first advice. Every chemical option is a registered product for this crop and issue; nothing here is model-written dosage.',
  })
export type RecommendationView = z.infer<typeof RecommendationViewSchema>

export const ObservationViewSchema = z
  .object({
    obs_id: ObservationIdSchema,
    created_at: TimestampSchema,
    crop: CropSchema,
    district: z.string(),
    district_slug: DistrictSlugSchema,
    province: ProvinceSchema,
    camp: z.string().nullable(),
    planting_date: DateSchema.nullable(),
    growth_stage: z.string().nullable(),
    photo_paths: z.array(PhotoPathSchema),
    farmer_description: z.string().nullable(),
    status: ObservationStatusSchema,
    verification_state: VerificationStateSchema,
    verified_issue: IssueSchema.nullable(),
    diagnosis: DiagnosisViewSchema.nullable(),
    recommendation: RecommendationViewSchema.nullable(),
    intervention: InterventionSchema.nullable(),
    outcome: OutcomeSchema.nullable(),
    sim: z.boolean().openapi({
      description: 'true for simulated demo data: show the DEMO DATA · SIMULATED badge.',
    }),
  })
  .openapi('Observation')
export type ObservationView = z.infer<typeof ObservationViewSchema>

// ---------------------------------------------------------------- observation actions

export const VerifyRequestSchema = z
  .object({ verified_issue: IssueSchema, notes: NotesSchema.nullish() })
  .openapi('VerifyRequest', {
    description:
      'Officer confirms or corrects the diagnosis. field_officer and extension_officer set FIELD_VERIFIED; agronomist and admin set EXPERT_CONFIRMED. An observation awaiting expert review moves to recommending; a verify that changes the issue re-triggers the recommendation (status → recommending → complete).',
  })
export type VerifyRequest = z.infer<typeof VerifyRequestSchema>

export const InterventionRequestSchema = z
  .object({
    applied_at: TimestampSchema,
    type: InterventionTypeSchema,
    products: z.array(RegistrationNoSchema).max(10),
    notes: NotesSchema.nullish(),
  })
  .refine(r => (r.type === 'chemical' || r.type === 'mixed' ? r.products.length > 0 : true), {
    message: 'chemical and mixed interventions list at least one registered product',
    path: ['products'],
  })
  .openapi('InterventionRequest')
export type InterventionRequest = z.infer<typeof InterventionRequestSchema>

export const OutcomeRequestSchema = z
  .object({
    followup_at: TimestampSchema,
    severity_band: SeverityBandSchema,
    resolved: z.boolean(),
    notes: NotesSchema.nullish(),
  })
  .openapi('OutcomeRequest')
export type OutcomeRequest = z.infer<typeof OutcomeRequestSchema>

// ---------------------------------------------------------------- GET /alerts

export const AlertsQuerySchema = z.object({
  district: z
    .string()
    .min(1)
    .max(64)
    .openapi({ description: 'District name or district_slug.', example: 'Chongwe' }),
})

export const AlertViewSchema = z
  .object({
    alert_id: z.string(),
    type: AlertTypeSchema,
    issue: IssueSchema,
    issue_label: z.string(),
    district: z.string(),
    district_slug: DistrictSlugSchema,
    level: RiskLevelSchema,
    contributing_factors: ContributingFactorsSchema,
    geo_center: GeoPointSchema,
    radius_km: z.number().positive(),
    created_at: TimestampSchema,
    sim: z.boolean(),
    // Added after the freeze (optional): what the alert rests on, and how many of its reports
    // an officer has verified. Show the class label and its uncertainty line with the level.
    alert_class: AlertClassSchema.optional(),
    reports: z.number().int().min(0).optional(),
    verified_reports: z.number().int().min(0).optional(),
  })
  .openapi('Alert', {
    description:
      'Area alert. Always show level together with contributing_factors, and the alert_class label with its uncertainty wording when present.',
  })
export type AlertView = z.infer<typeof AlertViewSchema>

export const AlertListSchema = z.object({ alerts: z.array(AlertViewSchema) }).openapi('AlertList')

// ---------------------------------------------------------------- FCM push

// FCM topic for a district's alerts, keyed by district_slug: "Kapiri Mposhi" →
// "alerts-kapiri-mposhi".
export function alertTopic(districtOrSlug: string) {
  return `alerts-${districtSlug(districtOrSlug)}`
}

export const AlertPushDataSchema = z
  .object({
    alert_id: z.string(),
    type: AlertTypeSchema,
    issue: IssueSchema,
    district: z.string(),
    district_slug: DistrictSlugSchema,
    level: RiskLevelSchema,
    title: z.string(),
    body: z.string(),
    sim: z.enum(['true', 'false']),
  })
  .openapi('AlertPushData', {
    description:
      'FCM data payload, sent to topic "alerts-" + district_slug (e.g. "alerts-kapiri-mposhi"; subscribe using the district_slug the API returns). All values are strings, as FCM requires. body always includes the contributing factors. Fetch the full alert with GET /alerts.',
  })
export type AlertPushData = z.infer<typeof AlertPushDataSchema>
