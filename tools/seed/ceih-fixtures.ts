// Dashboard preview fixtures for the CEIH tabs (apps/web/src/dev/Preview.tsx, the visual pass):
// the seeded season run through the same view builders as the API, in two storyline states.
//   January: Given's ground check has landed and his advance waits for approval (plan §4 beat 5).
//   June: Hamangaba's drought flag is up, Given's advance is sent and his crop delivered (beat 8).
// Merged into apps/web/src/dev/fixtures.local.json (gitignored) under "season".
//
//   pnpm --filter @repo/seed exec tsx ceih-fixtures.ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  buildApprovals,
  buildFieldCard,
  buildFieldsMap,
  buildPortfolio,
  buildReconciliation,
  buildSmsLog,
  buildStatement,
  eligibilityFor,
  evaluateShock,
  medianDate,
  feeFor,
  geohash,
  otpMessage,
  disbursedMessage,
  priceDelivery,
  seasonNow,
  seasonToday,
  simPhotoPath,
  statementMessage,
  visiblePasses,
  offsetForPhase,
  type Advance,
  type SeasonData,
} from '@repo/shared'
import { CREDIT, generateCeih } from './ceih'
import { DEMO_ORG_ID } from './generate'

const REAL_NOW = '2026-11-01T12:58:00.000Z'
const seed = generateCeih({ realNow: REAL_NOW })
const clone = <T>(value: T): T => structuredClone(value)

