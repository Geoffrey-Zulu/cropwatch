// The CEIH demo check (docs/ceih-overnight-plan.md §4, beats 1 to 6) against an API: signs in as
// a Command Center account (the demo's credit-team stand-in), then plays the storyline through
// the dashboard's own tRPC routes and checks what the screens will show. Deletes what it made
// (Given's ground check, advance, ledger rows and SMS log) so the armed season stays armed.
//
//   PHYTOS_RECORD_EMAIL=… PHYTOS_RECORD_PASSWORD=… pnpm --filter @repo/admin-tools ceih-e2e
//        [--api https://…run.app] [--keep] [--warm] [--no-fields]
//   --warm: the pre-pitch warm-up only (reads: the ledger, Given's field card, and through REST
//   his eligibility and his satellite curve). Changes nothing.
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
}
interface Sms {
  message: string
  purpose: string
  farmer_name: string | null
}
interface Approval {
  advance_id: string
  contract_id: string
  otp_ok: boolean
  caller_is_verifier: boolean
  verifier_labels: string[]
  amount_zmw: number
  fee_zmw: number
}
interface Statement {
  lines: { type: string; amount_zmw: number; simulated: boolean }[]
}

if (warm) {
  const t = Date.now()
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
const made = { observation: null as string | null, advance: null as string | null }
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
    if (chikuni) {
      const z = 16
      const n = 2 ** z
      const rad = (chikuni.center.latitude * Math.PI) / 180
      const x = Math.floor(((chikuni.center.longitude + 180) / 360) * n)
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
  }
  console.log('\nBeat 1: the season ledger')
  const p0 = await call<Portfolio>('season.portfolio', { orgId: ORG })
  check(p0.contracts === 120, 'portfolio: 120 contracts', `${p0.contracts}`)
  check(p0.sim, 'the season is simulated (DEMO pill)')
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
  check(c1.eligibility.cap_zmw === 840, 'cap ZMW 840', `${c1.eligibility.cap_zmw}`)
  check(
    c1.eligibility.factors.some(f =>
      /^Field verified .* by Officer M\. Banda, stage V4$/.test(f.text)
    ),
    'factor: field verified by Officer M. Banda, stage V4'
  )
  check(
    c1.eligibility.factors.some(f => f.text === 'Cap 15% of ZMW 5,600 = ZMW 840'),
    'factor: Cap 15% of ZMW 5,600 = ZMW 840'
  )
  check(
    c1.neighbour?.status_label === 'Not planted',
    'beside him: the neighbour reads Not planted',
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

  console.log('\nBeat 4: the request, the fee before the code')
  const req = await call<{ advance_id: string; amount_zmw: number; fee_zmw: number }>(
    'season.requestAdvance',
    { orgId: ORG, contractId: heroId },
    true
  )
  made.advance = req.advance_id
  check(
    req.amount_zmw === 840 && req.fee_zmw === 42,
    'ZMW 840, fee ZMW 42',
    `${req.amount_zmw}, ${req.fee_zmw}`
  )
  const sms1 = await call<Sms[]>('season.smsLog', { orgId: ORG })
  const otp = sms1.find(s => s.purpose === 'otp' && s.farmer_name === hero.farmer_name)
  check(
    Boolean(otp?.message.includes('ZMW 840') && otp.message.includes('Fee ZMW 42')),
    'the SMS before confirmation carries amount and fee'
  )
  const code = otp && /code: (\d{6})/.exec(otp.message)?.[1]
  check(Boolean(code), 'the code is in the SMS log')
  let refused = false
  try {
    await call('season.approveAdvance', { orgId: ORG, advanceId: req.advance_id }, true)
  } catch {
    refused = true
  }
  check(refused, 'no approval before the farmer confirms')
  await call('season.confirmAdvance', { orgId: ORG, advanceId: req.advance_id, code }, true)

  console.log('\nBeat 5: the approval card')
  const queue = await call<Approval[]>('season.approvals', { orgId: ORG })
  const card = queue.find(a => a.advance_id === req.advance_id)
  check(Boolean(card?.otp_ok), 'in the queue, confirmed with the code')
  check(
    card?.caller_is_verifier === false,
    'this account did not verify the field, so it may approve'
  )
  check(
    Boolean(card?.verifier_labels.includes('Officer M. Banda')),
    'the card names the verifying officer',
    card?.verifier_labels.join(', ')
  )

  console.log('\nBeat 6: the money moves (simulated)')
  const sent = await call<{ tx_ref: string | null; simulated: boolean }>(
    'season.approveAdvance',
    { orgId: ORG, advanceId: req.advance_id },
    true
  )
  check(
    sent.simulated && Boolean(sent.tx_ref?.startsWith('SIM-')),
    'simulated transfer',
    sent.tx_ref ?? ''
  )
  const st = await call<Statement>('season.statement', { orgId: ORG, contractId: heroId })
  check(
    st.lines.some(l => l.type === 'advance' && l.amount_zmw === 840 && l.simulated),
    'ledger: the advance, labelled simulated'
  )
  check(
    st.lines.some(l => l.type === 'advance_fee' && l.amount_zmw === 42),
    'ledger: the fee'
  )
  const sms2 = await call<Sms[]>('season.smsLog', { orgId: ORG })
  check(
    sms2.some(
      s =>
        s.purpose === 'disbursement' &&
        s.message.startsWith('Phytos DEMO: ZMW 840 sent to your Airtel Money (simulated transfer')
    ),
    'SMS: "ZMW 840 sent to your Airtel Money…"'
  )
  const p1 = await call<Portfolio>('season.portfolio', { orgId: ORG })
  check(
    p1.advances_out_zmw === p0.advances_out_zmw + 840,
    'portfolio: advances out up ZMW 840',
    `${p0.advances_out_zmw} → ${p1.advances_out_zmw}`
  )
  console.log(`\n  beats 1 to 6 in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
} catch (error) {
  failures++
  console.log(`  FAIL  ${String(error)}`)
} finally {
  if (keep) console.log('\n--keep: left in place.')
  else await cleanUp()
}

// Everything this run wrote for the storyline farmer, so the season is armed again.
async function cleanUp() {
  const writes: Write[] = []
  if (made.observation) writes.push({ delete: `observations/${made.observation}` })
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
