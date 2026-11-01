export const CEIH_EXAMPLE = {
  projectedKg: 4800,
  pricePerKg: 10,
  inputLoan: 12000,
  areaHa: 2.4,
}

export function ceihLedger(gross: number, inputLoan: number, advance: number) {
  // Work in ngwee so the fee and net payout agree to the displayed cent.
  const grossNgwee = Math.round(Math.max(0, gross) * 100)
  const inputsNgwee = Math.round(Math.max(0, inputLoan) * 100)
  const advanceNgwee = Math.round(Math.max(0, advance) * 100)
  const feeNgwee = Math.round(advanceNgwee * 0.05)
  const remaining = grossNgwee - inputsNgwee - advanceNgwee - feeNgwee
  return {
    gross: grossNgwee / 100,
    inputs: inputsNgwee / 100,
    advance: advanceNgwee / 100,
    fee: feeNgwee / 100,
    payout: Math.max(0, remaining) / 100,
    balanceDue: Math.max(0, -remaining) / 100,
    companyFee: Math.round(grossNgwee * 0.02) / 100,
  }
}

export const kwacha = (amount: number) =>
  `K ${amount.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
