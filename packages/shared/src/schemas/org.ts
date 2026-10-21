import { z } from '../zod'
import { ProvinceSchema } from '../constants/provinces'
import { RoleSchema } from '../constants/roles'

export const OrgTypeSchema = z.enum(['outgrower', 'ngo', 'gov', 'input_company'])

// orgs/{orgId}, e.g. DEMO OUTGROWER CO. (technicaldoc.md §4.1).
export const OrgSchema = z.object({
  name: z.string().min(1),
  type: OrgTypeSchema,
  enrolled_farmer_count: z.number().int().min(0),
  sim: z.boolean(),
})
export type Org = z.infer<typeof OrgSchema>

export const ReportingChannelSchema = z.enum(['app', 'whatsapp', 'sms', 'ussd'])

// users/{userId}: who belongs to which org, in what role (technicaldoc.md §4.1). Authorization
// uses the `role` custom claim on the auth token; this field is the profile copy.
export const UserProfileSchema = z.object({
  role: RoleSchema,
  org_id: z.string().min(1).nullable(),
  district: z.string().min(1),
  province: ProvinceSchema,
  channel: ReportingChannelSchema,
  sim: z.boolean(),
})
export type UserProfile = z.infer<typeof UserProfileSchema>
