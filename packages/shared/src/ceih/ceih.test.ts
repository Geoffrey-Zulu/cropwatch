import { describe, expect, it } from 'vitest'
import type { Advance, Eligibility, SatellitePass } from '../schemas/ceih'
import {
  capFor,
  checkApprove,
  checkConfirm,
  checkDisburse,
  checkRequest,
  disbursedMessage,
  feeFor,
  otpMessage,
} from './advance'
import { eligibilityLabel, evaluateEligibility, type EligibilityInput } from './eligibility'
import { maskMsisdn, stageRank } from './format'
import { circlePolygon, fieldRadiusM, geofenceOk } from './geofence'
import { balance, priceDelivery, recovered, statementMessage, variance } from './ledger'
import { deriveStatuses, median, statusAt, visiblePasses } from './ndvi'
import { addDays, offsetForPhase, seasonNow } from './season'
import { evaluateShock } from './shock'

const CREDIT = { cap_pct: 0.15, hard_ceiling_zmw: 2500, advance_fee_pct: 0.05 }
const NOW = '2027-01-12T14:00:00.000Z'

function pass(date: string, ndvi: number | null, camp: number | null = 0.49): SatellitePass {
  return {
    date,
    ndvi,
    ndvi_camp_median: camp,
    cloud_pct: ndvi === null ? 92 : 4,
    usable: ndvi !== null,
    collection: 'S2_SR_HARMONIZED',
    computed_at: NOW,
    status_derived: ndvi === null ? 'no_data' : 'established',
    sim: true,
  }
}

const groundCheck = (overrides: Partial<EligibilityInput['observations'][number]> = {}) => ({
  id: 'obs-1',
  at: '2027-01-12T13:58:00.000Z',
  verification_state: 'FIELD_VERIFIED' as const,
  verified_by: 'sim-officer-banda',
  growth_stage: 'V4',
  geofence_ok: true,
  issue: null,
  severity_pct: null,
  severity_band: null,
  intervention: false,
  resolved: false,
  ...overrides,
})

// Given's storyline: projected ZMW 5,600, one clear pass in 21 days, two clouded out.
function given(overrides: Partial<EligibilityInput> = {}): EligibilityInput {
  return {
    now: NOW,
    contract: {
      status: 'active',
      crop: 'soybean',
      projected_value_zmw: 5600,
      contracted_ha: 0.5,
      projected_yield_t_ha: 1.4,
      contract_price_zmw_t: 8000,
      shock_flag: null,
      season: '2026/27',
      camp: 'Chikuni',
    },
    farmer: {
      consent: {
        given_at: '2026-10-14T09:00:00.000Z',
        scope: 'org_contract',
        officer_id: 'sim-officer-banda',
      },
      momo_verified: true,
      momo_provider: 'airtel',
      history: { seasons: 2, defaults: 0, last_recovery_pct: 100 },
    },
    passes: [pass('2026-12-23', null), pass('2026-12-30', null), pass('2027-01-06', 0.5, 0.47)],
    observations: [],
    credit: CREDIT,
    openAdvance: null,
    officerLabel: uid => (uid === 'sim-officer-banda' ? 'Officer M. Banda' : uid),
    ...overrides,
  }
}

