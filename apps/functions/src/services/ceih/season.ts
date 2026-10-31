import { createHash, randomInt } from 'node:crypto'
import {
  ADVANCE_APPROVER_ROLES,
  checkApprove,
  checkConfirm,
  checkDisburse,
  checkRequest,
  COMMAND_CENTER_ROLES,
  disbursedMessage,
  evaluateShock,
  feeFor,
  geofenceOk,
  LEDGER_LABELS,
  MOMO_LABELS,
  offsetForPhase,
  OTP_LENGTH,
  OTP_TTL_MINUTES,
  otpMessage,
  priceDelivery,
  SATELLITE_COLLECTION,
  seasonNow,
  simPhotoPath,
  statementMessage,
  variance,
  visiblePasses,
  geohash,
  balance,
  districtSlug,
  findDistrict,
  type Advance,
  type Approval,
  type DeliveryInput,
  type Eligibility,
  type FieldCard,
  type LedgerEntry,
  type Portfolio,
  type Reconciliation,
  type SeasonPhase,
  type SmsLog,
  type SmsLogView,
  type Statement,
} from '@repo/shared'
import type { SmsSender } from '../alerts/sms'
import type { Caller } from '../observationModel'
import type { MobileMoney } from './mobileMoney'
import type { SeasonStore } from './store'
import {
  approvals,
  eligibilityFor,
  fieldCard,
  portfolio,
  reconciliation,
  seasonToday,
  smsLog,
  statement,
  type SeasonData,
} from './views'

// The CEIH service (docs/ceih-overnight-plan.md, Phase 2). Reads build the dashboard views from
// one load; every action re-checks its rule on fresh data, and money moves only through
// approve → disburse with the farmer's code, a second person and ledger rows (invariant 11).

export class SeasonError extends Error {
  constructor(
    readonly code: 'not_found' | 'forbidden' | 'refused',
    message: string
  ) {
    super(message)
  }
}

export interface SeasonService {
  portfolio(caller: Caller, orgId: string): Promise<Portfolio>
  fieldCard(caller: Caller, orgId: string, contractId: string): Promise<FieldCard>
  eligibility(caller: Caller, orgId: string, farmerId: string): Promise<Eligibility>
  approvals(caller: Caller, orgId: string): Promise<Approval[]>
  statement(caller: Caller, orgId: string, contractId: string): Promise<Statement>
  reconciliation(caller: Caller, orgId: string): Promise<Reconciliation>
  smsLog(caller: Caller, orgId: string): Promise<SmsLogView[]>
  requestAdvance(
    caller: Caller,
    orgId: string,
    contractId: string,
    amountZmw?: number
  ): Promise<{ advance_id: string; amount_zmw: number; fee_zmw: number }>
  confirmAdvance(caller: Caller, orgId: string, advanceId: string, code: string): Promise<void>
  approveAdvance(
    caller: Caller,
    orgId: string,
    advanceId: string
  ): Promise<{ tx_ref: string | null; simulated: boolean }>
  disburse(
    caller: Caller,
    orgId: string,
    advanceId: string
  ): Promise<{ tx_ref: string | null; simulated: boolean }>
  declineAdvance(caller: Caller, orgId: string, advanceId: string, reason: string): Promise<void>
  recordDelivery(caller: Caller, orgId: string, input: DeliveryInput): Promise<Statement>
  evaluateTriggers(caller: Caller, orgId: string): Promise<{ camp: string; fired: boolean }[]>
  // Demo controls (Command Center, simulated orgs only).
  setPhase(caller: Caller, orgId: string, phase: SeasonPhase): Promise<{ today: string }>
  groundCheck(caller: Caller, orgId: string): Promise<{ obs_id: string; live: boolean }>
}

export interface SeasonDeps {
  store: SeasonStore
  sms: SmsSender
  money: MobileMoney
  now?: () => Date
}

