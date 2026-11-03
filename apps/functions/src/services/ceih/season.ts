import { createHash, randomInt } from 'node:crypto'
import {
  liveRainUrl,
  sumLiveRain,
  type LiveRain,
  ADVANCE_APPROVER_ROLES,
  checkApprove,
  checkStillEligible,
  checkConfirm,
  checkDisburse,
  checkRequest,
  COMMAND_CENTER_ROLES,
  disbursedMessage,
  evaluateShock,
  medianDate,
  SEASON_PHASE_DATES,
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
  zmw,
  geohash,
  balance,
  districtSlug,
  findDistrict,
  type Advance,
  type Approval,
  type DeliveryInput,
  type EnrolFieldInput,
  type FieldsMap,
  buildFieldsMap,
  CEIH_SEASON,
  deriveStatuses,
  medianDate as medianOf,
  polygonAreaHa,
  polygonRing,
  ringCentroid,
  ringPolygon,
  type Eligibility,
  type FieldCard,
  type LedgerEntry,
  type Portfolio,
  type Reconciliation,
  type SeasonPhase,
  type SmsLog,
  type SmsLogView,
  type Statement,
  buildApprovals,
  buildFieldCard,
  buildPortfolio,
  buildReconciliation,
  buildRoster,
  buildSmsLog,
  buildStatement,
  eligibilityFor,
  seasonToday,
  type SeasonData,
} from '@repo/shared'
import type { SmsSender } from '../alerts/sms'
import type { Caller } from '../observationModel'
import type { MobileMoney } from './mobileMoney'
import type { SeasonStore } from './store'

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
  // The Fields map: outlines for this org's own credit team and field officers, camp totals for
  // anyone else (invariant 6, amended).
  fields(caller: Caller, orgId: string): Promise<FieldsMap>
  // Real rainfall, last 30 days, for a farm added live; null when the archive has none or fails.
  liveRain(caller: Caller, orgId: string, contractId: string): Promise<LiveRain | null>
  enrolField(
    caller: Caller,
    orgId: string,
    input: EnrolFieldInput
  ): Promise<{ farmer_id: string; contract_id: string; contracted_ha: number }>
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
  // Harvest (Reconciliation's batch): pays every ready farmer what the ledger says is owed.
  requestPayouts(
    caller: Caller,
    orgId: string
  ): Promise<{ farmers: number; total_zmw: number; simulated: boolean }>
  // asOf: a season day other than today (the demo's jump to June runs March's rule first).
  evaluateTriggers(
    caller: Caller,
    orgId: string,
    asOf?: string
  ): Promise<{ camp: string; fired: boolean }[]>
  // Demo controls (Command Center, simulated orgs only).
  setPhase(caller: Caller, orgId: string, phase: SeasonPhase): Promise<{ today: string }>
  groundCheck(caller: Caller, orgId: string): Promise<{ obs_id: string; live: boolean }>
  // Demo control (simulated seasons only): the payout rows removed, so the batch can run again.
  resetSettlement(caller: Caller, orgId: string): Promise<{ removed: number }>
}

