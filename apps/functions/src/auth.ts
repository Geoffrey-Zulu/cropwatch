import type { Auth } from 'firebase-admin/auth'
import { OAuth2Client } from 'google-auth-library'
import { RoleSchema } from '@repo/shared'
import { log } from './lib/log'
import type { Caller } from './services/observationModel'

export type VerifyIdToken = (idToken: string) => Promise<Caller>
export type VerifyEventarcToken = (idToken: string) => Promise<boolean>

export function bearerToken(header: string | undefined) {
  return /^Bearer (\S+)$/.exec(header ?? '')?.[1] ?? null
}

// Firebase ID token → caller. The role comes from the `role` custom claim; anything else
// (including anonymous sign-in) is a farmer.
export function firebaseTokenVerifier(auth: Auth): VerifyIdToken {
  return async idToken => {
    const token = await auth.verifyIdToken(idToken)
    const role = RoleSchema.safeParse(token.role)
    return {
      uid: token.uid,
      role: role.success ? role.data : 'farmer',
      orgId: typeof token.org_id === 'string' ? token.org_id : null,
    }
  }
}

// Eventarc pushes to the (publicly reachable) service with a Google-signed OIDC token for the
// trigger's service account. Accept only that account, for this service.
export function eventarcVerifier(serviceAccount: string | null): VerifyEventarcToken {
  const client = new OAuth2Client()
  return async idToken => {
    if (!serviceAccount) return false
    try {
      const payload = (await client.verifyIdToken({ idToken })).getPayload()
      const ok =
        payload?.email === serviceAccount &&
        payload.email_verified === true &&
        typeof payload.aud === 'string' &&
        payload.aud.startsWith('https://cropwatch-api-') &&
        payload.aud.includes('.run.app')
      if (!ok)
        log('WARNING', 'eventarc token rejected', { email: payload?.email, aud: payload?.aud })
      return ok
    } catch (error) {
      log('WARNING', 'eventarc token invalid', { error: String(error) })
      return false
    }
  }
}
