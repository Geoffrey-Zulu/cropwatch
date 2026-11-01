// The CEIH demo check against an API (the 1 Nov flow: map, ledger, loan check, reconciliation
// batch): signs in as a Command Center account (the demo's credit-team stand-in), then plays the
// agribusiness storyline through the dashboard's own tRPC routes and checks what the screens will
// show. The farmer app has its own check (tools/visual/farmer-shot.ts): it never touches this
// season. Afterwards it puts back what it changed (Given's ground check, the payout rows, the
// season day) so the armed season stays armed; a re-arm after it is still the rule.
//
//   PHYTOS_RECORD_EMAIL=… PHYTOS_RECORD_PASSWORD=… pnpm --filter @repo/admin-tools ceih-e2e
//        [--api https://…run.app] [--keep] [--warm] [--no-fields]
//   --warm: the pre-pitch warm-up only (reads: the Fields map and one imagery tile, the ledger,
//   Given's field card, and through REST his eligibility and his satellite curve). Changes nothing.
import { getDocument, queryPaths, commit, type Write } from '@repo/tools-gcp'

const WEB_API_KEY = 'AIzaSyB6brxOl9sgWsf7X059B1rZvLiWXCPDTqU' // public client config
const ORG = 'demo-outgrower'
const argv = process.argv.slice(2).filter(arg => arg !== '--')
const flag = (name: string) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? (argv[i + 1] ?? '') : null
}
const BASE =
  flag('api') ?? process.env.API_BASE ?? 'https://cropwatch-api-24960589333.europe-west1.run.app'
const keep = argv.includes('--keep')
const warm = argv.includes('--warm')
// An earlier build (the ceih-preview fallback) has no Fields map: check beats 1 to 6 only.
const noFields = argv.includes('--no-fields')
const email = process.env.PHYTOS_RECORD_EMAIL
const password = process.env.PHYTOS_RECORD_PASSWORD
if (!email || !password)
  throw new Error('Set PHYTOS_RECORD_EMAIL and PHYTOS_RECORD_PASSWORD (a Command Center account)')

let failures = 0
function check(ok: boolean, label: string, detail = '') {
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`)
}

const signIn = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${WEB_API_KEY}`,
  { method: 'POST', body: JSON.stringify({ email, password, returnSecureToken: true }) }
)
if (!signIn.ok) throw new Error(`sign-in failed: HTTP ${signIn.status}`)
const { idToken } = (await signIn.json()) as { idToken: string }