export interface SeasonDeps {
  store: SeasonStore
  sms: SmsSender
  money: MobileMoney
  now?: () => Date
  // The Open-Meteo archive (liveRain); a stub in tests.
  fetchImpl?: typeof fetch
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
// Field outlines are precise locations: the org's own credit team and field officers see them.
// In a simulated season a Command Center account stands in for the credit team (the demo signs
// in as one), as it does for approvals; the farms are fictional. Real orgs: their own roles only.
export function canSeeFields(caller: Caller, orgId: string, simulated: boolean) {
  if ((caller.role === 'credit' || caller.role === 'field_officer') && caller.orgId === orgId)
    return true
  return simulated && COMMAND_CENTER_ROLES.includes(caller.role)
}

// A Command Center account stands in for the credit team on a simulated season only. On a real
// org, only that agribusiness's own credit team moves its money or records its deliveries.
function assertOwnCreditTeam(caller: Caller, simulated: boolean) {
  if (caller.role !== 'credit' && !simulated)
    throw new SeasonError('forbidden', "Only this agribusiness's credit team can do this.")
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
  fetchImpl = fetch,
}: SeasonDeps): SeasonService {
  const realNow = () => now().toISOString()
  // Live rainfall, cached per contract and day: one archive call a farm a day at most. A failed
  // call is not cached.
  const rainCache = new Map<string, LiveRain | null>()
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
      return buildPortfolio(data, today)
    },

    async fieldCard(caller, orgId, contractId) {
      const { data, today } = await load(caller, orgId)
      const card = buildFieldCard(
        data,
        contractId,
        today,
        canSeeFields(caller, orgId, data.org.sim)
      )
      if (!card) throw new SeasonError('not_found', 'No such contract.')
      return card
    },

    async fields(caller, orgId) {
      const { data, today } = await load(caller, orgId)
      return buildFieldsMap(data, today, canSeeFields(caller, orgId, data.org.sim))
    },

    async liveRain(caller, orgId, contractId) {
      const { data } = await load(caller, orgId)
      if (!canSeeFields(caller, orgId, data.org.sim))
        throw new SeasonError('forbidden', 'Only this agribusiness sees its farms.')
      const contract = data.contracts.find(c => c.id === contractId)
      if (!contract?.data.added_live) return null
      const ring = polygonRing(contract.data.field_polygon)
      if (!ring) return null
      const at = now()
      const key = `${contractId}:${at.toISOString().slice(0, 10)}`
      if (rainCache.has(key)) return rainCache.get(key)!
      const { latitude, longitude } = ringCentroid(ring)
      try {
        const response = await fetchImpl(liveRainUrl(latitude, longitude, at), {
          signal: AbortSignal.timeout(8_000),
        })
        if (!response.ok) return null
        const rain = sumLiveRain(await response.json())
        rainCache.set(key, rain)
        return rain
      } catch {
        return null
      }
    },

    async enrolField(caller, orgId, input) {
      const { data, today } = await load(caller, orgId)
      if (!canSeeFields(caller, orgId, data.org.sim))
        throw new SeasonError('forbidden', 'Only this agribusiness can enrol its farms.')
      const members = data.contracts.filter(c => c.data.camp === input.camp)
      if (members.length === 0) throw new SeasonError('not_found', 'No such camp.')
      // The traced boundary is the field: its area is the contract's, computed here, not sent.
      const ha = Math.round(polygonAreaHa(input.ring) * 100) / 100
      if (ha < 0.05 || ha > 100)
        throw new SeasonError('refused', `The traced field is ${ha} ha: trace the boundary again.`)
      const pin = ringCentroid(input.ring)
      const polygon = ringPolygon(input.ring)
      const first = data.farmers.find(f => f.id === members[0].data.farmer_id)!
      const farmerId = store.newId('farmers')
      const contractId = store.newId('contracts')
      const realNowIso = realNow()
      const planting = medianOf(members.map(c => c.data.planting_date))
      // The seeded curve starts: the field follows its camp's median, pass by pass (a live
      // Sentinel-2 pull replaces it through /satellite/ingest).
      const template = data.metrics.find(m => m.data.camp === input.camp)?.data.passes ?? []
      const jitter = (date: string) => {
        let h = 0
        for (const ch of contractId + date) h = (h * 31 + ch.charCodeAt(0)) >>> 0
        return ((h % 1000) / 1000 - 0.5) * 0.04
      }
      const passes = deriveStatuses(
        template.map(p => ({
          ...p,
          ndvi:
            p.ndvi_camp_median === null
              ? null
              : Math.round((p.ndvi_camp_median + jitter(p.date)) * 100) / 100,
          usable: p.ndvi_camp_median !== null,
          cloud_pct: p.ndvi_camp_median === null ? 90 : 4,
          computed_at: realNowIso,
          sim: data.org.sim,
        })),
        planting,
        'soybean'
      )
      await store.addEnrolment(
        {
          id: farmerId,
          data: {
            name: input.name,
            phone_msisdn: input.phone_msisdn,
            momo_provider: input.momo_provider,
            momo_verified: false,
            org_id: orgId,
            camp: input.camp,
            district: first.data.district,
            province: first.data.province,
            consent: { given_at: today, scope: 'org_contract', officer_id: caller.uid },
            field_pin: pin,
            field_polygon: polygon,
            claimed_ha: ha,
            history: { seasons: 0, defaults: 0, last_recovery_pct: null },
            sim: data.org.sim,
          },
        },
        {
          id: contractId,
          data: {
            farmer_id: farmerId,
            org_id: orgId,
            season: members[0].data.season || CEIH_SEASON,
            crop: 'soybean',
            camp: input.camp,
            district: members[0].data.district,
            planting_date: planting,
            contracted_ha: ha,
            projected_yield_t_ha: input.projected_yield_t_ha,
            contract_price_zmw_t: input.contract_price_zmw_t,
            projected_value_zmw: Math.round(
              ha * input.projected_yield_t_ha * input.contract_price_zmw_t
            ),
            // Inputs go on the ledger when they are handed over and acknowledged (W1), not here.
            input_loan_zmw: Math.round((ha * 3900) / 10) * 10,
            inputs_delivered: null,
            field_polygon: polygon,
            status: 'active',
            shock_flag: null,
            side_sell_suspected: false,
            added_live: true,
            sim: data.org.sim,
          },
        },
        {
          contract_id: contractId,
          org_id: orgId,
          camp: input.camp,
          source: 'seeded',
          passes,
          sim: data.org.sim,
        }
      )
      return { farmer_id: farmerId, contract_id: contractId, contracted_ha: ha }
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
      return buildApprovals(data, today, caller.uid, canSeeFields(caller, orgId, data.org.sim))
    },

    async statement(caller, orgId, contractId) {
      const { data, today } = await load(caller, orgId)
      const s = buildStatement(data, contractId, today)
      if (!s) throw new SeasonError('not_found', 'No such contract.')
      return s
    },

    async reconciliation(caller, orgId) {
      const { data, today } = await load(caller, orgId)
      return buildReconciliation(data, today)
    },

    async smsLog(caller, orgId) {
      const { data } = await load(caller, orgId)
      return buildSmsLog(data)
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
      assertOwnCreditTeam(caller, data.org.sim)
      const advance = advanceIn(data, advanceId)
      const check = checkApprove(advance.data, caller.uid)
      if (!check.ok) throw new SeasonError('refused', check.message)
      const still = checkStillEligible(
        eligibilityFor(data, advance.data.contract_id, today),
        advance.data.amount_zmw
      )
      if (!still.ok) throw new SeasonError('refused', still.message)
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
      assertOwnCreditTeam(caller, data.org.sim)
      const advance = advanceIn(data, advanceId)
      const check = checkDisburse(advance.data)
      if (!check.ok) throw new SeasonError('refused', check.message)
      const still = checkStillEligible(
        eligibilityFor(data, advance.data.contract_id, today),
        advance.data.amount_zmw
      )
      if (!still.ok) throw new SeasonError('refused', still.message)
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
      assertOwnCreditTeam(caller, data.org.sim)
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
        `Phytos: ${farmer.data.name.split(' ')[0]}, your advance request was not approved: ${reason.trim()}. Your officer will explain.`,
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
      assertOwnCreditTeam(caller, data.org.sim)
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
        note: `${(input.weight_kg / 1000).toFixed(2)} t grade ${input.grade} at ${zmw(price_zmw_t)} a tonne`,
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
      return buildStatement(fresh!, contract.id, today)!
    },

    async requestPayouts(caller, orgId) {
      if (!canApprove(caller, orgId))
        throw new SeasonError('forbidden', 'Only the credit team can request payouts.')
      const { data, today } = await load(caller, orgId)
      assertOwnCreditTeam(caller, data.org.sim)
      const roster = buildRoster(data, today)
      if (!roster.some(r => r.ready))
        throw new SeasonError('refused', 'Nothing is delivered yet: payouts open in June.')
      // What the ledger says each ready farmer is owed, through the mobile-money provider, one
      // ledger row each (invariant 11: rules met, a ledger row, the simulated provider).
      const rows: { id: string; entry: LedgerEntry }[] = []
      for (const r of roster.filter(x => x.ready && x.net_zmw > 0 && !x.payout)) {
        const { contract, farmer } = contractOf(data, r.contract_id)
        const id = `payout__${contract.id}`
        const result = await money.disburse(farmer.data.phone_msisdn, r.net_zmw, id)
        if (result.status === 'failed') continue
        rows.push({
          id,
          entry: {
            contract_id: contract.id,
            farmer_id: farmer.id,
            org_id: orgId,
            at: today,
            type: 'payout',
            amount_zmw: r.net_zmw,
            ref: result.tx_ref ?? id,
            note: `Payout to ${MOMO_LABELS[farmer.data.momo_provider]}${money.simulated ? ' (simulated transfer)' : ''}`,
            simulated: money.simulated,
            sim: contract.data.sim,
          },
        })
      }
      const written = await store.addPayouts(rows)
      const sum = (list: { entry: LedgerEntry }[]) =>
        list.reduce((n, x) => n + x.entry.amount_zmw, 0)
      if (written === rows.length)
        return { farmers: written, total_zmw: sum(rows), simulated: money.simulated }
      // Someone pressed first for some of them: count what this request wrote.
      const fresh = buildRoster((await store.load(orgId))!, today)
      const mine = rows.filter(x =>
        fresh.some(f => f.contract_id === x.entry.contract_id && f.payout?.ref === x.entry.ref)
      )
      return { farmers: written, total_zmw: sum(mine), simulated: money.simulated }
    },

    async evaluateTriggers(caller, orgId, asOf) {
      if (!COMMAND_CENTER_ROLES.includes(caller.role) && !canApprove(caller, orgId))
        throw new SeasonError('forbidden', 'Not allowed to evaluate the shock rule.')
      const loaded = await load(caller, orgId)
      const { data } = loaded
      const today = asOf ?? loaded.today
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
          plantingDate: medianDate(members.map(c => c.data.planting_date)),
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
      const { data } = await demoOnly(caller, orgId)
      const offset_days = offsetForPhase(phase, realNow())
      // March brings the drought rule round. Jumping straight to June runs it as of March's day
      // first; in June itself it stays quiet (the rule watches the growing season only).
      if (phase === 'june' && !data.triggers.some(t => t.data.fired))
        await service.evaluateTriggers(caller, orgId, `${SEASON_PHASE_DATES.march}T09:00:00.000Z`)
      await store.setState(orgId, { phase, offset_days })
      const today = seasonNow(realNow(), offset_days)
      if (phase === 'march') await service.evaluateTriggers(caller, orgId)
      return { today }
    },

    async resetSettlement(caller, orgId) {
      const { data } = await demoOnly(caller, orgId)
      const ids = data.ledger
        .filter(l => l.data.type === 'payout' && l.data.org_id === orgId && l.data.sim)
        .map(l => l.id)
      return { removed: await store.removePayouts(ids) }
    },

    async groundCheck(caller, orgId) {
      const { data, today } = await demoOnly(caller, orgId)
      const heroId = data.state.hero_farmer_id
      const officer = data.state.ground_officer_id
      const hero = data.farmers.find(f => f.id === heroId)
      const contract = data.contracts.find(c => c.data.farmer_id === heroId)
      if (!hero || !contract || !officer)
        throw new SeasonError('not_found', 'No storyline farmer is armed. Re-arm the season.')
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
          growth_stage: live.data.growth_stage ?? 'R1',
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
        growth_stage: 'R1',
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
      throw new SeasonError('forbidden', 'Season controls are for Command Center accounts.')
    const loaded = await load(caller, orgId)
    if (!loaded.data.state.sim)
      throw new SeasonError('forbidden', 'Season controls are not available for this season.')
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