describe('eligibility (spec W3, §6.1 and §6.5)', () => {
  it('Given is not eligible on one clear pass: cloud gap, ground check required', () => {
    const e = evaluateEligibility(given())
    expect(e.eligible).toBe(false)
    expect(e.established_by).toBeNull()
    expect(e.factors.length).toBeGreaterThan(0)
    expect(e.factors[0].text).toBe('Satellite: 1 clear pass in 21 days (2 clouded out), 2 needed')
    expect(eligibilityLabel(e)).toBe('Not eligible: cloud gap, ground check required')
    expect(e.cap_zmw).toBe(840)
  })

  it('a ground check by an officer flips him to eligible, with the cap arithmetic', () => {
    const e = evaluateEligibility(given({ observations: [groundCheck()] }))
    expect(e.eligible).toBe(true)
    expect(e.established_by).toBe('officer')
    expect(e.verifier_ids).toEqual(['sim-officer-banda'])
    const texts = e.factors.map(f => f.text)
    expect(texts).toContain('Field verified 12 Jan by Officer M. Banda, stage V4')
    expect(texts).toContain('No open severe issues')
    expect(texts).toContain(
      'Cap 15% of the projected crop value ZMW 5,600 (0.5 ha × 1.4 t/ha × ZMW 8,000/t) = ZMW 840, under the ZMW 2,500 ceiling'
    )
    expect(eligibilityLabel(e)).toBe('Eligible · cap ZMW 840')
  })

  it('says which source satisfied the establishment rule', () => {
    const passes = [
      pass('2026-12-30', 0.46, 0.45),
      pass('2027-01-06', 0.5, 0.47),
      pass('2027-01-10', 0.52, 0.49),
    ]
    const e = evaluateEligibility(given({ passes }))
    expect(e.eligible).toBe(true)
    expect(e.established_by).toBe('satellite')
    expect(e.factors[0]).toMatchObject({
      source: 'satellite',
      met: true,
      text: 'Satellite: 3 clear passes, NDVI 0.52 vs camp 0.49, on calendar',
    })
    expect(e.verifier_ids).toEqual([])
  })

  it('an observation outside the geofence never counts', () => {
    const e = evaluateEligibility(given({ observations: [groundCheck({ geofence_ok: false })] }))
    expect(e.eligible).toBe(false)
    expect(e.factors.some(f => f.text.includes('fell outside the field'))).toBe(true)
    const unchecked = evaluateEligibility(
      given({ observations: [groundCheck({ geofence_ok: null })] })
    )
    expect(unchecked.eligible).toBe(false)
  })

  it('a pass marked unusable never counts, whatever its NDVI', () => {
    const cloudy = { ...pass('2026-12-30', 0.6, 0.45), usable: false }
    const e = evaluateEligibility(
      given({
        passes: [
          cloudy,
          { ...pass('2027-01-02', 0.6, 0.45), usable: false },
          pass('2027-01-06', 0.5),
        ],
      })
    )
    expect(e.eligible).toBe(false)
  })

  it('an unverified photo, a low stage or an old check does not establish the crop', () => {
    for (const check of [
      groundCheck({ verification_state: 'AI_ASSESSED', verified_by: null }),
      groundCheck({ growth_stage: 'V2' }),
      groundCheck({ growth_stage: null }),
      groundCheck({ at: '2026-12-01T10:00:00.000Z' }),
    ]) {
      expect(evaluateEligibility(given({ observations: [check] })).eligible).toBe(false)
    }
    expect(
      eligibilityLabel(
        evaluateEligibility(
          given({
            observations: [groundCheck({ verification_state: 'AI_ASSESSED', verified_by: null })],
          })
        )
      )
    ).toBe('Not eligible: waiting for verification')
  })

  it('an open severe issue with no intervention pauses the advance; an intervention lifts it', () => {
    const issue = groundCheck({ id: 'obs-2', issue: 'fall_armyworm', severity_pct: 45 })
    const paused = evaluateEligibility(given({ observations: [groundCheck(), issue] }))
    expect(paused.eligible).toBe(false)
    expect(eligibilityLabel(paused)).toBe('Paused: severe issue open')
    const treated = evaluateEligibility(
      given({ observations: [groundCheck(), { ...issue, intervention: true }] })
    )
    expect(treated.eligible).toBe(true)
    const mild = evaluateEligibility(
      given({ observations: [groundCheck(), { ...issue, severity_pct: 39 }] })
    )
    expect(mild.eligible).toBe(true)
  })

  it('a not-planted field reads as not planted', () => {
    const flat = [
      { ...pass('2026-12-30', 0.15), status_derived: 'not_planted' as const },
      { ...pass('2027-01-06', 0.14), status_derived: 'not_planted' as const },
    ]
    expect(eligibilityLabel(evaluateEligibility(given({ passes: flat })))).toBe(
      'Not eligible: no crop seen'
    )
  })

  it('the farmer record, the shock flag and one advance a season each block', () => {
    const base = { observations: [groundCheck()] }
    expect(
      evaluateEligibility(given({ ...base, farmer: { ...given().farmer, consent: null } })).eligible
    ).toBe(false)
    expect(
      evaluateEligibility(given({ ...base, farmer: { ...given().farmer, momo_verified: false } }))
        .eligible
    ).toBe(false)
    expect(
      evaluateEligibility(
        given({
          ...base,
          farmer: {
            ...given().farmer,
            history: { seasons: 3, defaults: 1, last_recovery_pct: 40 },
          },
        })
      ).eligible
    ).toBe(false)
    const shocked = evaluateEligibility(
      given({
        ...base,
        contract: {
          ...given().contract,
          shock_flag: {
            type: 'drought',
            camp: 'Chikuni',
            triggered_at: '2027-01-10T08:00:00.000Z',
            evidence_ref: 't1',
          },
        },
      })
    )
    expect(eligibilityLabel(shocked)).toBe('Paused: drought flag on the camp')
    const twice = evaluateEligibility(
      given({ ...base, openAdvance: { amount_zmw: 840, state: 'disbursed' } })
    )
    expect(eligibilityLabel(twice)).toBe('Advance sent')
  })

  it('holds the cap at the hard ceiling', () => {
    const e = evaluateEligibility(
      given({ contract: { ...given().contract, projected_value_zmw: 20_000 } })
    )
    expect(e.cap_zmw).toBe(2500)
    expect(e.factors.find(f => f.code === 'cap')!.text).toBe(
      'Cap 15% of the projected crop value ZMW 20,000 (0.5 ha × 1.4 t/ha × ZMW 8,000/t) = ZMW 3,000, held at the ZMW 2,500 ceiling'
    )
  })

  it('never puts a score or a probability in a factor', () => {
    const e = evaluateEligibility(given({ observations: [groundCheck()] }))
    for (const f of e.factors) {
      expect(f.text).not.toMatch(/probab|score|confiden|—/i)
    }
  })
})

