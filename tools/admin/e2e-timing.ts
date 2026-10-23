// Times the deployed pipeline end to end, playing the mobile app for each photo in a labelled
// set: upload → POST /observations → diagnosis → recommendation → complete, against the 30 s
// line, and checks buildplan §4.3 on every live recommendation. Deletes what it made.
//
//   pnpm --filter @repo/admin-tools e2e-timing --dir <photos with labels.json> [--verify] [--keep]
//
// labels.json: [{ "file", "crop", "expect" }] (the diagnose eval's format).
// --verify also has a temporary agronomist correct one complete report's issue and checks the
// recommendation re-runs for the new issue (the frozen contract's re-trigger).
import { execSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { OFFICER_REFERRAL, type Crop, type Issue } from '@repo/shared'

const PROJECT_ID = 'crop-watch01'
const ACCOUNT = 'zulugeoffrey034@gmail.com'
const WEB_API_KEY = 'AIzaSyB6brxOl9sgWsf7X059B1rZvLiWXCPDTqU' // public client config
const BUCKET = `${PROJECT_ID}.firebasestorage.app`
const API = process.env.API_URL ?? 'https://cropwatch-api-24960589333.europe-west1.run.app/api/v1'
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`
const BUDGET_S = 30
const TIMEOUT_S = 120
// The embedding quota in the RAG region is about 7 requests a minute: one report every 10 s
// keeps the run inside it, as a real demo would be.
const SPACING_MS = 10_000

process.env.GOOGLE_CLOUD_QUOTA_PROJECT ??= PROJECT_ID

const argv = process.argv.slice(2).filter(arg => arg !== '--')
const dirArg = argv[argv.indexOf('--dir') + 1]
if (!argv.includes('--dir') || !dirArg) {
  throw new Error('usage: e2e-timing --dir <photos with labels.json> [--verify] [--keep]')
}
const dir = resolve(process.env.INIT_CWD ?? process.cwd(), dirArg)
const keep = argv.includes('--keep')
const doVerify = argv.includes('--verify')
const labels = JSON.parse(readFileSync(join(dir, 'labels.json'), 'utf8')) as {
  file: string
  crop: Crop
  expect: Issue
}[]

const adminToken = () =>
  execSync(`gcloud auth print-access-token --account=${ACCOUNT}`, { encoding: 'utf8' }).trim()
const adminHeaders = () => ({
  authorization: `Bearer ${adminToken()}`,
  'x-goog-user-project': PROJECT_ID,
})
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function signInAnonymously() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${WEB_API_KEY}`,
    { method: 'POST', body: JSON.stringify({ returnSecureToken: true }) }
  )
  const body = (await res.json()) as { idToken: string; localId: string }
  return { idToken: body.idToken, uid: body.localId }
}

const api = (idToken: string, path: string, init: RequestInit = {}) =>
  fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${idToken}`, 'content-type': 'application/json' },
  })

interface View {
  status: string
  diagnosis: { suspected_issue: string; confidence_band: string } | null
  verified_issue: string | null
  recommendation: {
    ipm_steps: string[]
    chemical_options: { registration_no: string; label_dose: string }[]
    officer_referral: boolean
    sources: { title: string; tier: number; uri: string }[]
  } | null
}

// Waits until the observation leaves `from` statuses; returns the view and when each status
// was first seen.
async function waitFor(
  idToken: string,
  obsId: string,
  started: number,
  done: (v: View) => boolean
) {
  const seen: Record<string, number> = {}
  let view = {} as View
  while ((Date.now() - started) / 1000 < TIMEOUT_S) {
    view = (await (await api(idToken, `/observations/${obsId}`)).json()) as View
    seen[view.status] ??= (Date.now() - started) / 1000
    if (done(view)) break
    await sleep(500)
  }
  return { view, seen, seconds: (Date.now() - started) / 1000 }
}

// Every chemical shown must be a registered row, its dose byte-identical (buildplan §4.3).
async function registeredDoses() {
  const doses = new Map<string, string>()
  let pageToken = ''
  do {
    const body = (await (
      await fetch(
        `${FIRESTORE}/registered_products?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`,
        { headers: adminHeaders() }
      )
    ).json()) as {
      documents?: { fields: Record<string, { stringValue?: string }> }[]
      nextPageToken?: string
    }
    for (const doc of body.documents ?? []) {
      doses.set(doc.fields.registration_no.stringValue!, doc.fields.label_dose.stringValue!)
    }
    pageToken = body.nextPageToken ?? ''
  } while (pageToken)
  return doses
}

let failures = 0
function check(ok: boolean, label: string) {
  if (!ok) {
    failures++
    console.log(`    FAIL  ${label}`)
  }
}

function checkRecommendation(view: View, doses: Map<string, string>) {
  const rec = view.recommendation
  if (!rec) return
  check(rec.sources.length >= 1, 'carries at least one citation')
  for (const option of rec.chemical_options) {
    check(
      doses.get(option.registration_no) === option.label_dose,
      `${option.registration_no}: label_dose byte-identical to the register`
    )
  }
  if (rec.chemical_options.length === 0) {
    check(
      rec.officer_referral && rec.ipm_steps[rec.ipm_steps.length - 1] === OFFICER_REFERRAL,
      'zero chemicals → IPM-only plus officer referral'
    )
  }
  check(!/probabilit|\d+\s*%/i.test(JSON.stringify(rec)), 'no probabilities or percentages')
}

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]
}

const created: { obsId: string; idToken: string; photoPath: string }[] = []
const doses = await registeredDoses()
const rows: {
  file: string
  outcome: string
  diagnosed: number
  done: number
  issue: string
}[] = []

console.log(`${labels.length} photos → ${API}\n`)
for (const label of labels) {
  const farmer = await signInAnonymously()
  const obsId = randomBytes(15).toString('base64url')
  const photoPath = `observations/${farmer.uid}/${obsId}/0.jpg`
  created.push({ obsId, idToken: farmer.idToken, photoPath })
  const photo = readFileSync(join(dir, label.file))

  // The clock starts when the farmer sends: photo upload, then the report.
  const started = Date.now()
  const uploaded = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(photoPath)}`,
    {
      method: 'POST',
      headers: { authorization: `Firebase ${farmer.idToken}`, 'content-type': 'image/jpeg' },
      body: new Uint8Array(photo),
    }
  )
  check(uploaded.ok, `${label.file}: upload`)
  const res = await api(farmer.idToken, '/observations', {
    method: 'POST',
    body: JSON.stringify({
      obs_id: obsId,
      crop: label.crop,
      location: { latitude: -15.48, longitude: 28.7 },
      district: 'Chongwe',
      province: 'Lusaka',
      photo_paths: [photoPath],
      farmer_description: 'e2e timing',
    }),
  })
  check(res.status === 201, `${label.file}: POST /observations → 201`)

  const { view, seen, seconds } = await waitFor(
    farmer.idToken,
    obsId,
    started,
    v => v.status === 'complete' || v.status === 'awaiting_expert_review'
  )
  const diagnosed = Math.min(
    seen.recommending ?? Infinity,
    seen.complete ?? Infinity,
    seen.awaiting_expert_review ?? Infinity
  )
  checkRecommendation(view, doses)
  rows.push({
    file: label.file,
    outcome: view.status,
    diagnosed,
    done: seconds,
    issue: view.diagnosis?.suspected_issue ?? '-',
  })
  console.log(
    [
      label.file.padEnd(24),
      `${view.diagnosis?.suspected_issue ?? '-'} (${view.diagnosis?.confidence_band ?? '-'})`.padEnd(
        32
      ),
      `diagnosed ${diagnosed.toFixed(1)} s`.padEnd(18),
      `${view.status} ${seconds.toFixed(1)} s`.padEnd(32),
      view.recommendation
        ? `${view.recommendation.ipm_steps.length} steps, ${view.recommendation.sources.length} sources`
        : '',
    ].join(' ')
  )
  await sleep(SPACING_MS)
}

