import { z } from '../zod'
import { CropSchema } from '../constants/crops'
import { KnownIssueSchema } from '../constants/issues'
import { DateSchema } from './common'

export const WHO_CLASSES = ['Ia', 'Ib', 'II', 'III', 'U'] as const
export const WhoClassSchema = z.enum(WHO_CLASSES)

export const RegistrationNoSchema = z.string().min(1).openapi('RegistrationNo', {
  description: 'Product registration number from the Regulatory Product Database.',
})

// Where a row came from, in technicaldoc §8 priority order. `placeholder` rows exist only so
// the filter is testable before the real register lands; the filter excludes them unless a
// caller explicitly allows them, so they can never reach a farmer as real advice.
export const PRODUCT_SOURCES = ['zema', 'label', 'moa_faw_manual', 'placeholder'] as const
export const ProductSourceSchema = z.enum(PRODUCT_SOURCES)
export type ProductSource = z.infer<typeof ProductSourceSchema>

// Regulatory Product Database row, registered_products/{registeredProductDocId(no)}
// (technicaldoc.md §8). The chemical firewall: every chemical recommendation must match a row
// here on crop AND issue, unexpired (CLAUDE.md invariant 1).
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
  source: ProductSourceSchema,
  source_doc: z.string().min(1),
  // Valid through this date, inclusive.
  expiry: DateSchema.nullable(),
})
export type RegisteredProduct = z.infer<typeof RegisteredProductSchema>

// Registration numbers may contain "/" (not allowed in a Firestore document ID), so the ID is
// the percent-encoded number: reversible and collision-free.
export function registeredProductDocId(registrationNo: string) {
  return encodeURIComponent(registrationNo)
}