export const hashCode = (code: string) => createHash('sha256').update(code.trim()).digest('hex')

// Who sees an org's season: its own credit team and field officers (farmer level, under the
// farmers' contract consent: invariant 6 as amended), and Command Center accounts.
function canRead(caller: Caller, orgId: string) {
  return (
    COMMAND_CENTER_ROLES.includes(caller.role) ||
    ((caller.role === 'credit' || caller.role === 'field_officer') && caller.orgId === orgId)
  )
}
function canApprove(caller: Caller, orgId: string) {
  return (
    ADVANCE_APPROVER_ROLES.includes(caller.role) &&
    (caller.role !== 'credit' || caller.orgId === orgId)
  )
}

export function seasonService({
  store,
  sms,
  money,
  now = () => new Date(),
}: SeasonDeps): SeasonService {
  const realNow = () => now().toISOString()
  const gateway = !sms.name.startsWith('log-only')

  async function load(caller: Caller, orgId: string) {
    if (!canRead(caller, orgId))
      throw new SeasonError('forbidden', 'This account cannot see that season.')
    const data = await store.load(orgId)
    if (!data) throw new SeasonError('not_found', 'No season for this organisation.')
    return { data, today: seasonToday(data, realNow()) }
  }

  const contractOf = (data: SeasonData, contractId: string) => {
    const contract = data.contracts.find(c => c.id === contractId)
    if (!contract) throw new SeasonError('not_found', 'No such contract.')
    const farmer = data.farmers.find(f => f.id === contract.data.farmer_id)!
    return { contract, farmer }
  }

  const advanceIn = (data: SeasonData, advanceId: string) => {
    const advance = data.advances.find(a => a.id === advanceId)
    if (!advance) throw new SeasonError('not_found', 'No such advance.')
    return advance
  }

  // Every message is logged; a real SMS goes only through a configured gateway, and for a
  // simulated farmer only to a number on the demo allow-list.
  async function text(
    data: SeasonData,
    farmerId: string | null,
    to: string,
    message: string,
    purpose: SmsLog['purpose'],
    today: string
  ) {
    const farmer = data.farmers.find(f => f.id === farmerId)
    const live = gateway && (!farmer?.data.sim || data.state.sms_allow.includes(to))
    let status: SmsLog['status'] = 'logged'
    if (live) {
      const [result] = await sms
        .send([to], message)
        .catch(() => [{ number: to, ok: false, status: 'error' }])
      status = result?.ok ? 'sent' : 'failed'
    }
    await store.logSms({
      org_id: data.org.id,
      farmer_id: farmerId,
      to,
      message,
      purpose,
      status,
      gateway: live ? sms.name : 'log only',
      at: realNow(),
      season_at: today,
      sim: farmer?.data.sim ?? data.org.sim,
    })
  }

  const service: SeasonService = {
    async portfolio(caller, orgId) {
      const { data, today } = await load(caller, orgId)
      return portfolio(data, today)
    },

    async fieldCard(caller, orgId, contractId) {
      const { data, today } = await load(caller, orgId)
      const card = fieldCard(data, contractId, today)
      if (!card) throw new SeasonError('not_found', 'No such contract.')
      return card
    },

    async eligibility(caller, orgId, farmerId) {
      const { data, today } = await load(caller, orgId)
      const contract = data.contracts.find(
        c => c.data.farmer_id === farmerId && c.data.status === 'active'
      )
      if (!contract) throw new SeasonError('not_found', 'No active contract for that farmer.')
      return eligibilityFor(data, contract.id, today)
    },

    async approvals(caller, orgId) {
      const { data, today } = await load(caller, orgId)
      return approvals(data, today, caller.uid)
    },

    async statement(caller, orgId, contractId) {
      const { data, today } = await load(caller, orgId)
      const s = statement(data, contractId, today)
      if (!s) throw new SeasonError('not_found', 'No such contract.')
      return s
    },

    async reconciliation(caller, orgId) {
      const { data, today } = await load(caller, orgId)
      return reconciliation(data, today)
    },

    async smsLog(caller, orgId) {
      const { data } = await load(caller, orgId)
      return smsLog(data)
    },

    async requestAdvance(caller, orgId, contractId, amountZmw) {
      const { data, today } = await load(caller, orgId)
      const { contract, farmer } = contractOf(data, contractId)
      const eligibility = eligibilityFor(data, contractId, today)
      const amount = amountZmw ?? eligibility.cap_zmw
      const check = checkRequest(eligibility, amount)
      if (!check.ok) throw new SeasonError('refused', check.message)
      const fee = feeFor(amount, data.org.credit)
      const code = String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0')
      const id = store.newId('advances')
      const advance: Advance = {
        contract_id: contract.id,
        farmer_id: farmer.id,
        org_id: orgId,
        season: contract.data.season,
        state: 'requested',
        requested_at: today,
        requested_via: 'officer',
        requested_by: caller.uid,
        eligibility_snapshot: eligibility,
        amount_zmw: amount,
        fee_zmw: fee,
        otp_sha256: hashCode(code),
        otp_expires_at: new Date(now().getTime() + OTP_TTL_MINUTES * 60_000).toISOString(),
        farmer_confirmed: null,
        approval: null,
        decline: null,
        disbursement: null,
        sim: farmer.data.sim,
      }
      if (!(await store.commitAdvance(id, null, advance, [])))
        throw new SeasonError('refused', 'This advance already exists.')
      // The farmer sees the amount and the fee before anything can be confirmed (spec §6.4).
      await text(
        data,
        farmer.id,
        farmer.data.phone_msisdn,
        otpMessage({
          org: data.org.name,
          farmerName: farmer.data.name,
          amountZmw: amount,
          feeZmw: fee,
          code,
        }),
        'otp',
        today
      )
      return { advance_id: id, amount_zmw: amount, fee_zmw: fee }
    },

    async confirmAdvance(caller, orgId, advanceId, code) {
      const { data, today } = await load(caller, orgId)
      const advance = advanceIn(data, advanceId)
      const check = checkConfirm(advance.data, hashCode(code), realNow())
      if (!check.ok) throw new SeasonError('refused', check.message)
      const next: Advance = {
        ...advance.data,
        state: 'farmer_confirmed',
        otp_sha256: null,
        farmer_confirmed: { at: today, otp_ok: true },
      }
      if (!(await store.commitAdvance(advance.id, 'requested', next, [])))
        throw new SeasonError('refused', 'Someone else changed this advance first. Refresh.')
    },

    async approveAdvance(caller, orgId, advanceId) {
      if (!canApprove(caller, orgId))
        throw new SeasonError('forbidden', 'Only the credit team can approve advances.')
      const { data, today } = await load(caller, orgId)
      const advance = advanceIn(data, advanceId)
      const check = checkApprove(advance.data, caller.uid)
      if (!check.ok) throw new SeasonError('refused', check.message)
      const next: Advance = {
        ...advance.data,
        state: 'approved',
        approval: { approver_id: caller.uid, at: today },
      }
      if (!(await store.commitAdvance(advance.id, 'farmer_confirmed', next, [])))
        throw new SeasonError('refused', 'Someone else changed this advance first. Refresh.')
      return service.disburse(caller, orgId, advanceId)
    },

    async disburse(caller, orgId, advanceId) {
      if (!canApprove(caller, orgId))
        throw new SeasonError('forbidden', 'Only the credit team can send advances.')
      const { data, today } = await load(caller, orgId)
      const advance = advanceIn(data, advanceId)
      const check = checkDisburse(advance.data)
      if (!check.ok) throw new SeasonError('refused', check.message)
      const { farmer } = contractOf(data, advance.data.contract_id)
      const result = await money.disburse(
        farmer.data.phone_msisdn,
        advance.data.amount_zmw,
        advance.id
      )
      const sent = result.status !== 'failed'
      const ref = result.tx_ref ?? advance.id
      const row = (type: 'advance' | 'advance_fee', amount: number): LedgerEntry => ({
        contract_id: advance.data.contract_id,
        farmer_id: farmer.id,
        org_id: orgId,
        at: today,
        type,
        amount_zmw: amount,
        ref,
        note:
          type === 'advance'
            ? `${LEDGER_LABELS.advance} to ${MOMO_LABELS[farmer.data.momo_provider]}${money.simulated ? ' (simulated transfer)' : ''}`
            : 'Advance fee, shown before the farmer confirmed',
        simulated: money.simulated,
        sim: advance.data.sim,
      })
      const next: Advance = {
        ...advance.data,
        state: sent ? 'disbursed' : 'failed',
        disbursement: {
          provider: money.name,
          tx_ref: result.tx_ref,
          at: today,
          status: result.status,
        },
      }
      // The money and its ledger rows land together, or not at all.
      if (
        !(await store.commitAdvance(
          advance.id,
          'approved',
          next,
          sent
            ? [row('advance', advance.data.amount_zmw), row('advance_fee', advance.data.fee_zmw)]
            : []
        ))
      )
        throw new SeasonError('refused', 'This advance was already sent.')
      if (sent)
        await text(
          data,
          farmer.id,
          farmer.data.phone_msisdn,
          disbursedMessage({
            amountZmw: advance.data.amount_zmw,
            feeZmw: advance.data.fee_zmw,
            wallet: MOMO_LABELS[farmer.data.momo_provider],
            txRef: ref,
            simulated: money.simulated,
          }),
          'disbursement',
          today
        )
      return { tx_ref: result.tx_ref, simulated: money.simulated }
    },

    async declineAdvance(caller, orgId, advanceId, reason) {
      if (!canApprove(caller, orgId))
        throw new SeasonError('forbidden', 'Only the credit team can decline advances.')
      const { data, today } = await load(caller, orgId)
      const advance = advanceIn(data, advanceId)
      if (!['requested', 'farmer_confirmed'].includes(advance.data.state))
        throw new SeasonError('refused', 'This advance is no longer waiting.')
      const next: Advance = {
        ...advance.data,
        state: 'declined',
        otp_sha256: null,
        decline: { by: caller.uid, at: today, reason: reason.trim() },
      }
      if (!(await store.commitAdvance(advance.id, advance.data.state, next, [])))
        throw new SeasonError('refused', 'Someone else changed this advance first. Refresh.')
      const farmer = data.farmers.find(f => f.id === advance.data.farmer_id)!
      await text(
        data,
        farmer.id,
        farmer.data.phone_msisdn,
        `Phytos DEMO: ${farmer.data.name.split(' ')[0]}, your advance request was not approved: ${reason.trim()}. Your officer will explain.`,
        'decline',
        today
      )
    },

    async recordDelivery(caller, orgId, input) {
      if (!canApprove(caller, orgId))
        throw new SeasonError(
          'forbidden',
          'Only the credit team or the depot can record deliveries.'
        )
      const { data, today } = await load(caller, orgId)
      const { contract, farmer } = contractOf(data, input.contract_id)
      if (data.deliveries.some(d => d.data.contract_id === contract.id && d.data.at <= today))
        throw new SeasonError('refused', 'This contract already has its delivery.')
      const { price_zmw_t, value_zmw } = priceDelivery(
        contract.data.contract_price_zmw_t,
        input.grade,
        input.weight_kg
      )
      const id = store.newId('deliveries')
      const delivery = {
        contract_id: contract.id,
        farmer_id: farmer.id,
        org_id: orgId,
        at: today,
        weight_kg: input.weight_kg,
        moisture_pct: input.moisture_pct,
        grade: input.grade,
        price_zmw_t,
        value_zmw,
        clerk_id: caller.uid,
        sim: contract.data.sim,
      }
      const row: LedgerEntry = {
        contract_id: contract.id,
        farmer_id: farmer.id,
        org_id: orgId,
        at: today,
        type: 'delivery',
        amount_zmw: -value_zmw,
        ref: id,
        note: `${(input.weight_kg / 1000).toFixed(2)} t grade ${input.grade} at ${price_zmw_t} a tonne`,
        simulated: false,
        sim: contract.data.sim,
      }
      const shocked =
        contract.data.shock_flag && contract.data.shock_flag.triggered_at <= today
          ? contract.data
          : { ...contract.data, shock_flag: null }
      const v = variance({
        contract: shocked,
        deliveredT: Math.round(input.weight_kg / 10) / 100,
        verifiedIssue: null,
      })
      await store.addDelivery(id, delivery, [row], v.kind === 'unexplained')
      const rows = [
        ...data.ledger
          .filter(l => l.data.contract_id === contract.id && l.data.at <= today)
          .map(l => l.data),
        row,
      ]
      await text(
        data,
        farmer.id,
        farmer.data.phone_msisdn,
        statementMessage({ farmerName: farmer.data.name, lines: rows, netZmw: -balance(rows) }),
        'statement',
        today
      )
      const fresh = await store.load(orgId)
      return statement(fresh!, contract.id, today)!
    },

    async evaluateTriggers(caller, orgId) {
      if (!COMMAND_CENTER_ROLES.includes(caller.role) && !canApprove(caller, orgId))
        throw new SeasonError('forbidden', 'Not allowed to evaluate the shock rule.')
      const { data, today } = await load(caller, orgId)
      const camps = [...new Set(data.contracts.map(c => c.data.camp))]
      const results: { camp: string; fired: boolean }[] = []
      for (const camp of camps) {
        const members = data.contracts.filter(
          c => c.data.camp === camp && c.data.status === 'active'
        )
        const rain = data.rainfall.find(r => r.data.camp === camp)
        if (!rain) continue
        const shock = evaluateShock({
          today,
          rain: rain.data.days,
          fields: members.map(c =>
            visiblePasses(data.metrics.find(m => m.id === c.id)?.data.passes ?? [], today)
          ),
        })
        const id = store.newId('weather_triggers')
        const unflagged = members.filter(
          c => !c.data.shock_flag || c.data.shock_flag.triggered_at > today
        )
        await store.writeTrigger(
          id,
          {
            org_id: orgId,
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
            source: `${rain.data.source}; ${SATELLITE_COLLECTION} camp median`,
            evaluated_at: today,
            sim: rain.data.sim,
          },
          shock.fired && unflagged.length
            ? {
                contractIds: unflagged.map(c => c.id),
                flag: { type: 'drought', camp, triggered_at: today, evidence_ref: id },
              }
            : null
        )
        results.push({ camp, fired: shock.fired })
      }
      return results
    },

    async setPhase(caller, orgId, phase) {
      await demoOnly(caller, orgId)
      const offset_days = offsetForPhase(phase, realNow())
      await store.setState(orgId, { phase, offset_days })
      const today = seasonNow(realNow(), offset_days)
      // March brings the drought rule round; June too, so a skipped March still flags it.
      if (phase !== 'january') await service.evaluateTriggers(caller, orgId)
      return { today }
    },

    async groundCheck(caller, orgId) {
      const { data, today } = await demoOnly(caller, orgId)
      const heroId = data.state.hero_farmer_id
      const officer = data.state.ground_officer_id
      const hero = data.farmers.find(f => f.id === heroId)
      const contract = data.contracts.find(c => c.data.farmer_id === heroId)
      if (!hero || !contract || !officer)
        throw new SeasonError('not_found', 'No demo farmer is armed.')
      // The live beat: a capture-app photo already landed on his field since this arming. The
      // field officer verifies it, with the stage.
      const live = data.observations
        .filter(
          o =>
            o.data.farmer_id === hero.id &&
            !o.data.sim &&
            o.data.created_at >= data.state.armed_at &&
            o.data.geofence_ok === true
        )
        .sort((a, b) => b.data.created_at.localeCompare(a.data.created_at))[0]
      if (
        live &&
        live.data.verification_state !== 'FIELD_VERIFIED' &&
        live.data.verification_state !== 'EXPERT_CONFIRMED'
      ) {
        await store.patchObservation(live.id, {
          verification_state: 'FIELD_VERIFIED',
          verified_by: officer,
          growth_stage: live.data.growth_stage ?? 'V4',
        })
        return { obs_id: live.id, live: true }
      }
      // The seeded beat: the officer's ground check, on his field, now.
      const pin = hero.data.field_pin
      const id = `sim-ceih-ground-${now().getTime()}`
      const createdAt = realNow()
      await store.addObservation(id, {
        reporter_id: officer,
        reporter_role: 'field_officer',
        org_id: orgId,
        created_at: createdAt,
        location: pin,
        geohash: geohash(pin.latitude, pin.longitude),
        district: hero.data.district,
        district_slug: findDistrict(hero.data.district)?.slug ?? districtSlug(hero.data.district),
        province: hero.data.province,
        camp: hero.data.camp,
        crop: contract.data.crop,
        planting_date: contract.data.planting_date,
        growth_stage: 'V4',
        photo_paths: [simPhotoPath('library-unknown-03')],
        farmer_description: 'Ground check: even stand, rows closing, no pest seen.',
        status: 'complete',
        diagnosis: null,
        verification_state: 'FIELD_VERIFIED',
        verified_by: officer,
        verified_issue: null,
        recommendation_id: null,
        intervention: null,
        outcome: null,
        farmer_id: hero.id,
        geofence_ok: geofenceOk(pin, contract.data.field_polygon),
        source: 'officer',
        season_at: today,
        sim: true,
      })
      return { obs_id: id, live: false }
    },
  }

  async function demoOnly(caller: Caller, orgId: string) {
    if (!COMMAND_CENTER_ROLES.includes(caller.role))
      throw new SeasonError('forbidden', 'Demo controls are for Command Center accounts.')
    const loaded = await load(caller, orgId)
    if (!loaded.data.state.sim)
      throw new SeasonError('forbidden', 'Demo controls work on simulated seasons only.')
    return loaded
  }

  return service
}

