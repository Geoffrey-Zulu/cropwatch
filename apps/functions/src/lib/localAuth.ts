import { execSync } from 'node:child_process'
import { OAuth2Client } from 'google-auth-library'

// For local tools only, never on Cloud Run: a short-lived token from gcloud for the authorized
// account, so a script can never pick up another logged-in identity through ADC
// (CLAUDE.md Environment).
export const AUTHORIZED_ACCOUNT = 'zulugeoffrey034@gmail.com'

// A command string rather than execFile because gcloud is a .cmd shim on Windows; the account
// must be a plain email, so nothing user-supplied reaches the shell.
export function gcloudAccessToken(account = AUTHORIZED_ACCOUNT) {
  if (!/^[\w.+-]+@[\w.-]+$/.test(account)) throw new Error(`Not an account email: ${account}`)
  return execSync(`gcloud auth print-access-token --account=${account}`, {
    encoding: 'utf8',
  }).trim()
}

export function gcloudAuthClient(account = AUTHORIZED_ACCOUNT) {
  const client = new OAuth2Client()
  client.setCredentials({ access_token: gcloudAccessToken(account) })
  return client
}
