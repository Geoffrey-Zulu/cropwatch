import { describe, expect, it } from 'vitest'
import {
  balance,
  circlePolygon,
  fieldRadiusM,
  type Advance,
  type AdvanceState,
  type SatellitePass,
  type SeasonData,
} from '@repo/shared'
import type { SmsSender } from '../alerts/sms'
import type { Caller } from '../observationModel'
import { simulatedProvider } from './mobileMoney'
import { observationLinker, seasonService, SeasonError } from './season'
import type { SeasonStore } from './store'

// The CEIH acceptance tests (spec §6, plan §5) on an in-memory store: eligibility, the advance
// state machine with maker-checker, the ledger as the only record of money, and the fee shown
// before the farmer confirms.

const ORG = 'demo-outgrower'
const REAL_NOW = new Date('2026-11-01T12:00:00.000Z')
const OFFSET = 72 // 1 Nov 2026 + 72 days = 12 Jan 2027
const BANDA = 'sim-officer-ceih-banda'
const PIN = { latitude: -16.1352, longitude: 27.3951 }

const david: Caller = { uid: 'uid-david', role: 'extension_officer', orgId: null }
const banda: Caller = { uid: BANDA, role: 'field_officer', orgId: ORG }
const bandaAsCredit: Caller = { uid: BANDA, role: 'credit', orgId: ORG }
const otherOrg: Caller = { uid: 'uid-x', role: 'credit', orgId: 'another-org' }

function pass(date: string, ndvi: number | null): SatellitePass {
  return {
    date,
    ndvi,
    ndvi_camp_median: 0.47,
    cloud_pct: ndvi === null ? 90 : 3,
    usable: ndvi !== null,
    collection: 'S2_SR_HARMONIZED',
    computed_at: '2027-01-10T06:00:00.000Z',
    status_derived: ndvi === null ? 'no_data' : 'established',
    sim: true,
  }
}

function season(): SeasonData {
  return {
    org: {
      id: ORG,
      name: 'DEMO OUTGROWER CO.',
      credit: { cap_pct: 0.15, hard_ceiling_zmw: 2500, advance_fee_pct: 0.05 },
      sim: true,
    },
    state: {
      phase: 'january',
      offset_days: OFFSET,
      sms_allow: [],
      hero_farmer_id: 'f-given',
      neighbour_farmer_id: null,
      ground_officer_id: BANDA,
      armed_at: '2026-11-01T06:00:00.000Z',
      sim: true,
    },
    farmers: [
      {
        id: 'f-given',
        data: {
          name: 'Given Mweemba',
          phone_msisdn: '+260971000000',
          momo_provider: 'airtel',
          momo_verified: true,
          org_id: ORG,
          camp: 'Chikuni',
          district: 'Monze',
          province: 'Southern',
          consent: {
            given_at: '2026-10-07T09:00:00.000Z',
            scope: 'org_contract',
            officer_id: BANDA,
          },
          field_pin: PIN,
          field_polygon: null,
          claimed_ha: 0.5,
          history: { seasons: 2, defaults: 0, last_recovery_pct: 100 },
          sim: true,
        },
      },
    ],
    contracts: [
      {
        id: 'c-given',
        data: {
          farmer_id: 'f-given',
          org_id: ORG,
          season: '2026/27',
          crop: 'soybean',
          camp: 'Chikuni',
          district: 'Monze',
          planting_date: '2026-11-18',
          contracted_ha: 0.5,
          projected_yield_t_ha: 1.4,
          contract_price_zmw_t: 8000,
          projected_value_zmw: 5600,
          input_loan_zmw: 1950,
          inputs_delivered: {
            at: '2026-10-22T09:00:00.000Z',
            photo_path: null,
            otp_confirmed: true,
          },
          field_polygon: circlePolygon(PIN, fieldRadiusM(0.5)),
          status: 'active',
          shock_flag: null,
          side_sell_suspected: false,
          sim: true,
        },
      },
    ],
    metrics: [
      {
        id: 'c-given',
        data: {
          contract_id: 'c-given',
          org_id: ORG,
          camp: 'Chikuni',
          source: 'seeded',
          passes: [pass('2026-12-26', null), pass('2027-01-02', null), pass('2027-01-09', 0.5)],
          sim: true,
        },
      },
    ],
    advances: [],
    ledger: [
      {
        id: 'l-inputs',
        data: {
          contract_id: 'c-given',
          farmer_id: 'f-given',
          org_id: ORG,
          at: '2026-10-22T09:00:00.000Z',
          type: 'input_loan',
          amount_zmw: 1950,
          ref: 'INP-001',
          note: 'Inputs',
          simulated: false,
          sim: true,
        },
      },
    ],
    deliveries: [],
    triggers: [],
    rainfall: [],
    sms: [],
    observations: [],
    users: new Map([[BANDA, { role: 'field_officer' as const, display_name: 'Mutale Banda' }]]),
  }
}

