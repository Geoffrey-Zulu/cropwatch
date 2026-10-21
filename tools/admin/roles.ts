import { OFFICER_ROLES, type OfficerRole } from '@repo/shared'

export interface SetRoleArgs {
  target: { email: string } | { uid: string }
  // null clears the officer role: the user is a farmer again.
  role: OfficerRole | null
  org: string | null
}

export const USAGE = `Usage:
  pnpm --filter @repo/admin-tools set-role --email <email> --role <role> [--org <orgId>]
  pnpm --filter @repo/admin-tools set-role --uid <uid> --role <role> [--org <orgId>]
  pnpm --filter @repo/admin-tools set-role --email <email> --clear

Roles: ${OFFICER_ROLES.join(', ')}. field_officer requires --org (outgrower staff see their own
org only). The user picks the claim up on their next ID-token refresh (sign out and in).`

export function parseArgs(argv: string[]): SetRoleArgs {
  const flags = new Map<string, string | true>()
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--') continue
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`)
    const next = argv[i + 1]
    if (next !== undefined && !next.startsWith('--')) {
      flags.set(arg.slice(2), next)
      i++
    } else {
      flags.set(arg.slice(2), true)
    }
  }
  const text = (name: string) => {
    const value = flags.get(name)
    if (value === true) throw new Error(`--${name} needs a value`)
    return value ?? null
  }

  const email = text('email')
  const uid = text('uid')
  if (!email === !uid) throw new Error('Give exactly one of --email or --uid')

  const clear = flags.get('clear') === true
  const roleText = text('role')
  if (clear === (roleText !== null)) throw new Error('Give exactly one of --role or --clear')
  if (roleText !== null && !(OFFICER_ROLES as readonly string[]).includes(roleText)) {
    throw new Error(`Unknown role "${roleText}". Roles: ${OFFICER_ROLES.join(', ')}`)
  }
  const role = roleText as OfficerRole | null

  const org = text('org')
  if (role === 'field_officer' && !org) throw new Error('field_officer needs --org <orgId>')
  if (clear && org) throw new Error('--clear removes the org too; drop --org')

  return { target: email ? { email } : { uid: uid! }, role, org }
}

// Merges into the user's existing custom claims, so unrelated claims survive.
export function nextClaims(
  existing: Record<string, unknown> | undefined,
  { role, org }: Pick<SetRoleArgs, 'role' | 'org'>
): Record<string, unknown> {
  const claims: Record<string, unknown> = { ...existing }
  delete claims.role
  delete claims.org_id
  if (role) claims.role = role
  if (role && org) claims.org_id = org
  return claims
}