// --------------------------------------------------------------- advance state machine

function snapshot(verifiers: string[]): Eligibility {
  return {
    ...evaluateEligibility(given({ observations: [groundCheck()] })),
    verifier_ids: verifiers,
  }
}

function advance(overrides: Partial<Advance> = {}): Advance {
  return {
    contract_id: 'sim-contract-given',
    farmer_id: 'sim-farmer-given',
    org_id: 'demo-outgrower',
    season: '2026/27',
    state: 'requested',
    requested_at: NOW,
    requested_via: 'officer',
    requested_by: 'uid-david',
    eligibility_snapshot: snapshot(['sim-officer-banda']),
    amount_zmw: 840,
    fee_zmw: 42,
    otp_sha256: 'hash-of-482913',
    otp_expires_at: '2027-01-12T14:30:00.000Z',
    farmer_confirmed: null,
    approval: null,
    decline: null,
    disbursement: null,
    sim: true,
    ...overrides,
  }
}

describe('advances (spec W4, invariant 11, §6.2 and §6.4)', () => {
  it('cap and fee', () => {
    expect(capFor(5600, CREDIT)).toBe(840)
    expect(feeFor(840, CREDIT)).toBe(42)
    // 5% of 2,350 is 117.50: never rounded up against the farmer.
    expect(feeFor(2350, CREDIT)).toBe(117)
  })

  it('a request must be eligible and within the cap', () => {
    expect(checkRequest(snapshot([]), 840).ok).toBe(true)
    expect(checkRequest(snapshot([]), 841)).toMatchObject({ ok: false, code: 'amount_over_cap' })
    expect(checkRequest(evaluateEligibility(given()), 500)).toMatchObject({
      ok: false,
      code: 'not_eligible',
    })
  })

  it('the farmer confirms with the code they were sent, before it expires', () => {
    expect(checkConfirm(advance(), 'hash-of-482913', NOW).ok).toBe(true)
    expect(checkConfirm(advance(), 'hash-of-000000', NOW)).toMatchObject({ code: 'otp_wrong' })
    expect(checkConfirm(advance(), 'hash-of-482913', '2027-01-12T14:31:00.000Z')).toMatchObject({
      code: 'otp_expired',
    })
    expect(checkConfirm(advance({ state: 'farmer_confirmed' }), 'hash-of-482913', NOW).ok).toBe(
      false
    )
  })

  it('cannot be approved before the farmer confirms', () => {
    expect(checkApprove(advance(), 'uid-david')).toMatchObject({ ok: false, code: 'not_confirmed' })
  })

  it('cannot be approved by the officer who verified the field (maker-checker)', () => {
    const confirmed = advance({
      state: 'farmer_confirmed',
      farmer_confirmed: { at: NOW, otp_ok: true },
    })
    expect(checkApprove(confirmed, 'sim-officer-banda')).toMatchObject({
      ok: false,
      code: 'approver_is_verifier',
    })
    expect(checkApprove(confirmed, 'uid-david').ok).toBe(true)
  })

  it('cannot reach disbursement without otp_ok and a distinct approver (§6.2)', () => {
    const approved = {
      state: 'approved' as const,
      farmer_confirmed: { at: NOW, otp_ok: true },
      approval: { approver_id: 'uid-david', at: NOW },
    }
    expect(checkDisburse(advance(approved)).ok).toBe(true)
    // No farmer confirmation.
    expect(checkDisburse(advance({ ...approved, farmer_confirmed: null })).ok).toBe(false)
    expect(
      checkDisburse(advance({ ...approved, farmer_confirmed: { at: NOW, otp_ok: false } })).ok
    ).toBe(false)
    // No approval.
    expect(
      checkDisburse(advance({ ...approved, state: 'farmer_confirmed', approval: null })).ok
    ).toBe(false)
    // The verifier approved: refused even if the state says approved.
    expect(
      checkDisburse(
        advance({ ...approved, approval: { approver_id: 'sim-officer-banda', at: NOW } })
      )
    ).toMatchObject({ ok: false, code: 'approver_is_verifier' })
    // Never twice.
    expect(
      checkDisburse(
        advance({
          ...approved,
          disbursement: { provider: 'simulated', tx_ref: 'SIM-1', at: NOW, status: 'simulated' },
        })
      ).ok
    ).toBe(false)
  })

  it('the SMS before confirmation carries the amount and the fee (§6.4)', () => {
    const text = otpMessage({
      org: 'DEMO OUTGROWER CO.',
      farmerName: 'Given Mweemba',
      amountZmw: 840,
      feeZmw: 42,
      code: '482913',
    })
    expect(text).toContain('ZMW 840')
    expect(text).toContain('Fee ZMW 42')
    expect(text).toContain('482913')
    expect(text).not.toContain('—')
    expect(
      disbursedMessage({
        amountZmw: 840,
        feeZmw: 42,
        wallet: 'Airtel Money',
        txRef: 'SIM-7Q2X',
        simulated: true,
      })
    ).toBe(
      'Phytos: ZMW 840 sent to your Airtel Money (simulated transfer, ref SIM-7Q2X). Deducted at harvest with ZMW 42 fee.'
    )
  })
})

