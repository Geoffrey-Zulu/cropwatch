// End-to-end smoke test against the deployed API, playing the mobile app: anonymous sign-in →
// photo upload to Storage → POST /observations → wait for the diagnosis. Then checks the
// contract invariants and the security rules on the live project, and deletes what it made.
//
//   pnpm --filter @repo/admin-tools smoke-e2e --image <photo.jpg> [--crop maize] [--post-first] [--keep]
//
// --post-first reports before uploading the photo, so the API's own diagnosis attempt finds no
// photo and only the Eventarc Storage-finalize event can trigger it: proves Eventarc works.
import { execSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PROJECT_ID = 'crop-watch01'
const ACCOUNT = 'zulugeoffrey034@gmail.com'
const WEB_API_KEY = 'AIzaSyB6brxOl9sgWsf7X059B1rZvLiWXCPDTqU' // public client config
const BUCKET = `${PROJECT_ID}.firebasestorage.app`
const API = process.env.API_URL ?? 'https://cropwatch-api-24960589333.europe-west1.run.app/api/v1'
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

const argv = process.argv.slice(2).filter(arg => arg !== '--')
const flag = (name: string) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? (argv[i + 1] ?? '') : null
}
const imagePath = flag('image')
if (!imagePath)
  throw new Error('usage: smoke-e2e --image <photo.jpg> [--crop maize] [--post-first] [--keep]')
const crop = flag('crop') ?? 'maize'
const keep = argv.includes('--keep')
const postFirst = argv.includes('--post-first')

let failures = 0
function check(ok: boolean, label: string, detail = '') {
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`)
}

const adminToken = () =>
  execSync(`gcloud auth print-access-token --account=${ACCOUNT}`, { encoding: 'utf8' }).trim()
const adminHeaders = () => ({
  authorization: `Bearer ${adminToken()}`,
  'x-goog-user-project': PROJECT_ID,
})

async function signInAnonymously() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${WEB_API_KEY}`,
    { method: 'POST', body: JSON.stringify({ returnSecureToken: true }) }
  )
  const body = (await res.json()) as { idToken: string; localId: string }
  return { idToken: body.idToken, uid: body.localId }
}

const upload = (idToken: string, path: string, bytes: Buffer) =>
  fetch(
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(path)}`,
    {
      method: 'POST',
      headers: { authorization: `Firebase ${idToken}`, 'content-type': 'image/jpeg' },
      body: new Uint8Array(bytes),
    }
  )

const api = (idToken: string, path: string, init: RequestInit = {}) =>
  fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${idToken}`, 'content-type': 'application/json' },
  })

const newObsId = () => randomBytes(15).toString('base64url')

const farmer = await signInAnonymously()
const other = await signInAnonymously()
const obsId = newObsId()
const photoPath = `observations/${farmer.uid}/${obsId}/0.jpg`
// pnpm --filter runs scripts in the package directory; resolve paths from where it was invoked.
const photo = readFileSync(resolve(process.env.INIT_CWD ?? process.cwd(), imagePath))
console.log(`farmer ${farmer.uid}, observation ${obsId}`)

