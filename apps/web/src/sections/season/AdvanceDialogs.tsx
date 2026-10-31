import { LoaderCircle, MessageSquare, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { feeFor, zmw, type Approval, type FieldCard } from '@repo/shared'
import { DemoBadge } from '../../components/DemoBadge'
import { Dialog } from '../../components/Dialog'
import { firstName, seasonTime, useSeasonRefresh } from '../../lib/season'
import { trpc } from '../../lib/trpc'

// Money moves only after a person has read the amount and the fee (invariant 11). These dialogs
// are where that reading happens: the request (the fee shown before anything is sent), the
// farmer's code, and the approval by a second person.

function Busy({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <>
      {busy && <LoaderCircle size={18} aria-hidden className="animate-spin" />}
      {children}
    </>
  )
}

// The money as the farmer and the credit team read it: the advance, its fee with the rate said,
// what the advance adds at harvest, and everything owed then against the projected crop.
export function Figures({ amount, fee, card }: { amount: number; fee: number; card: FieldCard }) {
  return (
    <div>
      <dl className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-2 rounded-card bg-ground px-4 py-3 shadow-[inset_0_0_0_1px_var(--hairline)]">
        <dt className="text-label text-fg">Advance</dt>
        <dd className="serif text-right text-[1.6rem] font-semibold tabular-nums text-fg">
          <span className="mr-1 font-body text-[0.8rem] font-[650] text-fg-2">ZMW</span>
          {amount.toLocaleString('en-GB')}
        </dd>
        <dt className="text-label text-fg">
          Fee · {Math.round(card.credit.advance_fee_pct * 100)}% flat
        </dt>
        <dd className="text-right text-label font-semibold tabular-nums text-fg">
          <span className="mr-1 text-[0.8rem] font-[650] text-fg-2">ZMW</span>
          {fee.toLocaleString('en-GB')}
        </dd>
        <div role="presentation" className="col-span-2 h-px bg-hairline" />
        <dt className="whitespace-nowrap text-label text-fg">Deducted at harvest</dt>
        <dd className="serif text-right text-[1.25rem] font-semibold tabular-nums text-fg">
          <span className="mr-1 font-body text-[0.8rem] font-[650] text-fg-2">ZMW</span>
          {(amount + fee).toLocaleString('en-GB')}
        </dd>
      </dl>
      <p className="mt-2 text-caption leading-[1.4] text-fg-2">
        With the inputs on loan ({zmw(card.input_loan_zmw)}), {firstName(card.farmer_name)} owes{' '}
        <span className="font-semibold text-fg">{zmw(card.input_loan_zmw + amount + fee)}</span> at
        harvest, against a projected crop of {zmw(card.projected_value_zmw)}.
      </p>
    </div>
  )
}

export function RequestAdvanceDialog({
  orgId,
  card,
  commandCenter,
  onClose,
}: {
  orgId: string
  card: FieldCard
  commandCenter: boolean
  onClose: () => void
}) {
  const refresh = useSeasonRefresh()
  const name = firstName(card.farmer_name)
  const fee = feeFor(card.eligibility.cap_zmw, card.credit)
  const existing = card.advance?.state === 'requested' ? card.advance.advance_id : null
  const [advanceId, setAdvanceId] = useState<string | null>(existing)
  const [code, setCode] = useState('')
  const [done, setDone] = useState(false)
  const request = trpc.season.requestAdvance.useMutation({
    onSuccess: r => {
      setAdvanceId(r.advance_id)
      void refresh()
    },
  })
  const confirm = trpc.season.confirmAdvance.useMutation({
    onSuccess: () => {
      setDone(true)
      void refresh()
    },
  })
  const sms = trpc.season.smsLog.useQuery(
    { orgId },
    { enabled: Boolean(advanceId) && commandCenter && card.sim, refetchInterval: 3000 }
  )
  // Demo only: the farmer's code, read from the SMS log the room can see.
  const sent = sms.data?.find(s => s.purpose === 'otp' && s.farmer_name === card.farmer_name)
  const sentCode = sent ? /code: (\d{6})/.exec(sent.message)?.[1] : undefined

  if (done)
    return (
      <Dialog
        aside={<DemoBadge small rows={[card]} />}
        title="Confirmed by the farmer"
        kicker={card.farmer_name}
        onClose={onClose}
        footer={
          <>
            <a className="btn-primary" href="#/outgrower/approvals" onClick={onClose}>
              Open approvals
            </a>
            <button type="button" className="btn-quiet" onClick={onClose}>
              Close
            </button>
          </>
        }
      >
        <p className="text-body text-fg">
          {name} confirmed with the code. The advance waits for a second person on the credit team:
          the officer who verified the field cannot approve it.
        </p>
      </Dialog>
    )

  if (!advanceId)
    return (
      <Dialog
        aside={<DemoBadge small rows={[card]} />}
        title={`Advance for ${card.farmer_name}`}
        kicker={`Requested on the farmer's behalf · ${card.camp}`}
        onClose={onClose}
        footer={
          <>
            <button
              type="button"
              className="btn-primary"
              disabled={request.isPending}
              onClick={() => request.mutate({ orgId, contractId: card.contract_id })}
            >
              <Busy busy={request.isPending}>Send to {name}</Busy>
            </button>
            <button type="button" className="btn-quiet" onClick={onClose}>
              Cancel
            </button>
          </>
        }
      >
        <Figures amount={card.eligibility.cap_zmw} fee={fee} card={card} />
        <p className="mt-3 text-label text-fg-2">
          {name} gets an SMS with the amount, the fee and a code, and agrees by giving you the code;
          nothing moves before that, and nothing moves without a second person&apos;s approval.
        </p>
        {request.error && <p className="mt-2 text-label text-high-text">{request.error.message}</p>}
      </Dialog>
    )

  return (
    <Dialog
      aside={<DemoBadge small rows={[card]} />}
      title={`${name}'s code`}
      kicker={
        sent?.status === 'sent'
          ? 'Sent by SMS with the amount and the fee'
          : 'The SMS with the amount and the fee: logged on screen, the gateway is off'
      }
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn-primary"
            disabled={confirm.isPending || code.length !== 6}
            onClick={() => confirm.mutate({ orgId, advanceId, code })}
          >
            <Busy busy={confirm.isPending}>Confirm</Busy>
          </button>
          {sentCode && (
            <button type="button" className="btn-quiet" onClick={() => setCode(sentCode)}>
              <MessageSquare size={16} aria-hidden />
              Use the code from the SMS log (demo)
            </button>
          )}
        </>
      }
    >
      {sent && (
        <p className="rounded-[1rem_1rem_1rem_0.3rem] bg-panel px-4 py-3 text-label leading-[1.45] text-fg shadow-island-sm">
          {sent.message.replace(/code: \d{6}/, 'code: ••••••')}
        </p>
      )}
      <label className="mt-4 block text-label font-semibold text-fg" htmlFor="otp">
        The code {name} reads out
      </label>
      <input
        id="otp"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={event => setCode(event.target.value.replace(/\D/g, ''))}
        className="field mt-1 max-w-[12rem] font-mono text-[1.2rem] tracking-[0.3em]"
      />
      {confirm.error && <p className="mt-2 text-label text-high-text">{confirm.error.message}</p>}
    </Dialog>
  )
}

