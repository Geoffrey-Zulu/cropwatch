// The CEIH season's dry-run summary, its checks, and its Firestore write (tools/seed/ceih.ts).
import {
  addDays,
  eligibilityLabel,
  evaluateEligibility,
  evaluateShock,
  medianDate,
  latestStatus,
  SEASON_PHASE_DATES,
  visiblePasses,
  zmw,
  type Eligibility,
} from '@repo/shared'
import { commit, queryPaths, type FsValue, type Write } from '@repo/tools-gcp'
import { CREDIT, officerLabel, type CeihSeed } from './ceih'
import { DEMO_ORG_ID } from './generate'

// Collections the CEIH season owns. Anything sim in them that this run does not write goes:
// the API's own rows from a rehearsal (advances, ledger, SMS log, triggers) included.
const COLLECTIONS = [
  'farmers',
  'contracts',
  'satellite_metrics',
  'advances',
  'ledger_entries',
  'deliveries',
  'weather_triggers',
  'rainfall_series',
  'sms_log',
  'ceih_demo',
]

function eligibilityOf(seed: CeihSeed, i: number, now = seed.today): Eligibility {
  const farmer = seed.farmers[i]
  const open = seed.advances.find(a => a.data.farmer_id === farmer.id && a.data.requested_at <= now)
  return evaluateEligibility({
    now,
    contract: seed.contracts[i].data,
    farmer: farmer.data,
    passes: visiblePasses(seed.metrics[i].data.passes, now),
    observations: seed.observations
      .filter(o => o.observation.farmer_id === farmer.id && (o.observation.season_at ?? '') <= now)
      .map(o => ({
        id: o.id,
        at: o.observation.season_at!,
        verification_state: o.observation.verification_state,
        verified_by: o.observation.verified_by,
        growth_stage: o.observation.growth_stage,
        geofence_ok: o.observation.geofence_ok,
        issue: o.observation.verified_issue ?? o.observation.diagnosis?.suspected_issue ?? null,
        severity_pct: o.internal?.severity_pct ?? null,
        severity_band: o.observation.diagnosis?.severity_band ?? null,
        intervention: o.observation.intervention !== null,
        resolved: o.observation.outcome?.resolved ?? false,
      })),
    credit: CREDIT,
    openAdvance: open ? { amount_zmw: open.data.amount_zmw, state: open.data.state } : null,
    officerLabel,
  })
}

const printFactors = (e: Eligibility) =>
  e.factors.map(f => `      ${f.met ? 'met    ' : 'NOT MET'} ${f.text}`).join('\n')

export function summariseCeih(seed: CeihSeed) {
  const labels = new Map<string, number>()
  seed.farmers.forEach((_, i) => {
    const label = eligibilityLabel(eligibilityOf(seed, i)).replace(/ZMW [\d,]+/, 'ZMW …')
    labels.set(label, (labels.get(label) ?? 0) + 1)
  })
  const passes = seed.metrics.reduce((n, m) => n + m.data.passes.length, 0)
  console.log(
    `\nCEIH season ${seed.state.data.phase} (season day ${seed.today.slice(0, 10)}, offset ${seed.state.data.offset_days} days): ${seed.farmers.length} farmers and contracts, ${passes} satellite passes, ${seed.observations.length} ground observations, ${seed.advances.length} advances, ${seed.ledger.length} ledger rows, ${seed.deliveries.length} June deliveries.`
  )
  console.log(`  rows: ${[...labels].map(([k, n]) => `${k} ${n}`).join(', ')}`)
  const lent = seed.ledger
    .filter(l => l.data.type === 'input_loan')
    .reduce((n, l) => n + l.data.amount_zmw, 0)
  const value = seed.contracts.reduce((n, c) => n + c.data.projected_value_zmw, 0)
  console.log(`  projected value ${zmw(value)}, input loans ${zmw(lent)}`)

  const given = eligibilityOf(seed, 0)
  console.log(`\n  Given Mweemba, ${seed.today.slice(0, 10)}: ${eligibilityLabel(given)}`)
  console.log(printFactors(given))
  const verified = seed.farmers.findIndex(
    (f, i) => f.archetype === 'eligible' && eligibilityOf(seed, i).eligible
  )
  const other = eligibilityOf(seed, verified)
  console.log(
    `\n  ${seed.farmers[verified].data.name} (${seed.contracts[verified].data.camp}): ${eligibilityLabel(other)}`
  )
  console.log(printFactors(other))
  const neighbour = eligibilityOf(seed, 1)
  console.log(`\n  Joseph Hamoonga: ${eligibilityLabel(neighbour)}`)
  for (const camp of ['Chikuni', 'Keemba', 'Hamangaba']) {
    const shock = shockAt(seed, camp, SEASON_PHASE_DATES.march)
    console.log(
      `  Shock rule at ${SEASON_PHASE_DATES.march}, ${camp}: ${shock.fired ? 'FIRES' : 'quiet'} · ${shock.factors.join(' · ')}`
    )
  }
}

