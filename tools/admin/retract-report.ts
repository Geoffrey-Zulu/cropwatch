// Undo one real test report end to end, as outbreak-e2e's cleanup does, for a report sent by
// hand or by the backup recording run (tools/visual/record-demo.ts): its recommendations, the
// observation and its internal records (diagnosis, recommendation, verification), its photos,
// then retracted in BigQuery and taken out of any cluster it joined (a cluster left under five
// reports goes, with its alert). Dry run unless --commit. Simulated reports are refused.
//
//   pnpm --filter @repo/admin-tools retract-report --obs <id> [--commit]
import { execSync } from 'node:child_process'
import { ACCOUNT, getDocument, PROJECT_ID } from '@repo/tools-gcp'
import { retractTestReports } from './retract'

const argv = process.argv.slice(2)
const obsId = argv[argv.indexOf('--obs') + 1]
const commit = argv.includes('--commit')
if (!argv.includes('--obs') || !obsId || !/^[A-Za-z0-9_-]{1,64}$/.test(obsId))
  throw new Error('usage: retract-report --obs <observation id> [--commit]')
if (obsId.startsWith('sim-'))
  throw new Error('refusing a simulated report: re-run the seed instead')

const BUCKET = 'crop-watch01.firebasestorage.app'
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`
const headers = {
  authorization: `Bearer ${execSync(`gcloud auth print-access-token --account=${ACCOUNT}`, { encoding: 'utf8' }).trim()}`,
  'x-goog-user-project': PROJECT_ID,
}

const observation = await getDocument(`observations/${obsId}`)
if (observation?.sim === true) throw new Error('refusing a simulated report')
console.log(
  observation
    ? `Report ${obsId}: ${observation.crop} in ${observation.district}, created ${observation.created_at}`
    : `Report ${obsId}: no observation document (cleaning up what is left)`
)

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
const docs = [
  ...recs.flatMap(r => (r.document ? [r.document.name.split('/documents/')[1]] : [])),
  ...[
    'internal/diagnosis',
    'internal/diagnosis_lock',
    'internal/recommendation',
    'internal/recommendation_lock',
    'internal/verification',
  ].map(d => `observations/${obsId}/${d}`),
  `observations/${obsId}`,
]
const listed = (await (
  await fetch(
    `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o?prefix=observations/&fields=items(name)`,
    { headers }
  )
).json()) as { items?: { name: string }[] }
const photos = (listed.items ?? []).map(i => i.name).filter(n => n.includes(`/${obsId}/`))

console.log(`Documents: ${docs.length} (${recs.filter(r => r.document).length} recommendation(s))`)
console.log(`Photos: ${photos.join(', ') || 'none'}`)
if (!commit) {
  console.log('\nDry run: nothing changed. Add --commit to delete and retract.')
  process.exit(0)
}

for (const path of docs) await fetch(`${FIRESTORE}/${path}`, { method: 'DELETE', headers })
for (const name of photos)
  await fetch(
    `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(name)}`,
    {
      method: 'DELETE',
      headers,
    }
  )
const outbreaks = await retractTestReports([obsId])
console.log(
  `\nDeleted the documents and photos; retracted in BigQuery; ${outbreaks.removed} cluster/alert(s) removed, ${outbreaks.clustersTrimmed} trimmed.`
)
