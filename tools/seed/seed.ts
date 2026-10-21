// Seeds simulated demo data (technicaldoc §12): ~500 sim: true observations over 21 days, the
// Eastern FAW and Lusaka/Chongwe Tuta storylines, DEMO OUTGROWER CO. No model is called.
//
//   pnpm --filter @repo/seed seed                     dry run: summary and checks only
//   pnpm --filter @repo/seed seed --commit            replace sim data in Firestore + BigQuery
//   pnpm --filter @repo/seed seed --commit --live-demo [--demo-issue tuta_absoluta]
//        [--demo-center -15.4167,28.2833] [--demo-district Lusaka]
//   --anchor <ISO time>   "now" for the data (default: now). Same anchor, same data.
//
// --live-demo pre-arms the rehearsed sequence: four qualifying reports near the venue, so the
// presenter's real report is the fifth and completes the cluster. Seed within ~18 h of the pitch.
import {
  distanceKm,
  findDistrict,
  KnownIssueSchema,
  OBSERVATION_ROW_BIGQUERY_SCHEMA,
  toObservationRow,
  type Observation,
} from '@repo/shared'
import {
  commit,
  ensureTable,
  FsGeoPoint,
  FsTimestamp,
  loadRows,
  PROJECT_ID,
  query,
  queryPaths,
  type FsValue,
  type Write,
} from '@repo/tools-gcp'
import { clusters, CLUSTER_RADIUS_KM, CLUSTER_WINDOW_HOURS, qualifying } from './cluster'
import { clusterPoints, generateSeed, type LiveDemoOptions, type SeedData } from './generate'

const DATASET = 'cropwatch'
const TABLE = 'observations'

// Accepts both --name value and --name=value. Unknown flags are an error: a mistyped venue must
// never silently fall back to the default.
const VALUE_FLAGS = ['anchor', 'demo-issue', 'demo-center', 'demo-district']
const SWITCHES = ['commit', 'live-demo']
const values = new Map<string, string>()
const switches = new Set<string>()
const argv = process.argv.slice(2).filter(arg => arg !== '--')
for (let i = 0; i < argv.length; i++) {
  const [name, inline] = argv[i].replace(/^--/, '').split(/=(.*)/s)
  if (SWITCHES.includes(name) && inline === undefined) switches.add(name)
  else if (VALUE_FLAGS.includes(name)) {
    const value = inline ?? argv[++i]
    if (value === undefined) throw new Error(`--${name} needs a value`)
    values.set(name, value)
  } else throw new Error(`Unknown argument ${argv[i]}`)
}
const apply = switches.has('commit')

const anchor =
  values.get('anchor') ?? new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString()
if (Number.isNaN(Date.parse(anchor))) throw new Error(`--anchor is not a time: ${anchor}`)
let liveDemo: LiveDemoOptions | null = null
if (switches.has('live-demo')) {
  const [latitude, longitude] = (values.get('demo-center') ?? '-15.4167,28.2833')
    .split(',')
    .map(Number)
  if (!(latitude >= -18.1 && latitude <= -8.2 && longitude >= 21.9 && longitude <= 33.75)) {
    throw new Error('--demo-center must be "latitude,longitude" inside Zambia')
  }
  const district = values.get('demo-district') ?? 'Lusaka'
  if (!findDistrict(district)) throw new Error(`Unknown --demo-district ${district}`)
  liveDemo = {
    issue: KnownIssueSchema.parse(values.get('demo-issue') ?? 'tuta_absoluta'),
    center: { latitude, longitude },
    district,
  }
}

const data = generateSeed({ anchor, liveDemo })
summarise(data)
const problems = check(data)
if (problems.length) {
  console.error(`\nChecks failed; nothing written:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}

if (!apply) {
  console.log('\nDry run. Re-run with --commit to replace the sim data in Firestore and BigQuery.')
} else {
  await writeFirestore(data)
  await writeBigQuery(data)
  console.log('\nDone.')
}

function count<T>(items: T[], key: (item: T) => string) {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1)
  return [...counts].map(([k, n]) => `${k} ${n}`).join(', ')
}

function summarise({ observations, users, liveDemo: demo }: SeedData) {
  const times = observations.map(o => o.observation.created_at).sort()
  console.log(`Anchor ${anchor}: ${observations.length} observations, ${users.length} users, 1 org`)
  console.log(`  from ${times[0]} to ${times[times.length - 1]}`)
  console.log(`  storylines: ${count(observations, o => o.storyline)}`)
  console.log(`  provinces: ${count(observations, o => o.observation.province)}`)
  console.log(`  verification: ${count(observations, o => o.observation.verification_state)}`)
  console.log(`  status: ${count(observations, o => o.observation.status)}`)
  console.log('\nClusters at the anchor (technicaldoc §9 rule):')
  for (const cluster of clusters(clusterPoints(data), anchor)) {
    const districts = new Set(
      cluster.members.map(id => observations.find(o => o.id === id)!.observation.district)
    )
    console.log(
      `  ${cluster.issue}: ${cluster.members.length} reports (${[...districts].join(', ')})`
    )
  }
  if (demo) {
    // The cluster stays one report short until the oldest pre-armed report leaves the window.
    const oldest = Math.min(
      ...demo.armed.map(id =>
        Date.parse(observations.find(o => o.id === id)!.observation.created_at)
      )
    )
    const expires = new Date(oldest + CLUSTER_WINDOW_HOURS * 3_600_000).toISOString()
    console.log(
      `\nLive demo: ${demo.armed.length} qualifying ${demo.issue} reports within ${CLUSTER_RADIUS_KM} km of ${demo.center.latitude},${demo.center.longitude} (${demo.district}).`
    )
    console.log(
      `  The presenter's report completes the cluster if it is diagnosed as ${demo.issue} with medium or high confidence (or once an officer confirms it) and sent from within ${CLUSTER_RADIUS_KM} km.`
    )
    console.log(`  Armed until ${expires}; re-seed after that.`)
  }
}