function shockAt(seed: CeihSeed, camp: string, date: string) {
  return evaluateShock({
    today: date,
    rain: seed.rainfall.find(r => r.data.camp === camp)!.data.days,
    plantingDate: medianDate(
      seed.contracts.filter(c => c.data.camp === camp).map(c => c.data.planting_date)
    ),
    fields: seed.metrics
      .filter(m => m.data.camp === camp)
      .map(m => visiblePasses(m.data.passes, date)),
  })
}

// What the CEIH demo depends on; any failure stops the run before anything is written.
export function checkCeih(seed: CeihSeed): string[] {
  const problems: string[] = []
  const rows = [
    ...seed.farmers.map(f => f.data.sim),
    ...seed.contracts.map(c => c.data.sim),
    ...seed.metrics.map(m => m.data.sim),
    ...seed.advances.map(a => a.data.sim),
    ...seed.ledger.map(l => l.data.sim),
    ...seed.deliveries.map(d => d.data.sim),
    ...seed.observations.map(o => o.observation.sim),
  ]
  if (!rows.every(Boolean)) problems.push('ceih: a row is not sim: true')

  const given = eligibilityOf(seed, 0)
  if (given.eligible) problems.push('ceih: Given is already eligible')
  if (eligibilityLabel(given) !== 'Not eligible: cloud gap, ground check required')
    problems.push(`ceih: Given reads "${eligibilityLabel(given)}"`)
  if (given.cap_zmw !== 840) problems.push(`ceih: Given's cap is ${given.cap_zmw}, not 840`)
  if (!given.factors[0].text.startsWith('Satellite: 1 clear pass in 21 days (2 clouded out)'))
    problems.push(`ceih: Given's satellite line is "${given.factors[0].text}"`)
  // One ground check is all he lacks.
  const withCheck = evaluateEligibility({
    ...inputsFor(seed, 0),
    observations: [
      {
        id: 'check',
        at: seed.today,
        verification_state: 'FIELD_VERIFIED',
        verified_by: seed.state.data.ground_officer_id!,
        growth_stage: 'R1',
        geofence_ok: true,
        issue: null,
        severity_pct: null,
        severity_band: null,
        intervention: false,
        resolved: false,
      },
    ],
  })
  if (!withCheck.eligible || withCheck.cap_zmw !== 840)
    problems.push('ceih: a ground check does not make Given eligible at ZMW 840')

  const neighbour = eligibilityOf(seed, 1)
  if (eligibilityLabel(neighbour) !== 'Not eligible: no crop seen')
    problems.push(`ceih: Joseph reads "${eligibilityLabel(neighbour)}"`)
  if (latestStatus(visiblePasses(seed.metrics[1].data.passes, seed.today)) !== 'not_planted')
    problems.push("ceih: Joseph's curve does not read not planted")

  const eligible = seed.farmers.filter((_, i) => eligibilityOf(seed, i).eligible).length
  if (eligible < 32 || eligible > 48) problems.push(`ceih: ${eligible} eligible, not about 40`)
  const waiting = seed.advances.filter(a => a.data.state === 'farmer_confirmed').length
  if (waiting !== 2) problems.push(`ceih: ${waiting} advances waiting for approval, not 2`)
  for (const a of seed.advances) {
    if (!a.data.eligibility_snapshot.eligible)
      problems.push(`ceih: ${a.id} was not eligible when requested`)
    if (
      a.data.approval &&
      a.data.eligibility_snapshot.verifier_ids.includes(a.data.approval.approver_id)
    )
      problems.push(`ceih: ${a.id} approved by its verifier`)
  }
  // Drought: Hamangaba fires in March, nobody fires in January, the others never.
  for (const camp of ['Chikuni', 'Keemba', 'Hamangaba']) {
    const march = shockAt(seed, camp, SEASON_PHASE_DATES.march).fired
    if (march !== (camp === 'Hamangaba'))
      problems.push(`ceih: shock in March for ${camp}: ${march}`)
    if (shockAt(seed, camp, SEASON_PHASE_DATES.june).fired)
      problems.push(`ceih: shock at harvest for ${camp}`)
    if (shockAt(seed, camp, SEASON_PHASE_DATES.january).fired)
      problems.push(`ceih: shock in January for ${camp}`)
  }
  // Nothing from the future is visible in January.
  if (seed.ledger.some(l => l.data.type === 'delivery' && l.data.at <= seed.today))
    problems.push('ceih: a delivery is visible in January')
  if (seed.observations.some(o => (o.observation.season_at ?? '') > addDays(seed.today, 1)))
    problems.push('ceih: an observation is dated after the demo day')
  return problems
}

