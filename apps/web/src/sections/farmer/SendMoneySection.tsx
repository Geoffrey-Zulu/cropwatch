import { Check, MessageSquareText, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { disbursedMessage, zmw } from '@repo/shared'
import { useCountUp } from '../../hooks/useCountUp'
import { seasonDate } from '../../lib/dates'

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const SEND_MS = 2600

export interface Sent {
  amount: number
  fee: number
  ref: string
}

// The money, after a check where every rule held and the farmer pressed "Get advance" (farmer
// app, 1 Nov): the amount and the fee are on screen from the start, before the send completes;
// then the receipt and the SMS. Within the
// cap the season's rules send it, with no approval queue (CLAUDE.md invariant 11). The provider
// is the SimulatedProvider, said once on the money line.
export function SendMoneySection({
  amount,
  fee,
  feePct,
  owedAfter,
  wallet,
  phone,
  today,
  onSent,
  onDone,
}: {
  amount: number
  fee: number
  feePct: number
  // What he owes at harvest once this is sent.
  owedAfter: number
  wallet: string
  phone: string
  today: string
  onSent: (sent: Sent) => void
  onDone: () => void
}) {
  const [ref] = useState(
    () => `SIM-${Math.random().toString(36).slice(2, 6).toUpperCase()}${today.slice(8, 10)}`
  )
  const [sent, setSent] = useState(false)
  useEffect(() => {
    const t = setTimeout(
      () => {
        setSent(true)
        onSent({ amount, fee, ref })
      },
      reduced() ? 400 : SEND_MS
    )
    return () => clearTimeout(t)
    // Once: the money moves a single time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const shown = useCountUp(amount, 900, 0)
  const sms = disbursedMessage({
    amountZmw: amount,
    feeZmw: fee,
    wallet,
    txRef: ref,
    simulated: false,
  })

  return (
    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section aria-label="The money" className="lc-row min-w-0">
        <p className="meta">Your advance</p>
        <p className="serif text-[2.6rem] font-semibold leading-none tabular-nums text-fg">
          <span className="mr-1.5 font-body text-[1rem] font-[650] text-fg-2">ZMW</span>
          {shown.toLocaleString('en-GB')}
        </p>
        <p className="mt-1.5 flex items-center gap-1.5 text-label text-fg-2">
          <Smartphone size={16} aria-hidden className="shrink-0" />
          To your {wallet} · {phone}
        </p>
        <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-y-1.5 rounded-card bg-ground px-4 py-3 text-label shadow-[inset_0_0_0_1px_var(--hairline)]">
          <dt className="text-fg-2">Advance</dt>
          <dd className="whitespace-nowrap pl-4 text-right font-semibold tabular-nums text-fg">
            {zmw(amount)}
          </dd>
          <dt className="text-fg-2">Fee, flat {Math.round(feePct * 100)}%</dt>
          <dd className="whitespace-nowrap pl-4 text-right font-semibold tabular-nums text-fg">
            {zmw(fee)}
          </dd>
          <dt className="col-span-2 text-caption text-fg-2">Both are deducted at harvest.</dt>
          <dt className="border-t border-hairline pt-1.5 text-fg">Owed at harvest after this</dt>
          <dd className="whitespace-nowrap border-t border-hairline pl-4 pt-1.5 text-right font-semibold tabular-nums text-fg">
            {zmw(owedAfter)}
          </dd>
        </dl>
        <div className="mt-4" aria-live="polite">
          {sent ? (
            <p className="lc-row flex items-start gap-2 text-[1.05rem] font-semibold leading-snug text-fg">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-pill bg-signal text-signal-ink">
                <Check size={15} strokeWidth={3} aria-hidden />
              </span>
              <span>
                {zmw(amount)} sent to your registered mobile money account
                <span className="font-normal text-fg-2"> · simulated · ref {ref}</span>
              </span>
            </p>
          ) : (
            <div>
              <p className="text-label font-semibold text-fg">
                Within your cap: sending to your {wallet}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-pill bg-well">
                <div className="fm-send h-full rounded-pill bg-signal" />
              </div>
            </div>
          )}
        </div>
      </section>

      <section aria-label="Your SMS" className="min-w-0">
        {sent ? (
          <div className="lc-row">
            <p className="meta flex items-center gap-1.5">
              <MessageSquareText size={15} aria-hidden />
              SMS to {phone}
            </p>
            <div className="mt-2 max-w-[26rem] rounded-[1.1rem] rounded-tl-[0.35rem] bg-well px-4 py-3 shadow-[inset_0_0_0_1px_var(--hairline)]">
              <p className="text-caption font-semibold text-fg-2">Phytos · {seasonDate(today)}</p>
              <p className="mt-1 text-label leading-[1.45] text-fg">{sms}</p>
            </div>
            <button type="button" className="btn-primary mt-5" onClick={onDone}>
              Done
            </button>
          </div>
        ) : (
          <p className="hidden h-[9rem] place-items-center rounded-card bg-well text-caption text-fg-2 lg:grid">
            Your SMS arrives here
          </p>
        )}
      </section>
    </div>
  )
}
