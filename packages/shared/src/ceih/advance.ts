import type { Advance, CreditConfig, Eligibility } from '../schemas/ceih'
import { zmw } from './format'

// The advance state machine (spec W4, invariant 11): requested → farmer_confirmed (the farmer's
// code, after seeing amount and fee) → approved (by someone who did not verify the field) →
// disbursed (with a ledger entry). Pure checks; the API runs them inside its transactions.

// min(cap_pct × projected value, hard ceiling), whole kwacha, never rounded up.
export function capFor(projectedValueZmw: number, credit: CreditConfig): number {
  return Math.min(Math.floor(projectedValueZmw * credit.cap_pct), credit.hard_ceiling_zmw)
}

export const feeFor = (amountZmw: number, credit: Pick<CreditConfig, 'advance_fee_pct'>) =>
  Math.round(amountZmw * credit.advance_fee_pct)

export type AdvanceRefusal =
  | 'not_eligible'
  | 'amount_over_cap'
  | 'wrong_state'
  | 'otp_expired'
  | 'otp_wrong'
  | 'not_confirmed'
  | 'approver_is_verifier'
  | 'not_approved'

export type Check = { ok: true } | { ok: false; code: AdvanceRefusal; message: string }

const ok: Check = { ok: true }
const refuse = (code: AdvanceRefusal, message: string): Check => ({ ok: false, code, message })

export function checkRequest(eligibility: Eligibility, amountZmw: number): Check {
  if (!eligibility.eligible)
    return refuse('not_eligible', 'Not eligible: see the factors for the rule that is not met.')
  if (amountZmw > eligibility.cap_zmw)
    return refuse(
      'amount_over_cap',
      `${zmw(amountZmw)} is over the cap of ${zmw(eligibility.cap_zmw)}.`
    )
  return ok
}

type AdvanceState = Pick<
  Advance,
  | 'state'
  | 'otp_sha256'
  | 'otp_expires_at'
  | 'farmer_confirmed'
  | 'approval'
  | 'eligibility_snapshot'
  | 'disbursement'
>

// The farmer's code, compared as hashes. `now` is real time: codes expire on the real clock.
export function checkConfirm(advance: AdvanceState, otpSha256: string, now: string): Check {
  if (advance.state !== 'requested' || !advance.otp_sha256)
    return refuse('wrong_state', 'This advance is not waiting for the farmer.')
  if (!advance.otp_expires_at || Date.parse(now) > Date.parse(advance.otp_expires_at))
    return refuse('otp_expired', 'The code has expired. Request the advance again.')
  if (otpSha256 !== advance.otp_sha256)
    return refuse('otp_wrong', 'That code does not match the one sent to the farmer.')
  return ok
}

// Maker-checker: the approver must not be an officer whose verification the advance rests on.
export function checkApprove(advance: AdvanceState, approverId: string): Check {
  if (advance.state !== 'farmer_confirmed' || advance.farmer_confirmed?.otp_ok !== true)
    return refuse('not_confirmed', 'The farmer has not confirmed this advance with their code.')
  if (advance.eligibility_snapshot.verifier_ids.includes(approverId))
    return refuse(
      'approver_is_verifier',
      'You verified this field, so you cannot approve its advance. A second person must.'
    )
  return ok
}

// At approval and again before the money moves, the rules run on the day, not on the request's
// snapshot: a camp the drought rule has paused since, an open severe issue or a lapsed check stops
// the money. "One advance a season" is this advance itself, so it is the one rule not re-asked.
export function checkStillEligible(eligibility: Eligibility, amountZmw: number): Check {
  const failed = eligibility.factors.find(f => !f.met && f.code !== 'one_advance')
  if (failed) return refuse('not_eligible', `Not eligible today: ${failed.text}`)
  if (amountZmw > eligibility.cap_zmw)
    return refuse('amount_over_cap', `Over today's cap of ${zmw(eligibility.cap_zmw)}`)
  return ok
}

// The last gate before money moves: everything above must already hold.
export function checkDisburse(advance: AdvanceState): Check {
  if (advance.farmer_confirmed?.otp_ok !== true)
    return refuse('not_confirmed', 'The farmer has not confirmed this advance with their code.')
  if (advance.state !== 'approved' || !advance.approval)
    return refuse('not_approved', 'This advance has not been approved.')
  if (advance.eligibility_snapshot.verifier_ids.includes(advance.approval.approver_id))
    return refuse('approver_is_verifier', 'The approver verified this field.')
  if (advance.disbursement) return refuse('wrong_state', 'This advance has already been sent.')
  return ok
}

// What the farmer reads before confirming: the amount and the fee (spec §6.4).
export function otpMessage(input: {
  org: string
  farmerName: string
  amountZmw: number
  feeZmw: number
  code: string
}) {
  const first = input.farmerName.split(' ')[0]
  return `Phytos DEMO: ${first}, ${input.org} offers you a cash advance of ${zmw(input.amountZmw)}. Fee ${zmw(input.feeZmw)}. Both are deducted at harvest. To agree, give your officer this code: ${input.code}. Do not share it with anyone else.`
}

export function disbursedMessage(input: {
  amountZmw: number
  feeZmw: number
  wallet: string
  txRef: string
  simulated: boolean
}) {
  return `Phytos DEMO: ${zmw(input.amountZmw)} sent to your ${input.wallet}${input.simulated ? ` (simulated transfer, ref ${input.txRef})` : `, ref ${input.txRef}`}. Deducted at harvest with ${zmw(input.feeZmw)} fee.`
}