// --------------------------------------------------------------- ledger, geofence, curves, shock

describe('ledger (§6.3)', () => {
  const rows = [
    { type: 'input_loan' as const, amount_zmw: 1950 },
    { type: 'advance' as const, amount_zmw: 840 },
    { type: 'advance_fee' as const, amount_zmw: 42 },
    { type: 'delivery' as const, amount_zmw: -5800 },
  ]
  it('totals come from the rows', () => {
    expect(balance(rows)).toBe(-2968)
    expect(recovered(rows)).toBe(2832)
    expect(balance([...rows, { type: 'payout', amount_zmw: 2968 }])).toBe(0)
  })
  it('prices a delivery at the contract price for its grade', () => {
    expect(priceDelivery(2000, 'A', 2900)).toEqual({ price_zmw_t: 2000, value_zmw: 5800 })
    expect(priceDelivery(2000, 'B', 1000)).toEqual({ price_zmw_t: 1840, value_zmw: 1840 })
  })
  it('separates a shock shortfall from an unexplained one', () => {
    const contract = { contracted_ha: 2, projected_yield_t_ha: 1.4, shock_flag: null }
    expect(variance({ contract, deliveredT: 2.9, verifiedIssue: null }).kind).toBe('none')
    expect(variance({ contract, deliveredT: 1.0, verifiedIssue: null }).kind).toBe('unexplained')
    const shocked = {
      ...contract,
      shock_flag: {
        type: 'drought' as const,
        camp: 'Hamangaba',
        triggered_at: '2027-03-14T08:00:00.000Z',
        evidence_ref: 't1',
      },
    }
    expect(variance({ contract: shocked, deliveredT: 1.2, verifiedIssue: null })).toMatchObject({
      kind: 'shock',
    })
    expect(variance({ contract: shocked, deliveredT: 0.3, verifiedIssue: null }).kind).toBe(
      'unexplained'
    )
  })
  it('the statement SMS lists every line', () => {
    const text = statementMessage({ farmerName: 'Given Mweemba', lines: rows, netZmw: 2968 })
    for (const part of [
      'ZMW 1,950',
      'ZMW 840',
      'ZMW 42',
      'ZMW 5,800',
      'Net due to you ZMW 2,968',
    ]) {
      expect(text).toContain(part)
    }
  })
})