// The store: loads hand back a copy, so the service only sees what it committed.
function memoryStore(data: SeasonData) {
  let n = 0
  const store: SeasonStore = {
    async load(orgId) {
      return orgId === ORG ? structuredClone(data) : null
    },
    async commitAdvance(id, from, next, ledger) {
      const current = data.advances.find(a => a.id === id)
      if ((current?.data.state ?? null) !== (from as AdvanceState | null)) return false
      if (current) current.data = next
      else data.advances.push({ id, data: next })
      for (const row of ledger) data.ledger.push({ id: `l-${++n}`, data: row })
      return true
    },
    newId: collection => `${collection}-${++n}`,
    async addEnrolment(farmer, contract, metrics) {
      data.farmers.push(farmer)
      data.contracts.push(contract)
      data.metrics.push({ id: contract.id, data: metrics })
    },
    async addDelivery(id, delivery, ledger) {
      data.deliveries.push({ id, data: delivery })
      for (const row of ledger) data.ledger.push({ id: `l-${++n}`, data: row })
    },
    async logSms(entry) {
      data.sms.push({ id: `s-${++n}`, data: entry })
    },
    async setState(_org, patch) {
      data.state = { ...data.state, ...patch }
    },
    async writeTrigger() {},
    async addObservation(id, observation) {
      data.observations.push({ id, data: observation, severity_pct: null })
    },
    async patchObservation(id, patch) {
      const o = data.observations.find(x => x.id === id)!
      o.data = { ...o.data, ...patch }
    },
  }
  return store
}

const smsLogOnly: SmsSender = {
  name: 'log-only (no SMS gateway configured)',
  send: async to => to.map(number => ({ number, ok: false, status: 'not configured' })),
}

function setup() {
  const data = season()
  const service = seasonService({
    store: memoryStore(data),
    sms: smsLogOnly,
    money: simulatedProvider,
    now: () => REAL_NOW,
  })
  const codeFromSms = () =>
    /code: (\d{6})/.exec(data.sms.filter(s => s.data.purpose === 'otp').pop()!.data.message)![1]
  return { data, service, codeFromSms }
}

const refusal = async (work: Promise<unknown>) => {
  try {
    await work
  } catch (error) {
    if (error instanceof SeasonError) return error
    throw error
  }
  throw new Error('expected a refusal')
}

