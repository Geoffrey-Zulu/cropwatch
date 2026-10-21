import { z } from 'zod'
import { CropSchema } from '../constants/crops'
import { KnownIssueSchema } from '../constants/issues'
import { DateSchema } from './common'

export const WHO_CLASSES = ['Ia', 'Ib', 'II', 'III', 'U'] as const
export const WhoClassSchema = z.enum(WHO_CLASSES)

export const RegistrationNoSchema = z.string().min(1)

// Regulatory Product Database row, registered_products/{registrationNo} (technicaldoc.md §8).
// The chemical firewall: every chemical recommendation must match a row here on crop AND
// issue, unexpired (CLAUDE.md invariant 1).
export const RegisteredProductSchema = z.object({
  registration_no: RegistrationNoSchema,
  trade_name: z.string().min(1),
  active_ingredient: z.string().min(1),
  registrant: z.string().min(1),
  approved_crops: z.array(CropSchema).min(1),
  approved_issues: z.array(KnownIssueSchema).min(1),
  // Verbatim from the label and rendered byte-identical. Never trim, normalise or rewrite.
  label_dose: z.string().min(1),
  phi_days: z.number().int().min(0),
  who_class: WhoClassSchema,
  source_doc: z.string().min(1),
  expiry: DateSchema.nullable(),
})
export type RegisteredProduct = z.infer<typeof RegisteredProductSchema>
