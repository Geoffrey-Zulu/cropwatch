// D6 acceptance against the deployed API (buildplan §4.5, §4.6): plays the presenter's report
// after `seed --commit --live-demo` has armed four qualifying reports at the venue, then times
// report → cluster (≤ 60 s) → alert → dispatch (push + SMS), and checks what the farmer's app
// and the risk panel get. Deletes what it made and retracts the report, which takes the cluster
// it completed with it, so the seeded demo stays armed for the next run.
//
//   pnpm --filter @repo/admin-tools outbreak-e2e --image <tuta photo.jpg>
//        [--center -15.4167,28.2833] [--district Lusaka] [--crop tomato] [--keep]
import { execSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AlertListSchema, districtSlug, findDistrict } from '@repo/shared'
import { getDocument, queryArrayContainsAny } from '@repo/tools-gcp'
import { retractTestReports } from './retract'

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
if (!imagePath) throw new Error('usage: outbreak-e2e --image <tuta photo.jpg> [--center lat,lng]')
const [latitude, longitude] = (flag('center') ?? '-15.4167,28.2833').split(',').map(Number)
const district = findDistrict(flag('district') ?? 'Lusaka')
if (!district) throw new Error('unknown --district')
const crop = flag('crop') ?? 'tomato'
const keep = argv.includes('--keep')

