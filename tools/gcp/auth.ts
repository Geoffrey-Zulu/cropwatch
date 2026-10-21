import { execSync } from 'node:child_process'

export const PROJECT_ID = 'crop-watch01'
export const REGION = 'europe-west1'
// CLAUDE.md: every operator action runs as this account, never via whatever ADC holds.
export const ACCOUNT = 'zulugeoffrey034@gmail.com'

let cached: { token: string; expires: number } | null = null

// gcloud is a .cmd shim on Windows, hence a command string; nothing user-supplied reaches it.
export function accessToken() {
  if (!cached || Date.now() > cached.expires) {
    const token = execSync(`gcloud auth print-access-token --account=${ACCOUNT}`, {
      encoding: 'utf8',
    }).trim()
    // gcloud tokens live an hour; refresh well before.
    cached = { token, expires: Date.now() + 45 * 60_000 }
  }
  return cached.token
}

export function authHeaders(): Record<string, string> {
  return { authorization: `Bearer ${accessToken()}`, 'x-goog-user-project': PROJECT_ID }
}

// Fetch as the authorized account. Errors carry status and body, never the request headers.
export async function gcpFetch(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...authHeaders(), ...init.headers },
  })
  if (!response.ok) {
    const method = init.method ?? 'GET'
    throw new Error(`${method} ${url} → HTTP ${response.status}: ${await response.text()}`)
  }
  return response
}
