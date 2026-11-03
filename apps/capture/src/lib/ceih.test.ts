import { describe, expect, it } from 'vitest'
import { ceihLedger } from './ceih'

describe('illustrative CEIH ledger', () => {
  it('deducts the input loan, advance and 5% fee without charging the company fee to the farmer', () => {
    expect(ceihLedger(48000, 12000, 7200)).toEqual({
      gross: 48000,
      inputs: 12000,
      advance: 7200,
      fee: 360,
      payout: 28440,
      balanceDue: 0,
      companyFee: 960,
    })
  })
  it('reports a remaining balance instead of a negative payout when harvest value is insufficient', () => {
    expect(ceihLedger(10000, 12000, 7200)).toMatchObject({ payout: 0, balanceDue: 9560 })
  })
  it('rounds amounts and the fee in ngwee', () => {
    expect(ceihLedger(1000, 0, 123.45)).toMatchObject({ fee: 6.17, payout: 870.38 })
  })
})