async function call<T>(procedure: string, input: object, mutation = false): Promise<T> {
  const url = mutation
    ? `${BASE}/trpc/${procedure}`
    : `${BASE}/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify(input))}`
  const response = await fetch(url, {
    method: mutation ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${idToken}`, 'content-type': 'application/json' },
    body: mutation ? JSON.stringify(input) : undefined,
  })
  const body = (await response.json()) as { result?: { data: T }; error?: { message: string } }
  if (!response.ok || !body.result)
    throw new Error(`${procedure}: ${body.error?.message ?? response.status}`)
  return body.result.data
}

interface Row {
  contract_id: string
  farmer_id: string
  farmer_name: string
  eligibility_label: string
  eligible: boolean
  advance: { state: string } | null
}
interface FieldsMapView {
  precise: boolean
  camps: {
    camp: string
    center: { latitude: number; longitude: number }
    contracts: number
    established: number
    not_planted: number
  }[]
  fields: { contract_id: string; state: string }[]
}
interface Portfolio {
  contracts: number
  advances_out_zmw: number
  awaiting_approval: number
  hero_contract_id: string | null
  rows: Row[]
  today: string
  sim: boolean
  phase: string
}
interface Factor {
  text: string
  met: boolean
}
interface Card {
  eligibility: { eligible: boolean; cap_zmw: number; factors: Factor[] }
  neighbour?: { status_label: string } | null
  curve: unknown[]
  // The loan check and the imagery thumbnail (1 Nov): his traced field and the cap's figures.
  ring?: [number, number][]
  projected_yield_t_ha?: number
  contract_price_zmw_t?: number
  contracted_ha: number
}
interface RosterRow {
  contract_id: string
  farmer_name: string
  camp: string
  ready: boolean
  value_zmw: number
  input_loan_zmw: number
  advance_zmw: number
  fee_zmw: number
  net_zmw: number
  variance: { kind: string }
  payout: { ref: string; amount_zmw: number } | null
}
interface Statement {
  lines: { type: string; amount_zmw: number; simulated: boolean }[]
  balance_zmw: number
}

// One Esri imagery tile over a camp at zoom 16: the venue network reaches the Fields map's imagery.
async function esriTile(center: { latitude: number; longitude: number }) {
  const z = 16
  const n = 2 ** z
  const rad = (center.latitude * Math.PI) / 180
  const x = Math.floor(((center.longitude + 180) / 360) * n)
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)
  const tile = await fetch(
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
  )
  check(
    tile.ok && (tile.headers.get('content-type') ?? '').startsWith('image/'),
    'the Fields map loads imagery (Esri tile over Chikuni)',
    `HTTP ${tile.status}`
  )
}

if (warm) {
  const t = Date.now()
  if (!noFields) {
    const map = await call<FieldsMapView>('season.fields', { orgId: ORG })
    const chikuni = map.camps.find(c => c.camp === 'Chikuni')
    check(map.precise && chikuni?.not_planted === 2, 'Fields map: Chikuni armed, two grey holes')
    if (chikuni) await esriTile(chikuni.center)
  }
  const p = await call<Portfolio>('season.portfolio', { orgId: ORG })
  const heroId = p.hero_contract_id!
  const hero = p.rows.find(r => r.contract_id === heroId)!
  await call<Card>('season.fieldCard', { orgId: ORG, contractId: heroId })
  const rest = (path: string) =>
    fetch(`${BASE}/api/v1${path}?org_id=${ORG}`, {
      headers: { authorization: `Bearer ${idToken}` },
    })
  const eligibility = await rest(`/farmers/${hero.farmer_id}/eligibility`)
  const satellite = await rest(`/contracts/${heroId}/satellite`)
  check(eligibility.ok, 'GET /farmers/{id}/eligibility', `HTTP ${eligibility.status}`)
  check(satellite.ok, 'GET /contracts/{id}/satellite', `HTTP ${satellite.status}`)
  check(
    hero.eligibility_label.startsWith('Not eligible: cloud gap'),
    `${hero.farmer_name} armed`,
    hero.eligibility_label
  )
  console.log(`
Warm in ${((Date.now() - t) / 1000).toFixed(1)} s.`)
  process.exit(failures ? 1 : 0)
}

const started = new Date().toISOString()
const made = { observation: null as string | null, june: false }
let heroFarmer = ''
const t0 = Date.now()

try {
  console.log(`CEIH demo check against ${BASE}\n\nOpening: the Fields map`)
  if (!noFields) {
    const map = await call<FieldsMapView>('season.fields', { orgId: ORG })
    check(map.precise, 'this org sees its field outlines')
    const chikuni = map.camps.find(c => c.camp === 'Chikuni')
    check(chikuni?.contracts === 40, 'Chikuni: 40 fields', `${chikuni?.contracts}`)
    check(
      chikuni?.not_planted === 2,
      'Chikuni: two grey holes (not planted)',
      `${chikuni?.not_planted}`
    )
    check((chikuni?.established ?? 0) >= 20, 'Chikuni: mostly green', `${chikuni?.established}`)
    if (chikuni) await esriTile(chikuni.center)
  }
  console.log('\nBeat 1: the season ledger')
  const p0 = await call<Portfolio>('season.portfolio', { orgId: ORG })
  check(p0.contracts === 120, 'portfolio: 120 contracts', `${p0.contracts}`)
  check(p0.sim, 'the season is simulated (the season line says so)')
  check(
    p0.phase === 'january',
    'season calendar on January',
    `${p0.phase}, ${p0.today.slice(0, 10)}`
  )
  const heroId = p0.hero_contract_id
  check(Boolean(heroId), 'the storyline farmer is armed')
  if (!heroId) throw new Error('not armed: run the seed with --ceih')
  const hero = p0.rows.find(r => r.contract_id === heroId)!
  heroFarmer = hero.farmer_id

  console.log(`\nBeat 2: ${hero.farmer_name}, cloud gap`)
  check(
    hero.eligibility_label === 'Not eligible: cloud gap, ground check required',
    'not eligible: cloud gap, ground check required',
    hero.eligibility_label
  )
  const c0 = await call<Card>('season.fieldCard', { orgId: ORG, contractId: heroId })
  check(c0.curve.length > 10, 'the field card has its satellite curve', `${c0.curve.length} passes`)
  check(
    c0.eligibility.factors.some(f => f.text.startsWith('Satellite: 1 clear pass in 21 days')),
    'the satellite factor names the cloud gap'
  )

  console.log('\nBeat 3: the ground check lands')
  const ground = await call<{ obs_id: string; live: boolean }>(
    'season.demo.groundCheck',
    { orgId: ORG },
    true
  )
  if (!ground.live) made.observation = ground.obs_id
  const c1 = await call<Card>('season.fieldCard', { orgId: ORG, contractId: heroId })
  check(c1.eligibility.eligible, 'eligible after the ground check')
  if (!noFields) {
    check(
      (c1.ring?.length ?? 0) >= 4,
      'the loan check flies to his traced field (outline on the card)',
      `${c1.ring?.length ?? 0} points`
    )
    check(
      c1.contracted_ha * (c1.projected_yield_t_ha ?? 0) * (c1.contract_price_zmw_t ?? 0) === 5600,
      "the loan check's arithmetic: 0.5 ha × 1.4 t/ha × ZMW 8,000/t = ZMW 5,600",
      `${c1.contracted_ha} × ${c1.projected_yield_t_ha} × ${c1.contract_price_zmw_t}`
    )
  }
  check(c1.eligibility.cap_zmw === 840, 'cap ZMW 840', `${c1.eligibility.cap_zmw}`)
  check(
    c1.eligibility.factors.some(f =>
      // R1 since 1 Nov (55 days after planting); the fallback builds say V4.
      /^Field verified .* by Officer M\. Banda, stage (R1|V4)$/.test(f.text)
    ),
    'factor: field verified by Officer M. Banda, stage R1'
  )
  check(
    // Either wording: the fallback builds say "of ZMW 5,600", this one names the crop value.
    c1.eligibility.factors.some(f =>
      /^Cap 15% of (the projected crop value )?ZMW 5,600.* = ZMW 840/.test(f.text)
    ),
    'factor: Cap 15% of ZMW 5,600 = ZMW 840'
  )
  check(
    // "No crop seen from space" since 1 Nov; the fallback builds say "Not planted".
    ['No crop seen from space', 'Not planted'].includes(c1.neighbour?.status_label ?? ''),
    'beside him: the neighbour reads no crop seen',
    c1.neighbour?.status_label ?? 'none'
  )
  if (!noFields) {
    const map2 = await call<FieldsMapView>('season.fields', { orgId: ORG })
    const heroField = map2.fields.find(f => f.contract_id === heroId)
    check(
      heroField?.state === 'established',
      'on the Fields map his field turns green',
      heroField?.state ?? 'none'
    )
  }

  console.log('\nBeat 4: within the cap, no approval queue')
  check(
    p0.awaiting_approval === 0,
    'nothing waits for a second person',
    `${p0.awaiting_approval} waiting`
  )
  check(
    p0.rows.filter(r => r.advance).every(r => r.advance?.state === 'disbursed'),
    'every seeded advance went out within its cap'
  )

  console.log('\nBeat 5: June, the reconciliation batch')
  await call('season.demo.setPhase', { orgId: ORG, phase: 'june' }, true)
  made.june = true
  const rec = await call<{ roster?: RosterRow[]; claim_packs: { camp: string }[] }>(
    'season.reconciliation',
    { orgId: ORG }
  )
  const roster = rec.roster ?? []
  const ready = roster.filter(r => r.ready)
  check(roster.length > 100, 'the roster: every planted field', `${roster.length}`)
  check(
    ready.length / roster.length > 0.5 && ready.length / roster.length < 0.7,
    'about 60% ready, the rest not yet',
    `${ready.length} of ${roster.length}`
  )
  check(roster.find(r => r.contract_id === heroId)?.ready === false, `${hero.farmer_name}: not yet`)
  check(
    ready.every(r => r.net_zmw === r.value_zmw - r.input_loan_zmw - r.advance_zmw - r.fee_zmw),
    'each row: value less inputs, less advance and fee, is the net'
  )
  const shock = ready.filter(r => r.variance.kind === 'shock')
  const unexplained = ready.filter(r => r.variance.kind === 'unexplained')
  check(
    shock.length > 0 && shock.every(r => r.camp === 'Hamangaba'),
    'Hamangaba shortfalls: uncontrollable',
    `${shock.length}`
  )
  check(unexplained.length >= 2, 'unexplained shortfalls flagged', `${unexplained.length}`)
  check(
    rec.claim_packs.some(c => c.camp === 'Hamangaba'),
    'the drought claim pack is there'
  )
  const owed = ready.filter(r => r.net_zmw > 0 && !r.payout)
  const due = owed.reduce((n, r) => n + r.net_zmw, 0)
  check(
    owed.length > 0,
    'payouts due',
    `${owed.length} farmers, ZMW ${due.toLocaleString('en-GB')}`
  )

  console.log('\nBeat 6: one payout request (simulated)')
  const paid = await call<{ farmers: number; total_zmw: number; simulated: boolean }>(
    'season.requestPayouts',
    { orgId: ORG },
    true
  )
  check(
    paid.farmers === owed.length && paid.total_zmw === due && paid.simulated,
    'the request pays every farmer owed, simulated',
    `${paid.farmers} farmers, ZMW ${paid.total_zmw.toLocaleString('en-GB')}`
  )
  const one = owed[0]
  const st = await call<Statement>('season.statement', { orgId: ORG, contractId: one.contract_id })
  check(
    st.lines.some(l => l.type === 'payout' && l.amount_zmw === one.net_zmw && l.simulated),
    `ledger: ${one.farmer_name}'s payout, labelled simulated`
  )
  check(st.balance_zmw === 0, 'the statement closes at zero', `${st.balance_zmw}`)
  let again = 0
  try {
    again = (await call<{ farmers: number }>('season.requestPayouts', { orgId: ORG }, true)).farmers
  } catch {
    again = 0
  }
  check(again === 0, 'a second press pays no one twice', `${again}`)
  const cleared = await call<{ removed: number }>(
    'season.demo.resetSettlement',
    { orgId: ORG },
    true
  )
  check(
    cleared.removed === paid.farmers,
    'the rerun clears the payout rows (a refresh starts the batch over)',
    `${cleared.removed}`
  )
  console.log(`\n  beats 1 to 6 in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
} catch (error) {
  failures++
  console.log(`  FAIL  ${String(error)}`)
} finally {
  if (keep) console.log('\n--keep: left in place.')
  else await cleanUp()
}

// Everything this run wrote, so the season is armed again: Given's ground check and his rows,
// the payout rows, and the season day back to January (the drought trigger it fired is dated
// March, so January does not see it; a re-arm removes it).
async function cleanUp() {
  const writes: Write[] = []
  if (made.observation) writes.push({ delete: `observations/${made.observation}` })
  if (made.june) {
    for (const path of await queryPaths('ledger_entries', 'type', 'payout')) {
      const doc = (await getDocument(path)) as { org_id?: string; sim?: boolean } | null
      if (doc?.org_id === ORG && doc.sim) writes.push({ delete: path })
    }
    await call('season.demo.setPhase', { orgId: ORG, phase: 'january' }, true)
  }
  if (heroFarmer) {
    for (const path of await queryPaths('advances', 'farmer_id', heroFarmer))
      writes.push({ delete: path })
    for (const collection of ['ledger_entries', 'sms_log']) {
      for (const path of await queryPaths(collection, 'farmer_id', heroFarmer)) {
        const doc = (await getDocument(path)) as { at?: string; type?: string } | null
        if (doc?.at && doc.at >= started && (collection === 'sms_log' || doc.type !== 'input_loan'))
          writes.push({ delete: path })
      }
    }
  }
  await commit(writes)
  console.log(`\nCleaned up ${writes.length} document(s): the season is armed again.`)
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.')
process.exit(failures ? 1 : 0)
