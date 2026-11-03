// The farmer app's snapshot (apps/web/farmer.html): Given Mweemba in January, his field officer's
// ground check landed, eligible. The seeded season run through the same view builders as the API,
// baked into the farmer app's bundle: the app never reads or writes the live season.
//
//   pnpm --filter @repo/seed exec tsx farmer-snapshot.ts
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  buildFieldCard,
  buildStatement,
  geohash,
  maskMsisdn,
  MOMO_LABELS,
  seasonNow,
  seasonToday,
  simPhotoPath,
  type SeasonData,
} from '@repo/shared'
import { CREDIT, generateCeih } from './ceih'
import { DEMO_ORG_ID } from './generate'

const REAL_NOW = '2026-11-01T12:58:00.000Z'
const seed = generateCeih({ realNow: REAL_NOW })
const clone = <T>(value: T): T => structuredClone(value)
const real = (minutes: number) => new Date(Date.parse(REAL_NOW) + minutes * 60_000).toISOString()

const data: SeasonData = {
  org: { id: DEMO_ORG_ID, name: 'Outgrower Co.', credit: CREDIT, sim: true },
  state: clone(seed.state.data),
  farmers: clone(seed.farmers.map(({ id, data }) => ({ id, data }))),
  contracts: clone(seed.contracts),
  metrics: clone(seed.metrics),
  advances: clone(seed.advances),
  ledger: clone(seed.ledger),
  deliveries: clone(seed.deliveries),
  triggers: [],
  rainfall: clone(seed.rainfall),
  sms: [],
  observations: seed.observations.map(o => ({
    id: o.id,
    data: clone(o.observation),
    severity_pct: o.internal?.severity_pct ?? null,
  })),
  users: new Map(
    seed.users.map(u => [
      u.id,
      { role: u.profile.role, display_name: u.profile.display_name ?? null },
    ])
  ),
}

const hero = seed.farmers[0]
const contract = seed.contracts[0]

// The field officer's ground check on his field (the storyline's beat 3a).
data.observations.push({
  id: 'sim-ceih-ground-farmer-app',
  severity_pct: null,
  data: {
    reporter_id: data.state.ground_officer_id!,
    reporter_role: 'field_officer',
    org_id: DEMO_ORG_ID,
    created_at: real(-6),
    location: hero.data.field_pin,
    geohash: geohash(hero.data.field_pin.latitude, hero.data.field_pin.longitude),
    district: 'Monze',
    district_slug: 'monze',
    province: 'Southern',
    camp: 'Chikuni',
    crop: 'soybean',
    planting_date: contract.data.planting_date,
    growth_stage: 'R1',
    photo_paths: [simPhotoPath('library-unknown-03')],
    farmer_description: 'Ground check: even stand, rows closing, no pest seen.',
    status: 'complete',
    diagnosis: null,
    verification_state: 'FIELD_VERIFIED',
    verified_by: data.state.ground_officer_id,
    verified_issue: null,
    recommendation_id: null,
    intervention: null,
    outcome: null,
    farmer_id: hero.id,
    geofence_ok: true,
    source: 'officer',
    season_at: seasonNow(real(-6), data.state.offset_days),
    sim: true,
  },
})

const today = seasonToday(data, real(0))
const card = buildFieldCard(data, contract.id, today, true)
const statement = buildStatement(data, contract.id, today)
if (!card || !statement || !card.eligibility.eligible) throw new Error('Given is not eligible.')

const snapshot = {
  org: data.org.name,
  today,
  wallet: MOMO_LABELS[hero.data.momo_provider],
  phone: maskMsisdn(hero.data.phone_msisdn),
  credit: CREDIT,
  // His own record only: never the neighbour beside him (invariant 6).
  card: { ...card, neighbour: null },
  statement,
}
const out = fileURLToPath(new URL('../../apps/web/src/farmer/snapshot.json', import.meta.url))
writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`)
console.log(
  `wrote the farmer snapshot: ${card.farmer_name}, cap ZMW ${card.eligibility.cap_zmw}, ${statement.lines.length} ledger lines, ${card.curve.length} passes`
)
