import { z } from '../zod'

// User roles (technicaldoc.md §4.1). Officers carry `role` as a Firebase Auth custom claim;
// infra/firestore.rules and infra/storage.rules check these exact strings.
export const ROLES = [
  'farmer',
  'field_officer',
  'extension_officer',
  'agronomist',
  'admin',
  // CEIH (31 Oct): an agribusiness credit team member, who approves advances for their own org.
  'credit',
] as const

export const RoleSchema = z.enum(ROLES).openapi('Role')
export type Role = z.infer<typeof RoleSchema>

// Roles that may verify (confirm or correct) a diagnosis.
export const OFFICER_ROLES = ['field_officer', 'extension_officer', 'agronomist', 'admin'] as const
export type OfficerRole = (typeof OFFICER_ROLES)[number]

// Command Center roles: the national view with precise report locations (isCommandCenter in
// infra/firestore.rules). field_officer is deliberately absent (CLAUDE.md invariant 6).
export const COMMAND_CENTER_ROLES: readonly Role[] = ['extension_officer', 'agronomist', 'admin']

// CEIH: who may approve an advance for an org. The org's own credit team; in the demo, a Command
// Center account stands in for it (the seeded org has no credit accounts). Whoever approves, the
// approver must not be an officer whose verification the advance rests on (invariant 11).
export const ADVANCE_APPROVER_ROLES: readonly Role[] = ['credit', ...COMMAND_CENTER_ROLES]