describe('geofence', () => {
  const pin = { latitude: -16.2385, longitude: 27.4512 }
  const polygon = circlePolygon(pin, fieldRadiusM(2))
  it('a 2 ha field is about 80 m across the radius', () => {
    expect(Math.round(fieldRadiusM(2))).toBe(80)
  })
  it('inside, within the 150 m margin, and outside', () => {
    expect(geofenceOk(pin, polygon)).toBe(true)
    // ~200 m north: 80 m radius + 150 m margin.
    expect(geofenceOk({ latitude: pin.latitude + 0.0018, longitude: pin.longitude }, polygon)).toBe(
      true
    )
    // ~400 m north.
    expect(geofenceOk({ latitude: pin.latitude + 0.0036, longitude: pin.longitude }, polygon)).toBe(
      false
    )
    expect(geofenceOk(pin, 'not a polygon')).toBe(false)
  })
})

describe('satellite curve status', () => {
  const planted = '2026-11-18'
  it('reads not planted, field stress, shared stress and established', () => {
    const late = '2027-01-06'
    expect(
      statusAt(
        { date: late, ndvi: 0.15, ndvi_camp_median: 0.47, usable: true },
        null,
        planted,
        'soybean'
      )
    ).toBe('not_planted')
    expect(
      statusAt(
        { date: late, ndvi: 0.4, ndvi_camp_median: 0.5, usable: true },
        { date: '2026-12-30', ndvi: 0.48, ndvi_camp_median: 0.47, usable: true },
        planted,
        'soybean'
      )
    ).toBe('field_stress')
    expect(
      statusAt(
        { date: late, ndvi: 0.4, ndvi_camp_median: 0.41, usable: true },
        { date: '2026-12-30', ndvi: 0.48, ndvi_camp_median: 0.49, usable: true },
        planted,
        'soybean'
      )
    ).toBe('shared_stress')
    expect(
      statusAt(
        { date: late, ndvi: 0.5, ndvi_camp_median: 0.47, usable: true },
        null,
        planted,
        'soybean'
      )
    ).toBe('established')
    expect(
      statusAt(
        { date: late, ndvi: null, ndvi_camp_median: 0.47, usable: false },
        null,
        planted,
        'soybean'
      )
    ).toBe('no_data')
  })
  it('derives over a curve, skipping clouded passes, and hides the future', () => {
    const curve = deriveStatuses(
      [pass('2027-01-06', 0.4, 0.5), pass('2026-12-30', null), pass('2026-12-23', 0.48, 0.47)],
      planted,
      'soybean'
    )
    expect(curve.map(p => p.status_derived)).toEqual(['established', 'no_data', 'field_stress'])
    expect(visiblePasses(curve, '2026-12-30T10:00:00Z').map(p => p.date)).toEqual([
      '2026-12-23',
      '2026-12-30',
    ])
    expect(median([0.4, 0.5, 0.45])).toBe(0.45)
    expect(median([])).toBeNull()
  })
})