const completeTimes = rows.filter(r => r.outcome === 'complete').map(r => r.done)
const allTimes = rows.map(r => r.done)
console.log(
  `\nPhoto → final status, all ${allTimes.length}: p50 ${percentile(allTimes, 50).toFixed(1)} s, p95 ${percentile(allTimes, 95).toFixed(1)} s, max ${Math.max(...allTimes).toFixed(1)} s`
)
if (completeTimes.length) {
  console.log(
    `Photo → complete (with recommendation), ${completeTimes.length}: p50 ${percentile(completeTimes, 50).toFixed(1)} s, p95 ${percentile(completeTimes, 95).toFixed(1)} s`
  )
}
check(percentile(allTimes, 95) < BUDGET_S, `p95 under the ${BUDGET_S} s line`)

if (doVerify) {
  console.log('\nVerify re-trigger (temporary agronomist)')
  const target = rows.findIndex(r => r.outcome === 'complete')
  if (target < 0) {
    check(false, 'a complete observation to correct')
  } else {
    const app = initializeApp({
      projectId: PROJECT_ID,
      credential: {
        getAccessToken: async () => ({ access_token: adminToken(), expires_in: 3000 }),
      },
    })
    const auth = getAuth(app)
    const email = `e2e-agronomist-${randomBytes(4).toString('hex')}@example.invalid`
    const password = randomBytes(18).toString('base64url')
    const user = await auth.createUser({ email, password })
    try {
      await auth.setCustomUserClaims(user.uid, { role: 'agronomist' })
      const signIn = (await (
        await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${WEB_API_KEY}`,
          { method: 'POST', body: JSON.stringify({ email, password, returnSecureToken: true }) }
        )
      ).json()) as { idToken: string }
      const { obsId } = created[target]
      const from = rows[target].issue
      const to: Issue = from === 'late_blight' ? 'early_blight' : 'late_blight'
      const started = Date.now()
      const res = await api(signIn.idToken, `/observations/${obsId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ verified_issue: to, notes: 'e2e re-trigger check' }),
      })
      const after = (await res.json()) as View
      check(res.status === 200 && after.status === 'recommending', 'verify → 200, recommending')
      const { view, seconds } = await waitFor(
        signIn.idToken,
        obsId,
        started,
        v => v.status !== 'recommending'
      )
      check(view.status === 'complete' && view.verified_issue === to, `complete again for ${to}`)
      checkRecommendation(view, doses)
      console.log(
        `    ${from} → ${to}: ${view.status} in ${seconds.toFixed(1)} s; first step: ${view.recommendation?.ipm_steps[0]}`
      )
    } finally {
      await auth.deleteUser(user.uid)
    }
  }
}

if (!keep) {
  const headers = adminHeaders()
  for (const { obsId, idToken, photoPath } of created) {
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
      if (document)
        await fetch(`https://firestore.googleapis.com/v1/${document.name}`, {
          method: 'DELETE',
          headers,
        })
    }
    for (const doc of [
      'internal/diagnosis',
      'internal/diagnosis_lock',
      'internal/recommendation',
      'internal/recommendation_lock',
      'internal/verification',
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
    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${WEB_API_KEY}`, {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    })
  }
  console.log(
    `\nCleaned up ${created.length} observations, their recommendations, photos and test users.`
  )
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed.')
process.exitCode = failures ? 1 : 0