try {
  console.log('\nStorage rules (live)')
  const foreign = await upload(other.idToken, photoPath, photo)
  check(foreign.status === 403, 'upload under another uid is refused', `HTTP ${foreign.status}`)
  const uploadOwn = async () => {
    const uploaded = await upload(farmer.idToken, photoPath, photo)
    check(uploaded.ok, 'upload under own uid succeeds', `HTTP ${uploaded.status}`)
  }
  if (!postFirst) await uploadOwn()

  console.log('\nREST v1')
  const health = await fetch(`${API}/health`)
  check(health.ok, 'GET /health', JSON.stringify(await health.json()))

  const report = {
    obs_id: obsId,
    crop,
    location: { latitude: -15.48, longitude: 28.7 },
    district: 'Chongwe',
    province: 'Lusaka',
    photo_paths: [photoPath],
    farmer_description: 'smoke test',
  }
  let started = Date.now()
  const created = await api(farmer.idToken, '/observations', {
    method: 'POST',
    body: JSON.stringify(report),
  })
  check(created.status === 201, 'POST /observations → 201', JSON.stringify(await created.json()))

  const retry = await api(farmer.idToken, '/observations', {
    method: 'POST',
    body: JSON.stringify(report),
  })
  check(retry.status === 200, 'same reporter retry → 200 (idempotent)')

  const hijack = await api(other.idToken, '/observations', {
    method: 'POST',
    body: JSON.stringify({
      ...report,
      photo_paths: [`observations/${other.uid}/${obsId}/0.jpg`],
    }),
  })
  check(hijack.status === 403, 'same obs_id from another uid → 403 (first writer wins)')

  if (postFirst) {
    console.log('\nEventarc: photo uploaded only now, so the Storage event must trigger diagnosis')
    await new Promise(resolve => setTimeout(resolve, 3000))
    const early = (await (await api(farmer.idToken, `/observations/${obsId}`)).json()) as {
      status?: string
    }
    check(early.status === 'diagnosing', 'no diagnosis without a photo', `status=${early.status}`)
    started = Date.now()
    await uploadOwn()
  }

  let view: Record<string, unknown> = {}
  while (Date.now() - started < 90_000) {
    view = (await (await api(farmer.idToken, `/observations/${obsId}`)).json()) as typeof view
    if (view.status !== 'diagnosing') break
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  const seconds = (Date.now() - started) / 1000
  const diagnosis = view.diagnosis as Record<string, unknown> | null
  check(view.status !== 'diagnosing', 'diagnosis landed', `${seconds.toFixed(1)} s`)
  check(seconds < 30, 'within the 30 s demo budget', `${seconds.toFixed(1)} s`)
  console.log(`        status=${view.status} diagnosis=${JSON.stringify(diagnosis)}`)
  check(
    typeof diagnosis?.confidence_band === 'string' && view.district_slug === 'chongwe',
    'view carries bands and district_slug'
  )
  const text = JSON.stringify(view)
  check(
    !/model_confidence|severity_pct|latitude|reporter_id/.test(text),
    'view has no confidence number, percentage, location or reporter'
  )

  const forbidden = await api(other.idToken, `/observations/${obsId}`)
  check(forbidden.status === 403, "another farmer can't read it", `HTTP ${forbidden.status}`)

  console.log('\nFirestore (live)')
  const internalUrl = `${FIRESTORE}/observations/${obsId}/internal/diagnosis`
  const internal = (await (await fetch(internalUrl, { headers: adminHeaders() })).json()) as {
    fields?: Record<string, { stringValue?: string; doubleValue?: number }>
  }
  check(
    internal.fields?.model_confidence !== undefined ||
      diagnosis?.expert_review_reason === 'invalid_model_output',
    'internal/diagnosis holds the numbers',
    `model_confidence=${JSON.stringify(internal.fields?.model_confidence)}`
  )
  check(
    internal.fields?.prompt_version?.stringValue === 'diagnose-v1' &&
      typeof internal.fields?.model_id?.stringValue === 'string',
    'prompt_version and model_id stamped',
    `${internal.fields?.model_id?.stringValue} / ${internal.fields?.prompt_version?.stringValue}`
  )
  const ownInternal = await fetch(internalUrl, {
    headers: { authorization: `Bearer ${farmer.idToken}` },
  })
  check(
    ownInternal.status === 403,
    "the reporter can't read internal numbers",
    `HTTP ${ownInternal.status}`
  )
} finally {
  if (keep) {
    console.log(`\n--keep: left observation ${obsId} and user ${farmer.uid}`)
  } else {
    const headers = adminHeaders()
    // The pipeline goes on to recommend: remove its recommendation too.
    const recs = (await (
      await fetch(`${FIRESTORE}:runQuery`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'recommendations' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'obs_id' },
                op: 'EQUAL',
                value: { stringValue: obsId },
              },
            },
          },
        }),
      })
    ).json()) as { document?: { name: string } }[]
    for (const { document } of recs) {
      if (document) {
        await fetch(`https://firestore.googleapis.com/v1/${document.name}`, {
          method: 'DELETE',
          headers,
        })
      }
    }
    for (const doc of [
      'internal/diagnosis',
      'internal/diagnosis_lock',
      'internal/recommendation',
      'internal/recommendation_lock',
      '',
    ]) {
      await fetch(`${FIRESTORE}/observations/${obsId}${doc ? `/${doc}` : ''}`, {
        method: 'DELETE',
        headers,
      })
    }
    await fetch(
      `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(photoPath)}`,
      { method: 'DELETE', headers }
    )
    for (const user of [farmer, other]) {
      await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${WEB_API_KEY}`, {
        method: 'POST',
        body: JSON.stringify({ idToken: user.idToken }),
      })
    }
    console.log('\ncleaned up: observation, internal docs, recommendation, photo, both test users')
  }
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed')
process.exit(failures ? 1 : 0)