export function ApproveDialog({
  orgId,
  approval,
  onClose,
}: {
  orgId: string
  approval: Approval
  onClose: () => void
}) {
  const refresh = useSeasonRefresh()
  const name = approval.card.farmer_name
  const approve = trpc.season.approveAdvance.useMutation({ onSuccess: () => void refresh() })
  if (approve.data)
    return (
      <Dialog
        aside={<DemoBadge small rows={[approval]} />}
        title={`${zmw(approval.amount_zmw)} sent`}
        kicker={name}
        onClose={onClose}
        footer={
          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        }
      >
        <p className="text-body text-fg">
          {approve.data.simulated ? 'Simulated transfer' : 'Transfer'} to {approval.card.momo_label}
          , ref <span className="font-mono">{approve.data.tx_ref}</span>. The advance and the fee
          are on the ledger; the message to {firstName(name)} is in the SMS log.
        </p>
      </Dialog>
    )
  return (
    <Dialog
      aside={<DemoBadge small rows={[approval]} />}
      title={`Approve ${zmw(approval.amount_zmw)}`}
      kicker={`${name} · ${approval.card.camp}`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn-primary"
            disabled={approve.isPending}
            onClick={() => approve.mutate({ orgId, advanceId: approval.advance_id })}
          >
            <Busy busy={approve.isPending}>Approve and send</Busy>
          </button>
          <button type="button" className="btn-quiet" onClick={onClose}>
            Cancel
          </button>
        </>
      }
    >
      <Figures amount={approval.amount_zmw} fee={approval.fee_zmw} card={approval.card} />
      <ul className="mt-3 flex flex-col gap-1.5 text-label text-fg">
        <li>
          Farmer&apos;s code: {approval.otp_ok ? 'confirmed' : 'not yet confirmed'} · requested{' '}
          {seasonTime(approval.requested_at)}
        </li>
        <li>
          To {approval.card.momo_label}, {approval.card.phone_masked} · simulated provider in the
          demo
        </li>
        <li className="flex gap-2 text-fg-2">
          <ShieldCheck size={18} aria-hidden className="mt-0.5 shrink-0 text-signal-text" />
          The officer who verified the field cannot approve:{' '}
          {approval.verifier_labels.join(', ') || 'the satellite established this field'}.
        </li>
      </ul>
      {approve.error && <p className="mt-2 text-label text-high-text">{approve.error.message}</p>}
    </Dialog>
  )
}

export function DeclineDialog({
  orgId,
  approval,
  onClose,
}: {
  orgId: string
  approval: Approval
  onClose: () => void
}) {
  const refresh = useSeasonRefresh()
  const [reason, setReason] = useState('')
  const decline = trpc.season.declineAdvance.useMutation({
    onSuccess: () => {
      void refresh()
      onClose()
    },
  })
  return (
    <Dialog
      aside={<DemoBadge small rows={[approval]} />}
      title="Decline with a reason"
      kicker={`${approval.card.farmer_name} · ${zmw(approval.amount_zmw)}`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn-primary"
            disabled={decline.isPending || reason.trim().length < 3}
            onClick={() => decline.mutate({ orgId, advanceId: approval.advance_id, reason })}
          >
            <Busy busy={decline.isPending}>Decline</Busy>
          </button>
          <button type="button" className="btn-quiet" onClick={onClose}>
            Cancel
          </button>
        </>
      }
    >
      <label htmlFor="reason" className="block text-label font-semibold text-fg">
        The reason, sent to the farmer by SMS
      </label>
      <textarea
        id="reason"
        rows={3}
        maxLength={300}
        value={reason}
        onChange={event => setReason(event.target.value)}
        className="field mt-1 h-auto py-2"
      />
      {decline.error && <p className="mt-2 text-label text-high-text">{decline.error.message}</p>}
    </Dialog>
  )
}
