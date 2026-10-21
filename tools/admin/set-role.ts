// Sets (or clears) an officer's `role` custom claim, plus `org_id` for field officers. The API
// and infra/*.rules authorise from these claims.
//
// Authenticates as the authorized account through gcloud, never through whatever ADC holds:
//   gcloud auth login zulugeoffrey034@gmail.com   (once)
import { execSync } from 'node:child_process'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { nextClaims, parseArgs, USAGE } from './roles'

const PROJECT_ID = 'crop-watch01'
const ACCOUNT = 'zulugeoffrey034@gmail.com'

// Identity Toolkit refuses user credentials without a quota project; the Admin SDK sends this
// one as x-goog-user-project.
process.env.GOOGLE_CLOUD_QUOTA_PROJECT ??= PROJECT_ID

// gcloud is a .cmd shim on Windows, hence a command string; nothing user-supplied reaches it.
function gcloudAccessToken() {
  return execSync(`gcloud auth print-access-token --account=${ACCOUNT}`, {
    encoding: 'utf8',
  }).trim()
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const app = initializeApp({
    projectId: PROJECT_ID,
    credential: {
      getAccessToken: async () => ({ access_token: gcloudAccessToken(), expires_in: 3000 }),
    },
  })
  const auth = getAuth(app)

  const user =
    'email' in args.target
      ? await auth.getUserByEmail(args.target.email)
      : await auth.getUser(args.target.uid)
  await auth.setCustomUserClaims(user.uid, nextClaims(user.customClaims, args))

  const after = (await auth.getUser(user.uid)).customClaims ?? {}
  console.log(
    `${user.email ?? user.uid} (${user.uid}): ${JSON.stringify(user.customClaims ?? {})} → ${JSON.stringify(after)}`
  )
  console.log('Takes effect on their next ID-token refresh (sign out and back in).')
}

main().catch((error: unknown) => {
  // Code and message only: SDK errors carry request headers, including the access token.
  const { code, message } = error as { code?: string; message?: string }
  const usage = code ? '' : `\n\n${USAGE}`
  console.error(`${code ? `${code}: ` : ''}${message ?? String(error)}${usage}`)
  process.exit(code ? 1 : 2)
})