let failures = 0
function check(ok: boolean, label: string, detail = '') {
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`)
}
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const adminHeaders = () => ({
  authorization: `Bearer ${execSync(`gcloud auth print-access-token --account=${ACCOUNT}`, { encoding: 'utf8' }).trim()}`,
  'x-goog-user-project': PROJECT_ID,
})

const signUp = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${WEB_API_KEY}`,
  { method: 'POST', body: JSON.stringify({ returnSecureToken: true }) }
)
const farmer = (await signUp.json()) as { idToken: string; localId: string }
const api = (path: string, init: RequestInit = {}) =>
  fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${farmer.idToken}`, 'content-type': 'application/json' },
  })

const obsId = randomBytes(15).toString('base64url')
const photoPath = `observations/${farmer.localId}/${obsId}/0.jpg`
const photo = readFileSync(resolve(process.env.INIT_CWD ?? process.cwd(), imagePath))
// ~1 km from the venue: inside the 10 km rule, not on top of an armed report.
const location = { latitude: latitude + 0.006, longitude: longitude + 0.006 }

async function poll<T>(what: () => Promise<T | null>, timeoutMs: number, everyMs = 1000) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    const value = await what()
    if (value) return value
    await sleep(everyMs)
  }
  return null
}

try {
  console.log(
    `Presenter report ${obsId} at ${location.latitude},${location.longitude} (${district.name})\n`
  )
  const uploaded = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(photoPath)}`,
    {
      method: 'POST',
      headers: { authorization: `Firebase ${farmer.idToken}`, 'content-type': 'image/jpeg' },
      body: new Uint8Array(photo),
    }
  )
  check(uploaded.ok, 'photo uploaded', `HTTP ${uploaded.status}`)

  const started = Date.now()
  const created = await api('/observations', {
    method: 'POST',
    body: JSON.stringify({
      obs_id: obsId,
      crop,
      location,
      district: district.name,
      province: district.province,
      photo_paths: [photoPath],
      farmer_description: 'outbreak e2e (presenter rehearsal)',
    }),
  })
  check(created.status === 201, 'POST /observations → 201')

  const diagnosed = await poll(async () => {
    const view = (await (await api(`/observations/${obsId}`)).json()) as {
      status: string
      diagnosis?: { suspected_issue: string; confidence_band: string } | null
    }
    return view.diagnosis ? view : null
  }, 90_000)
  const issue = diagnosed?.diagnosis?.suspected_issue
  console.log(
    `\n  diagnosed in ${seconds(Date.now() - started)}: ${issue} (${diagnosed?.diagnosis?.confidence_band} confidence)`
  )
  check(issue === 'tuta_absoluta', 'diagnosed as the armed issue')

  console.log('\n§4.5 cluster within 60 s of the qualifying report')
  const cluster = await poll(async () => {
    const [found] = await queryArrayContainsAny('clusters', 'members', [obsId])
    return found ?? null
  }, 90_000)
  const clusterMs = Date.now() - started
  check(
    !!cluster && clusterMs <= 60_000,
    'cluster stored with the report in it',
    seconds(clusterMs)
  )
  if (!cluster) throw new Error('no cluster: is the demo armed? (seed --commit --live-demo)')
  const members = cluster.data.members as string[]
  console.log(`  ${cluster.path}: ${members.length} reports, sim ${cluster.data.sim}`)
  check(cluster.data.active === true && members.length >= 5, 'cluster is active with ≥ 5 reports')

  const alertId = await poll(async () => {
    const doc = await getDocument(cluster.path)
    return (doc?.alert_id as string | null) ?? null
  }, 30_000)
  check(!!alertId, 'a new-cluster alert was raised', alertId ?? 'none')
  if (!alertId) throw new Error('no alert: the cluster may have grown an existing one')

  console.log('\n§4.6 dispatch (push + SMS)')
  const alert = await getDocument(`alerts/${alertId}`)
  const alertAt = Date.parse(String(alert?.created_at))
  const dispatch = await poll(async () => {
    const doc = await getDocument(`alerts/${alertId}/internal/dispatch`)
    return doc?.state === 'sent' ? doc : null
  }, 60_000)
  const dispatchedMs = Date.now() - started
  check(!!dispatch, 'dispatch finished', dispatch ? `state ${dispatch.state}` : 'timed out')
  if (dispatch) {
    const finished = Date.parse(String(dispatch.finished_at))
    const fcm = dispatch.fcm as Record<string, unknown>
    const sms = dispatch.sms as Record<string, unknown>
    console.log(
      `  report → alert ${seconds(alertAt - started)}, alert → dispatched ${seconds(finished - alertAt)}, report → dispatched ${seconds(finished - started)} (seen at ${seconds(dispatchedMs)})`
    )
    console.log(
      `  fcm: topic ${fcm.topic} ok=${fcm.topic_ok}, web tokens sent ${fcm.web_sent}, failed ${fcm.web_failed}`
    )
    console.log(
      `  sms: ${sms.gateway}, recipients ${sms.recipients}, sent ${sms.sent}, failed ${sms.failed}${sms.error ? `, error ${sms.error}` : ''}`
    )
    check(fcm.topic_ok === true, 'FCM topic send accepted', String(fcm.topic_error ?? ''))
    check(!fcm.web_error, 'web-push lookup and send ran', String(fcm.web_error ?? ''))
    check(
      finished - started <= 30_000,
      'report → dispatched within 30 s',
      seconds(finished - started)
    )
  }

  console.log('\nWhat the app and the risk panel see')
  const list = AlertListSchema.safeParse(
    await (await api(`/alerts?district=${encodeURIComponent(district.name)}`)).json()
  )
  const view = list.success ? list.data.alerts.find(a => a.alert_id === alertId) : undefined
  check(!!view, 'GET /alerts lists it in the contract shape')
  if (view) {
    console.log(`  ${view.level}: ${view.issue_label} near ${view.district}`)
    for (const factor of view.contributing_factors) console.log(`    · ${factor}`)
    check(view.contributing_factors.length > 0, 'level comes with contributing factors')
    check(view.sim === members.some(id => id.startsWith('sim-')), 'sim flag follows the members')
    check(!/probab/i.test(JSON.stringify(view)), 'no probabilities anywhere')
  }
  const risk = await getDocument(`risk/${districtSlug(district.name)}`)
  check(
    !!risk && Array.isArray(risk.contributing_factors) && risk.contributing_factors.length > 0,
    `risk/${districtSlug(district.name)} has a level and factors`,
    String(risk?.level)
  )
} finally {
  if (keep) {
    console.log(`\n--keep: left observation ${obsId}, its cluster and alert`)
  } else {
    const headers = adminHeaders()
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
      body: JSON.stringify({ idToken: farmer.idToken }),
    })
    const outbreaks = await retractTestReports([obsId])
    console.log(
      `\nCleaned up the report, recommendation, photo and user; retracted it in BigQuery; ${outbreaks.removed} cluster/alert(s) removed, ${outbreaks.clustersTrimmed} trimmed.`
    )
  }
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed.')
process.exit(failures ? 1 : 0)