describe('the CEIH season service', () => {
  it('runs the demo storyline: ground check, request, code, approval, money, ledger', async () => {
    const { data, service, codeFromSms } = setup()

    // Beat 2: one clear pass, two clouded out: not eligible, and no advance can be requested.
    const before = await service.portfolio(david, ORG)
    expect(before.today.slice(0, 10)).toBe('2027-01-12')
    expect(before.rows[0].eligibility_label).toBe('Not eligible: cloud gap, ground check required')
    expect((await refusal(service.requestAdvance(banda, ORG, 'c-given'))).message).toMatch(
      /Not eligible/
    )

    // Beat 3: the officer's ground check lands; eligible at ZMW 840 with its factors.
    await service.groundCheck(david, ORG)
    const card = await service.fieldCard(david, ORG, 'c-given')
    expect(card.eligibility.eligible).toBe(true)
    expect(card.eligibility.cap_zmw).toBe(840)
    expect(card.eligibility.factors.map(f => f.text)).toContain(
      'Cap 15% of the projected crop value ZMW 5,600 (0.5 ha × 1.4 t/ha × ZMW 8,000/t) = ZMW 840, under the ZMW 2,500 ceiling'
    )
    expect(
      card.eligibility.factors.some(f =>
        f.text.startsWith('Field verified 12 Jan by Officer M. Banda, stage R1')
      )
    ).toBe(true)

    // Beat 4: the request; the SMS the farmer reads carries the amount AND the fee (§6.4).
    const { advance_id, amount_zmw, fee_zmw } = await service.requestAdvance(banda, ORG, 'c-given')
    expect([amount_zmw, fee_zmw]).toEqual([840, 42])
    const otp = data.sms.find(s => s.data.purpose === 'otp')!.data
    expect(otp.message).toContain('ZMW 840')
    expect(otp.message).toContain('Fee ZMW 42')
    expect(otp.status).toBe('logged')
    expect(data.advances[0].data.otp_sha256).not.toContain(codeFromSms())

    // Not before the farmer's code; never with a wrong one.
    expect((await refusal(service.approveAdvance(david, ORG, advance_id))).message).toMatch(
      /not confirmed/
    )
    expect(
      (await refusal(service.confirmAdvance(banda, ORG, advance_id, '000000'))).message
    ).toMatch(/does not match/)
    await service.confirmAdvance(banda, ORG, advance_id, codeFromSms())

    // Beat 5: the officer who verified the field cannot approve, whatever their role says.
    expect((await refusal(service.approveAdvance(bandaAsCredit, ORG, advance_id))).message).toMatch(
      /cannot approve/
    )
    expect((await refusal(service.approveAdvance(banda, ORG, advance_id))).code).toBe('forbidden')
    const queue = await service.approvals(bandaAsCredit, ORG)
    expect(queue[0].caller_is_verifier).toBe(true)
    expect((await service.approvals(david, ORG))[0].caller_is_verifier).toBe(false)

    // Beat 6: a second person approves; the simulated transfer, its ledger rows and the SMS.
    const sent = await service.approveAdvance(david, ORG, advance_id)
    expect(sent.simulated).toBe(true)
    expect(data.advances[0].data.state).toBe('disbursed')
    const rows = data.ledger.filter(l => l.data.contract_id === 'c-given').map(l => l.data)
    expect(rows.map(r => [r.type, r.amount_zmw, r.simulated])).toEqual([
      ['input_loan', 1950, false],
      ['advance', 840, true],
      ['advance_fee', 42, true],
    ])
    expect(data.sms.find(s => s.data.purpose === 'disbursement')!.data.message).toMatch(
      /^Phytos DEMO: ZMW 840 sent to your Airtel Money \(simulated transfer, ref SIM-[0-9A-F]{6}\)\. Deducted at harvest with ZMW 42 fee\.$/
    )
    // Never twice.
    expect((await refusal(service.disburse(david, ORG, advance_id))).code).toBe('refused')
    const after = await service.portfolio(david, ORG)
    expect(after.advances_out_zmw).toBe(840)
    expect(after.rows[0].eligibility_label).toBe('Advance sent')

    // Beat 8: June, the delivery, and a statement computed from the ledger rows only.
    await service.setPhase(david, ORG, 'june')
    const s = await service.recordDelivery(david, ORG, {
      contract_id: 'c-given',
      weight_kg: 720,
      moisture_pct: 11,
      grade: 'A',
    })
    expect(s.lines.map(l => l.type)).toEqual(['input_loan', 'advance', 'advance_fee', 'delivery'])
    expect(s.balance_zmw).toBe(balance(s.lines))
    expect(s.balance_zmw).toBe(1950 + 840 + 42 - 5760)
    expect(s.variance.kind).toBe('none')
    expect(data.sms.find(s => s.data.purpose === 'statement')!.data.message).toContain(
      'Net due to you ZMW 2,928'
    )
  })

  it('a farmer cannot reach disbursement without the code, even if the record says approved', async () => {
    const { data, service } = setup()
    await service.groundCheck(david, ORG)
    const { advance_id } = await service.requestAdvance(banda, ORG, 'c-given')
    // Tamper: approved, but no farmer confirmation.
    const a = data.advances[0].data as Advance
    data.advances[0].data = {
      ...a,
      state: 'approved',
      approval: { approver_id: 'uid-david', at: a.requested_at },
    }
    expect((await refusal(service.disburse(david, ORG, advance_id))).message).toMatch(
      /not confirmed/
    )
    expect(data.ledger.filter(l => l.data.type === 'advance')).toHaveLength(0)
  })

  it('approval re-runs the rules on the day: a camp paused since the request cannot be paid', async () => {
    const { data, service, codeFromSms } = setup()
    await service.groundCheck(david, ORG)
    const { advance_id } = await service.requestAdvance(banda, ORG, 'c-given')
    await service.confirmAdvance(banda, ORG, advance_id, codeFromSms())
    // The drought rule flags his camp after he confirmed.
    const contract = data.contracts.find(c => c.id === 'c-given')!
    contract.data = {
      ...contract.data,
      shock_flag: {
        type: 'drought',
        camp: 'Chikuni',
        triggered_at: '2027-01-12T09:00:00.000Z',
        evidence_ref: 't-test',
      },
    }
    const [card] = await service.approvals(david, ORG)
    expect(card.blocked_today).toMatch(/^Not eligible today: Drought flag on Chikuni/)
    expect((await refusal(service.approveAdvance(david, ORG, advance_id))).message).toMatch(
      /^Not eligible today: Drought flag/
    )
    expect(data.ledger.filter(l => l.data.type === 'advance')).toHaveLength(0)
  })

  it('a decline never moves money and tells the farmer why', async () => {
    const { data, service } = setup()
    await service.groundCheck(david, ORG)
    const { advance_id } = await service.requestAdvance(banda, ORG, 'c-given')
    await service.declineAdvance(david, ORG, advance_id, 'Stand too thin on the officer visit')
    expect(data.advances[0].data.state).toBe('declined')
    expect(data.ledger.some(l => l.data.type === 'advance')).toBe(false)
    expect(data.sms.find(s => s.data.purpose === 'decline')!.data.message).toContain(
      'Stand too thin'
    )
  })

  it('keeps the season to its own org, and never sends a pin, a polygon or a whole number', async () => {
    const { service } = setup()
    expect((await refusal(service.portfolio(otherOrg, ORG))).code).toBe('forbidden')
    expect((await refusal(service.groundCheck(banda, ORG))).code).toBe('forbidden')
    const views = JSON.stringify([
      await service.portfolio(david, ORG),
      await service.fieldCard(david, ORG, 'c-given'),
      await service.approvals(david, ORG),
      await service.smsLog(david, ORG),
    ])
    expect(views).not.toContain(String(PIN.latitude))
    expect(views).not.toContain('Polygon')
    expect(views).not.toContain('+260971000000')
    expect(views).not.toMatch(/probab|score|—/i)
  })
})

