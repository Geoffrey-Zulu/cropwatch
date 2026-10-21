import { z } from 'zod'
import { CropSchema } from '../constants/crops'
import { IssueSchema } from '../constants/issues'
import { RoleSchema } from '../constants/roles'
import { VerificationStateSchema } from '../constants/verification'
import { DateSchema, GeoPointSchema, TimestampSchema } from './common'
import { DiagnosisSchema } from './diagnosis'
import { RegistrationNoSchema } from './registeredProduct'

// Mobile uploads photos direct to Storage at observations/{obsId}/{n}.jpg (buildplan.md §2).
// infra/storage.rules enforces the same shape.
export const PhotoPathSchema = z.string().regex(/^observations\/[A-Za-z0-9_-]+\/\d{1,2}\.jpg$/)

// Geohash base32 alphabet (no a, i, l, o).
const GeohashSchema = z.string().regex(/^[0-9b-hjkmnp-z]{1,12}$/)

export const InterventionTypeSchema = z.enum(['cultural', 'biological', 'chemical', 'mixed'])

export const InterventionSchema = z.object({
  applied_at: TimestampSchema,
  type: InterventionTypeSchema,
  // Registration numbers from registered_products, never free text.
  products: z.array(RegistrationNoSchema),
  notes: z.string(),
})
export type Intervention = z.infer<typeof InterventionSchema>

export const OutcomeSchema = z.object({
  followup_at: TimestampSchema,
  severity_pct: z.number().min(0).max(100),
  resolved: z.boolean(),
  notes: z.string(),
})
export type Outcome = z.infer<typeof OutcomeSchema>

// observations/{obsId} (technicaldoc.md §4.1). Unrefined shape, for .pick()/.extend() when
// building request schemas; validate documents with ObservationSchema.
export const ObservationBaseSchema = z.object({
  reporter_id: z.string().min(1),
  reporter_role: RoleSchema,
  org_id: z.string().min(1).nullable(),
  created_at: TimestampSchema,
  // Precise. NEVER exposed to Outgrower/commercial views (CLAUDE.md invariant 6).
  location: GeoPointSchema,
  geohash: GeohashSchema,
  district: z.string().min(1),
  province: z.string().min(1),
  camp: z.string().min(1),
  crop: CropSchema,
  planting_date: DateSchema.nullable(),
  growth_stage: z.string().nullable(),
  photo_paths: z.array(PhotoPathSchema),
  farmer_description: z.string().max(2000).nullable(),
  diagnosis: DiagnosisSchema.nullable(),
  verification_state: VerificationStateSchema,
  verified_by: z.string().min(1).nullable(),
  verified_issue: IssueSchema.nullable(),
  recommendation_id: z.string().min(1).nullable(),
  intervention: InterventionSchema.nullable(),
  outcome: OutcomeSchema.nullable(),
  // TRUE for every seeded/synthetic row; drives the DemoBadge (CLAUDE.md invariant 5).
  sim: z.boolean(),
})

// An observation routed to expert review never becomes AI_ASSESSED (technicaldoc.md §6).
export const ObservationSchema = ObservationBaseSchema.refine(
  o => !(o.diagnosis?.needs_expert_review && o.verification_state === 'AI_ASSESSED'),
  {
    message: 'An observation flagged for expert review cannot be AI_ASSESSED',
    path: ['verification_state'],
  }
)
export type Observation = z.infer<typeof ObservationSchema>