// What the demo depends on; any failure stops the run before anything is written.
function check(seed: SeedData) {
  const problems: string[] = []
  const all = [
    ...seed.observations.map(o => o.observation.sim),
    ...seed.users.map(u => u.profile.sim),
    seed.org.data.sim,
  ]
  if (!all.every(Boolean)) problems.push('a row is not sim: true')
  if (!seed.observations.every(o => o.id.startsWith('sim-'))) problems.push('an id lacks sim-')
  const demo = seed.liveDemo
  if (demo) {
    const points = clusterPoints(seed)
    const near = qualifying(points, anchor).filter(
      p => p.issue === demo.issue && distanceKm(p.location, demo.center) <= CLUSTER_RADIUS_KM
    )
    if (near.length !== 4)
      problems.push(`live demo: ${near.length} qualifying reports near the venue, not 4`)
    const presenter = {
      id: 'presenter',
      issue: demo.issue,
      location: demo.center,
      created_at: anchor,
      weight: 0.5,
    }
    const formed = clusters([...points, presenter], anchor).some(c =>
      c.members.includes('presenter')
    )
    if (!formed) problems.push("live demo: the presenter's report would not complete a cluster")
  }
  return problems
}

function observationDocument(observation: Observation): { [key: string]: FsValue } {
  return {
    ...observation,
    created_at: new FsTimestamp(observation.created_at),
    location: new FsGeoPoint(observation.location.latitude, observation.location.longitude),
    diagnosis: observation.diagnosis && {
      ...observation.diagnosis,
      diagnosed_at: new FsTimestamp(observation.diagnosis.diagnosed_at),
    },
  }
}

// Replaces the sim data: sets every seeded document and deletes sim documents no longer in the
// seed. Real data is never touched: only sim == true documents with sim- ids are considered.
async function writeFirestore(seed: SeedData) {
  const writes: Write[] = []
  const keep = new Set<string>()

  writes.push({ set: `orgs/${seed.org.id}`, data: seed.org.data })
  for (const { id, profile } of seed.users) {
    keep.add(`users/${id}`)
    writes.push({ set: `users/${id}`, data: profile })
  }
  for (const { id, observation, internal } of seed.observations) {
    keep.add(`observations/${id}`)
    writes.push({ set: `observations/${id}`, data: observationDocument(observation) })
    writes.push({
      set: `observations/${id}/internal/diagnosis`,
      data: { ...internal, created_at: new FsTimestamp(internal.created_at) },
    })
  }

  let stale = 0
  for (const collection of ['observations', 'users']) {
    for (const path of await queryPaths(collection, 'sim', true)) {
      if (!path.startsWith(`${collection}/sim-`)) {
        throw new Error(`Refusing to touch ${path}: sim == true but not a sim- id`)
      }
      if (keep.has(path)) continue
      stale++
      writes.push({ delete: path })
      if (collection === 'observations') {
        writes.push({ delete: `${path}/internal/diagnosis` })
        writes.push({ delete: `${path}/internal/diagnosis_lock` })
      }
    }
  }

  await commit(writes)
  console.log(
    `\nFirestore: wrote ${seed.observations.length} observations (+ internal diagnoses), ${seed.users.length} users, 1 org; removed ${stale} stale sim document(s).`
  )
}

async function writeBigQuery(seed: SeedData) {
  const created = await ensureTable({
    dataset: DATASET,
    table: TABLE,
    fields: OBSERVATION_ROW_BIGQUERY_SCHEMA,
    partitionField: 'created_at',
    clusterFields: ['district_slug', 'issue'],
    description:
      'One row per observation, including internal diagnosis numbers (contract condition 4). sim rows are seed data.',
  })
  const removed = await query(`DELETE FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\` WHERE sim`)
  const loaded = await loadRows(
    DATASET,
    TABLE,
    seed.observations.map(o => toObservationRow(o.id, o.observation, o.internal))
  )
  console.log(
    `BigQuery ${DATASET}.${TABLE}${created ? ' (created)' : ''}: removed ${removed} sim row(s), loaded ${loaded}.`
  )
}
