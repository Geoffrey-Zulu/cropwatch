import { z } from '../zod'

// User roles (technicaldoc.md §4.1). Officers carry `role` as a Firebase Auth custom claim;
// infra/firestore.rules and infra/storage.rules check these exact strings.
export const ROLES = [
  'farmer',
  'field_officer',
  'extension_officer',
  'agronomist',
  'admin',
] as const

export const RoleSchema = z.enum(ROLES).openapi('Role')
export type Role = z.infer<typeof RoleSchema>

// Roles that may verify (confirm or correct) a diagnosis.
export const OFFICER_ROLES = ['field_officer', 'extension_officer', 'agronomist', 'admin'] as const
export type OfficerRole = (typeof OFFICER_ROLES)[number]

// Command Center roles: the national view with precise report locations (isCommandCenter in
// infra/firestore.rules). field_officer is deliberately absent (CLAUDE.md invariant 6).
export const COMMAND_CENTER_ROLES: readonly Role[] = ['extension_officer', 'agronomist', 'admin']