describe('the geofence link for new reports', () => {
  const contracts = [
    {
      id: 'c-given',
      farmer_id: 'f-given',
      crop: 'soybean',
      polygon: circlePolygon(PIN, fieldRadiusM(0.5)),
      offset_days: OFFSET,
    },
  ]
  const run = async (report: {
    location: { latitude: number; longitude: number }
    crop: string
    reporter_role: string
  }) => {
    const patches: unknown[] = []
    const link = observationLinker({
      load: async () => ({ contracts }),
      get: async () => ({ ...report, created_at: '2026-11-01T12:00:00.000Z', farmer_id: null }),
      patch: async (_id, fields) => {
        patches.push(fields)
      },
    })
    return { farmer: await link('obs-1'), patches }
  }
  it('a soya photo inside Given’s field lands on his record, dated on the season calendar', async () => {
    const { farmer, patches } = await run({
      location: PIN,
      crop: 'soybean',
      reporter_role: 'farmer',
    })
    expect(farmer).toBe('f-given')
    expect(patches[0]).toEqual({
      farmer_id: 'f-given',
      geofence_ok: true,
      source: 'farmer',
      season_at: '2027-01-12T12:00:00.000Z',
    })
  })
  it('a photo 1 km away, or of another crop, lands on nobody', async () => {
    expect(
      (
        await run({
          location: { latitude: PIN.latitude + 0.009, longitude: PIN.longitude },
          crop: 'soybean',
          reporter_role: 'farmer',
        })
      ).farmer
    ).toBeNull()
    expect(
      (await run({ location: PIN, crop: 'tomato', reporter_role: 'farmer' })).farmer
    ).toBeNull()
  })
})

