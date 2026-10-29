import { z } from '../zod'
import { TimestampSchema } from './common'
import { ProductSourceSchema, RegisteredProductSchema } from './registeredProduct'

// Source authority ranking, 1 (MoA) → 6 (research). Local authoritative sources override
// generic ones on conflict (technicaldoc.md §7).
export const AuthorityTierSchema = z.number().int().min(1).max(6).openapi({
  description: '1 MoA, 2 ZARI, 3 ZMD, 4 FAO, 5 CABI, 6 research. Lower wins on conflict.',
})

export const RagSourceSchema = z.object({
  title: z.string().min(1),
  tier: AuthorityTierSchema,
  uri: z.string().min(1),
  chunk_ids: z.array(z.string()),
})
export type RagSource = z.infer<typeof RagSourceSchema>

// A chemical option is a projection of a registered_products row and nothing else, so dose
// text can only ever come from label_dose (CLAUDE.md invariant 1).
export const ChemicalOptionSchema = RegisteredProductSchema.pick({
  registration_no: true,
  trade_name: true,
  active_ingredient: true,
  label_dose: true,
  phi_days: true,
  source_doc: true,
})
  .extend({ source: ProductSourceSchema.optional() })
  .openapi('ChemicalOption', {
    description:
      'A product that passed the regulatory filter for this crop and issue. Render label_dose exactly as given (verbatim source text). phi_days is the pre-harvest interval. When source is plantwise_pmdg, registration_no is an internal id, not a registration number: show the source ("Plantwise Zambia PMDG") instead, and label_dose is the guide text.',
  })
export type ChemicalOption = z.infer<typeof ChemicalOptionSchema>

// The last IPM step when no registered product passed the filter (the contract's
// Recommendation.officer_referral).
export const OFFICER_REFERRAL = 'Consult an extension officer for chemical options.'

export const RegulatoryCheckSchema = z.object({
  passed: z.boolean(),
  rejected_products: z.array(z.string()),
})

// recommendations/{recId} (technicaldoc.md §4.1).
export const RecommendationSchema = z.object({
  obs_id: z.string().min(1),
  created_at: TimestampSchema,
  // Ordered IPM ladder: scout → cultural → biological → chemical.
  ipm_steps: z.array(z.string().min(1)).min(1),
  // Empty means IPM-only output plus officer referral.
  chemical_options: z.array(ChemicalOptionSchema),
  // Every recommendation carries at least one citation (buildplan.md §4.3).
  rag_sources: z.array(RagSourceSchema).min(1),
  regulatory_check: RegulatoryCheckSchema,
  sim: z.boolean(),
})
export type Recommendation = z.infer<typeof RecommendationSchema>