describe('shock trigger (spec W5)', () => {
  const dry = Array.from({ length: 30 }, (_, i) => ({
    date: addDays('2027-03-16', -i),
    rain_mm: 1,
  }))
  const falling = (from: number, to: number) => [
    pass('2027-02-20', from, 0.58),
    pass('2027-03-06', (from + to) / 2, 0.5),
    pass('2027-03-13', to, 0.41),
  ]
  it('fires only when rain and the camp curve agree', () => {
    const fields = Array.from({ length: 10 }, () => falling(0.6, 0.4))
    const fired = evaluateShock({
      today: '2027-03-16',
      rain: dry,
      fields,
      plantingDate: '2026-11-18',
    })
    expect(fired).toMatchObject({ fired: true, rain_30d: 30, fields_falling: 10, fields_total: 10 })
    const wet = dry.map(d => ({ ...d, rain_mm: 6 }))
    expect(
      evaluateShock({ today: '2027-03-16', rain: wet, fields, plantingDate: '2026-11-18' }).fired
    ).toBe(false)
    const green = Array.from({ length: 10 }, () => falling(0.5, 0.55))
    expect(
      evaluateShock({ today: '2027-03-16', rain: dry, fields: green, plantingDate: '2026-11-18' })
        .fired
    ).toBe(false)
  })
  it('never fires at harvest: a dry June with every field maturing is the season ending', () => {
    const june = Array.from({ length: 30 }, (_, i) => ({
      date: addDays('2027-06-10', -i),
      rain_mm: 0,
    }))
    const maturing = Array.from({ length: 10 }, () => [
      pass('2027-05-15', 0.6, 0.6),
      pass('2027-05-29', 0.45, 0.45),
      pass('2027-06-05', 0.3, 0.3),
    ])
    const harvest = evaluateShock({
      today: '2027-06-10',
      rain: june,
      fields: maturing,
      plantingDate: '2026-11-18',
    })
    expect(harvest.fired).toBe(false)
    expect(harvest.factors[0]).toMatch(/^Outside the growing season/)
  })
})

describe('season calendar and formatting', () => {
  it('lands the demo day on the phase date and keeps the time of day', () => {
    const real = '2026-11-01T13:05:00.000Z'
    const offset = offsetForPhase('january', real)
    expect(seasonNow(real, offset)).toBe('2027-01-12T13:05:00.000Z')
    expect(seasonNow(real, offsetForPhase('june', real)).slice(0, 10)).toBe('2027-06-10')
  })
  it('stages and phone numbers', () => {
    expect(stageRank('V4')).toBe(4)
    expect(stageRank('ve')).toBe(0)
    expect(stageRank('R1')).toBeGreaterThan(stageRank('V12')!)
    expect(stageRank('flowering')).toBeNull()
    expect(maskMsisdn('+260971234567')).toBe('097 ••• 4567')
  })
})