describe('the Fields map', () => {
  it('shows outlines to the org and a Command Center stand-in on a simulated season only', async () => {
    const { data, service } = setup()
    const map = await service.fields(david, ORG)
    expect(map.precise).toBe(true)
    expect(map.fields).toHaveLength(1)
    expect(map.fields[0]).toMatchObject({ contract_id: 'c-given', state: 'cloud_gap' })
    expect((await service.fields(banda, ORG)).precise).toBe(true)
    // A real org: a Command Center account gets camp totals, never an outline or a name.
    data.org.sim = false
    const real = await service.fields(david, ORG)
    expect(real.precise).toBe(false)
    expect(real.fields).toEqual([])
    expect(real.camps[0]).toMatchObject({ camp: 'Chikuni', contracts: 1, cloud_gap: 1 })
    expect(JSON.stringify(real)).not.toContain('Given')
  })

  it('enrols a drawn field: hectares from the outline, the curve following the camp', async () => {
    const { data, service } = setup()
    // About 100 m by 100 m: 1 ha.
    const ring: [number, number][] = [
      [27.4, -16.13],
      [27.40093, -16.13],
      [27.40093, -16.1309],
      [27.4, -16.1309],
    ]
    const made = await service.enrolField(david, ORG, {
      camp: 'Chikuni',
      ring,
      name: 'Mapalo Hangoma',
      phone_msisdn: '+260971000123',
      momo_provider: 'mtn',
      projected_yield_t_ha: 1.5,
      contract_price_zmw_t: 8000,
      consent: true,
    })
    expect(made.contracted_ha).toBeGreaterThan(0.95)
    expect(made.contracted_ha).toBeLessThan(1.05)
    const contract = data.contracts.find(c => c.id === made.contract_id)!.data
    expect(contract.projected_value_zmw).toBe(Math.round(made.contracted_ha * 1.5 * 8000))
    expect(JSON.parse(contract.field_polygon).coordinates[0]).toHaveLength(5)
    expect(data.metrics.find(m => m.id === made.contract_id)!.data.passes).toHaveLength(3)
    const map = await service.fields(david, ORG)
    expect(map.fields.map(f => f.farmer_name)).toContain('Mapalo Hangoma')
    await expect(
      service.enrolField(david, ORG, {
        ...{
          camp: 'Chikuni',
          name: 'X',
          phone_msisdn: '+260971000124',
          momo_provider: 'mtn',
          projected_yield_t_ha: 1.5,
          contract_price_zmw_t: 8000,
          consent: true,
        },
        ring: [
          [27.4, -16.13],
          [27.40001, -16.13],
          [27.40001, -16.13001],
        ],
      })
    ).rejects.toThrow(/trace the boundary again/)
  })
})