function base(): SeasonData {
  return {
    org: { id: DEMO_ORG_ID, name: 'DEMO OUTGROWER CO.', credit: CREDIT, sim: true },
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
}

const hero = seed.farmers[0]
const heroContract = seed.contracts[0]
const real = (minutes: number) => new Date(Date.parse(REAL_NOW) + minutes * 60_000).toISOString()

// Beats 3 and 4: the officer's ground check, the request with its SMS, the farmer's code.
function january(): SeasonData {
  const data = base()
  data.observations.push({
    id: 'sim-ceih-ground-preview',
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
      planting_date: heroContract.data.planting_date,
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
  const snapshot = eligibilityFor(
    data,
    heroContract.id,
    seasonNow(real(-3), data.state.offset_days)
  )
  const fee = feeFor(snapshot.cap_zmw, CREDIT)
  const advance: Advance = {
    contract_id: heroContract.id,
    farmer_id: hero.id,
    org_id: DEMO_ORG_ID,
    season: '2026/27',
    state: 'farmer_confirmed',
    requested_at: seasonNow(real(-3), data.state.offset_days),
    requested_via: 'officer',
    requested_by: data.state.ground_officer_id!,
    eligibility_snapshot: snapshot,
    amount_zmw: snapshot.cap_zmw,
    fee_zmw: fee,
    otp_sha256: null,
    otp_expires_at: null,
    farmer_confirmed: { at: seasonNow(real(-1), data.state.offset_days), otp_ok: true },
    approval: null,
    decline: null,
    disbursement: null,
    sim: true,
  }
  data.advances.push({ id: 'sim-ceih-advance-given', data: advance })
  data.sms.push({
    id: 'sms-otp',
    data: {
      org_id: DEMO_ORG_ID,
      farmer_id: hero.id,
      to: hero.data.phone_msisdn,
      message: otpMessage({
        org: 'DEMO OUTGROWER CO.',
        farmerName: hero.data.name,
        amountZmw: snapshot.cap_zmw,
        feeZmw: fee,
        code: '482913',
      }),
      purpose: 'otp',
      status: 'logged',
      gateway: 'log only',
      at: real(-3),
      season_at: seasonNow(real(-3), data.state.offset_days),
      sim: true,
    },
  })
  return data
}

// Beats 6 to 8: the transfer, March's drought rule, June's delivery.
function june(): SeasonData {
  const data = january()
  const a = data.advances.find(x => x.id === 'sim-ceih-advance-given')!
  a.data = {
    ...a.data,
    state: 'disbursed',
    approval: { approver_id: 'uid-preview', at: a.data.farmer_confirmed!.at },
    disbursement: {
      provider: 'simulated',
      tx_ref: 'SIM-7Q2X4A',
      at: a.data.farmer_confirmed!.at,
      status: 'simulated',
    },
  }
  for (const [type, amount] of [
    ['advance', a.data.amount_zmw],
    ['advance_fee', a.data.fee_zmw],
  ] as const)
    data.ledger.push({
      id: `l-${type}`,
      data: {
        contract_id: heroContract.id,
        farmer_id: hero.id,
        org_id: DEMO_ORG_ID,
        at: a.data.disbursement!.at,
        type,
        amount_zmw: amount,
        ref: 'SIM-7Q2X4A',
        note:
          type === 'advance'
            ? 'Cash advance to Airtel Money (simulated transfer)'
            : 'Advance fee, shown before the farmer confirmed',
        simulated: true,
        sim: true,
      },
    })
  data.sms.push({
    id: 'sms-sent',
    data: {
      ...data.sms[0].data,
      purpose: 'disbursement',
      message: disbursedMessage({
        amountZmw: a.data.amount_zmw,
        feeZmw: a.data.fee_zmw,
        wallet: 'Airtel Money',
        txRef: 'SIM-7Q2X4A',
        simulated: true,
      }),
      at: real(1),
    },
  })
  // March: the rule on every camp; Hamangaba's fires.
  const march = '2027-03-16T09:00:00.000Z'
  for (const camp of ['Chikuni', 'Keemba', 'Hamangaba']) {
    const members = data.contracts.filter(c => c.data.camp === camp)
    const shock = evaluateShock({
      today: march,
      plantingDate: medianDate(members.map(c => c.data.planting_date)),
      rain: data.rainfall.find(r => r.data.camp === camp)!.data.days,
      fields: members.map(c =>
        visiblePasses(data.metrics.find(m => m.id === c.id)!.data.passes, march)
      ),
    })
    const id = `trigger-${camp}`
    data.triggers.push({
      id,
      data: {
        org_id: DEMO_ORG_ID,
        camp,
        window_start: shock.window_start,
        window_end: shock.window_end,
        metric: 'rain_mm_30d',
        value: shock.rain_30d,
        threshold: shock.threshold,
        ndvi: {
          median_start: shock.median_start,
          median_end: shock.median_end,
          fields_falling: shock.fields_falling,
          fields_total: shock.fields_total,
        },
        fired: shock.fired,
        source: 'Demo rainfall series (simulated); S2_SR_HARMONIZED camp median',
        evaluated_at: march,
        sim: true,
      },
    })
    if (shock.fired)
      for (const c of members)
        c.data.shock_flag = { type: 'drought', camp, triggered_at: march, evidence_ref: id }
  }
  // June: Given delivers.
  data.state = { ...data.state, phase: 'june', offset_days: offsetForPhase('june', REAL_NOW) }
  const today = seasonToday(data, real(0))
  const { price_zmw_t, value_zmw } = priceDelivery(heroContract.data.contract_price_zmw_t, 'A', 720)
  data.deliveries.push({
    id: 'delivery-given',
    data: {
      contract_id: heroContract.id,
      farmer_id: hero.id,
      org_id: DEMO_ORG_ID,
      at: today,
      weight_kg: 720,
      moisture_pct: 11,
      grade: 'A',
      price_zmw_t,
      value_zmw,
      clerk_id: 'uid-preview',
      sim: true,
    },
  })
  data.ledger.push({
    id: 'l-delivery',
    data: {
      contract_id: heroContract.id,
      farmer_id: hero.id,
      org_id: DEMO_ORG_ID,
      at: today,
      type: 'delivery',
      amount_zmw: -value_zmw,
      ref: 'delivery-given',
      note: `0.72 t grade A at ZMW ${price_zmw_t.toLocaleString('en-GB')} a tonne`,
      simulated: false,
      sim: true,
    },
  })
  const rows = data.ledger.filter(l => l.data.contract_id === heroContract.id).map(l => l.data)
  data.sms.push({
    id: 'sms-statement',
    data: {
      ...data.sms[0].data,
      purpose: 'statement',
      message: statementMessage({
        farmerName: hero.data.name,
        lines: rows,
        netZmw: -rows.reduce((n, r) => n + r.amount_zmw, 0),
      }),
      at: real(2),
      season_at: today,
    },
  })
  return data
}

function views(data: SeasonData) {
  const today = seasonToday(data, real(0))
  const cards = [
    heroContract.id,
    seed.contracts[1].id,
    ...data.advances.map(a => a.data.contract_id),
  ]
  return {
    portfolio: buildPortfolio(data, today),
    fields: buildFieldsMap(data, today, true),
    approvals: buildApprovals(data, today, 'uid-preview'),
    smsLog: buildSmsLog(data),
    reconciliation: buildReconciliation(data, today),
    fieldCards: Object.fromEntries(cards.map(id => [id, buildFieldCard(data, id, today)])),
    statements: { [heroContract.id]: buildStatement(data, heroContract.id, today) },
  }
}

const season = { january: views(january()), june: views(june()), hero: heroContract.id }
const target = fileURLToPath(new URL('../../apps/web/src/dev/fixtures.local.json', import.meta.url))
const current = existsSync(target)
  ? (JSON.parse(readFileSync(target, 'utf8')) as Record<string, unknown>)
  : {}
writeFileSync(target, JSON.stringify({ ...current, season }))
for (const c of season.january.fields.camps)
  console.log(
    `  ${c.camp}: ${c.contracts} fields, ${c.established} green, ${c.not_planted} not planted, ${c.stress} stress, ${c.cloud_gap} cloud gap`
  )
console.log(
  `wrote season fixtures: January ${season.january.portfolio.eligible} eligible, ${season.january.approvals.length} approvals; June ${season.june.reconciliation.rows.length} deliveries, ${season.june.reconciliation.claim_packs.length} claim pack(s)`
)