// Linking a new report to a contracted farmer (spec W2.4): if it fell inside an active
// contract's field polygon (plus the margin) for the same crop, it lands on that farmer's record.
// Runs after the report is saved and never holds it up.
export function observationLinker(deps: {
  load: () => Promise<{
    contracts: {
      id: string
      farmer_id: string
      crop: string
      polygon: string
      offset_days: number
    }[]
  }>
  get: (obsId: string) => Promise<{
    location: { latitude: number; longitude: number }
    crop: string
    created_at: string
    reporter_role: string
    farmer_id?: string | null
  } | null>
  patch: (
    obsId: string,
    fields: {
      farmer_id: string
      geofence_ok: true
      source: 'officer' | 'farmer'
      season_at: string
    }
  ) => Promise<void>
}) {
  return async (obsId: string) => {
    const o = await deps.get(obsId)
    if (!o || o.farmer_id) return null
    const { contracts } = await deps.load()
    const match = contracts.find(c => c.crop === o.crop && geofenceOk(o.location, c.polygon))
    if (!match) return null
    await deps.patch(obsId, {
      farmer_id: match.farmer_id,
      geofence_ok: true,
      source: o.reporter_role === 'farmer' ? 'farmer' : 'officer',
      season_at: seasonNow(o.created_at, match.offset_days),
    })
    return match.farmer_id
  }
}
