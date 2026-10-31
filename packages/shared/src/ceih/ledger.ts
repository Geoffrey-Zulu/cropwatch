import {
  GRADE_PRICE_FACTOR,
  LEDGER_LABELS,
  SHOCK_YIELD_SHARE,
  VARIANCE_SHARE,
  type Grade,
} from '../constants/ceih'
import type { Contract, LedgerEntry, VarianceKind } from '../schemas/ceih'
import { shortDate, zmw } from './format'

// The ledger is the only record of money (spec §6.3): every movement is a row, and every total
// is computed from the rows, never stored. Signed from the farmer's account: positive is owed by
// the farmer, negative is credited to them.

type Line = Pick<LedgerEntry, 'type' | 'amount_zmw'>

export const balance = (entries: Line[]) => entries.reduce((sum, e) => sum + e.amount_zmw, 0)

const sumOf = (entries: Line[], type: LedgerEntry['type']) =>
  entries.filter(e => e.type === type).reduce((sum, e) => sum + e.amount_zmw, 0)

// What the farmer owes, excluding crop delivered and payouts: the agribusiness's exposure.
export const lent = (entries: Line[]) =>
  sumOf(entries, 'input_loan') + sumOf(entries, 'advance') + sumOf(entries, 'advance_fee')

// Recovered: crop delivered, up to what was lent.
export const recovered = (entries: Line[]) =>
  Math.min(-sumOf(entries, 'delivery') - sumOf(entries, 'insurance_payout'), lent(entries))

// A delivery priced at the contract price for its grade.
export function priceDelivery(contractPriceZmwT: number, grade: Grade, weightKg: number) {
  const price_zmw_t = Math.round(contractPriceZmwT * GRADE_PRICE_FACTOR[grade])
  return { price_zmw_t, value_zmw: Math.round((weightKg / 1000) * price_zmw_t) }
}

export const projectedTonnes = (c: Pick<Contract, 'contracted_ha' | 'projected_yield_t_ha'>) =>
  Math.round(c.contracted_ha * c.projected_yield_t_ha * 100) / 100

// Delivered against projected (spec W6.4): a drought-flagged contract's projection is cut first;
// a shortfall the shock does not explain, on a farm with no verified problem, is unexplained.
export function variance(input: {
  contract: Pick<Contract, 'contracted_ha' | 'projected_yield_t_ha' | 'shock_flag'>
  deliveredT: number | null
  verifiedIssue: string | null
}): { kind: VarianceKind; text: string } {
  const projected = projectedTonnes(input.contract)
  const delivered = input.deliveredT
  if (delivered === null)
    return { kind: 'none', text: `Nothing delivered yet, ${projected} t projected` }
  if (delivered >= projected * VARIANCE_SHARE)
    return {
      kind: 'none',
      text: `Delivered ${delivered} t against ${projected} t projected: no variance`,
    }
  const shock = input.contract.shock_flag
  if (shock && delivered >= projected * SHOCK_YIELD_SHARE * VARIANCE_SHARE)
    return {
      kind: 'shock',
      text: `Shock: drought trigger ${shortDate(shock.triggered_at)} on ${shock.camp}. Delivered ${delivered} t against ${projected} t: uncontrollable`,
    }
  if (input.verifiedIssue)
    return {
      kind: 'verified_issue',
      text: `Delivered ${delivered} t against ${projected} t, explained by a verified ${input.verifiedIssue}`,
    }
  return {
    kind: 'unexplained',
    text: `Unexplained: delivered ${delivered} t against ${projected} t with no shock and no verified problem. Possible side-sale`,
  }
}

export function statementMessage(input: {
  farmerName: string
  lines: Pick<LedgerEntry, 'type' | 'amount_zmw'>[]
  // What is due to the farmer. Paying it moves money, so it waits for approval (invariant 11).
  netZmw: number
}) {
  const parts = input.lines
    .filter(l => l.type !== 'payout')
    .map(
      l =>
        `${LEDGER_LABELS[l.type]} ${l.amount_zmw < 0 ? '' : 'less '}${zmw(Math.abs(l.amount_zmw))}`
    )
  const net =
    input.netZmw > 0
      ? `Net due to you ${zmw(input.netZmw)}, paid to your mobile money after approval`
      : `Still owed ${zmw(-input.netZmw)}, carried to next season`
  return `Phytos DEMO statement for ${input.farmerName.split(' ')[0]}: ${parts.join('; ')}. ${net}.`
}