function inputsFor(seed: CeihSeed, i: number) {
  return {
    now: seed.today,
    contract: seed.contracts[i].data,
    farmer: seed.farmers[i].data,
    passes: visiblePasses(seed.metrics[i].data.passes, seed.today),
    observations: [],
    credit: CREDIT,
    openAdvance: null,
    officerLabel,
  }
}

const doc = (value: object) => value as { [key: string]: FsValue }

export async function writeCeih(seed: CeihSeed) {
  const writes: Write[] = []
  const keep = new Set<string>()
  const put = (path: string, data: object) => {
    keep.add(path)
    writes.push({ set: path, data: doc(data) })
  }
  put(`ceih_demo/${seed.state.id}`, seed.state.data)
  writes.push({ patch: `orgs/${DEMO_ORG_ID}`, data: doc({ credit: seed.credit }) })
  for (const f of seed.farmers) put(`farmers/${f.id}`, f.data)
  for (const c of seed.contracts) put(`contracts/${c.id}`, c.data)
  for (const m of seed.metrics) put(`satellite_metrics/${m.id}`, m.data)
  for (const a of seed.advances) put(`advances/${a.id}`, a.data)
  for (const l of seed.ledger) put(`ledger_entries/${l.id}`, l.data)
  for (const d of seed.deliveries) put(`deliveries/${d.id}`, d.data)
  for (const r of seed.rainfall) put(`rainfall_series/${r.id}`, r.data)

  let stale = 0
  for (const collection of COLLECTIONS) {
    for (const path of await queryPaths(collection, 'sim', true)) {
      if (keep.has(path)) continue
      stale++
      writes.push({ delete: path })
    }
  }
  await commit(writes)
  console.log(
    `Firestore CEIH: ${seed.farmers.length} farmers and contracts, ${seed.metrics.length} satellite curves, ${seed.advances.length} advances, ${seed.ledger.length} ledger rows, ${seed.deliveries.length} deliveries, ${seed.rainfall.length} rainfall series; season day ${seed.today.slice(0, 10)}; removed ${stale} stale sim document(s).`
  )
}
