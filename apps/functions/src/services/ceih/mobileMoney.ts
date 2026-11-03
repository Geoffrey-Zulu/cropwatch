import { createHash } from 'node:crypto'

// The mobile-money adapter (spec §3.5): disburse(msisdn, amount, ref) → { status, tx_ref }. The
// demo runs on SimulatedProvider and says so everywhere the transfer shows; Airtel Money and MTN
// MoMo need commercial onboarding, so their adapters refuse until then.
export interface MobileMoney {
  name: string
  simulated: boolean
  disburse(
    msisdn: string,
    amountZmw: number,
    ref: string
  ): Promise<{ status: 'simulated' | 'sent' | 'pending' | 'failed'; tx_ref: string | null }>
}

export const simulatedProvider: MobileMoney = {
  name: 'simulated',
  simulated: true,
  async disburse(_msisdn, _amount, ref) {
    const tx = createHash('sha256').update(ref).digest('hex').slice(0, 6).toUpperCase()
    return { status: 'simulated', tx_ref: `SIM-${tx}` }
  },
}

export const notOnboarded = (name: 'airtel-money' | 'mtn-momo'): MobileMoney => ({
  name,
  simulated: false,
  async disburse() {
    throw new Error(`${name} needs commercial onboarding; the demo runs on the simulated provider`)
  },
})
