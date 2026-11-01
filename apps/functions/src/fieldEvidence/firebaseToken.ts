import { OAuth2Client } from 'google-auth-library'

// Verify Firebase's signed JWT using its public certificates. This service needs no
// service-account key and never accepts a caller-supplied owner or tenant id.
export function fieldTokenVerifier(projectId: string) {
  const client = new OAuth2Client()
  let certs: Record<string, string> = {}
  let expires = 0
  return async (token: string) => {
    if (Date.now() > expires) {
      const response = await fetch(
        'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
        { signal: AbortSignal.timeout(10000) }
      )
      if (!response.ok) throw new Error('Certificate lookup failed')
      certs = (await response.json()) as Record<string, string>
      const age = Number(
        /max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1] ?? 300
      )
      expires = Date.now() + Math.min(age, 3600) * 1000
    }
    const ticket = await client.verifySignedJwtWithCertsAsync(token, certs, projectId, [
      `https://securetoken.google.com/${projectId}`,
    ])
    const payload = ticket.getPayload()
    if (!payload?.sub || payload.sub.length > 128) throw new Error('Invalid subject')
    return payload.sub
  }
}
