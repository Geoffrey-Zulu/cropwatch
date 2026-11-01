import {
  CircleAlert,
  CircleCheck,
  Clock,
  MessageSquare,
  Satellite,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'
import { establishmentNdvi, zmw, type Approval, type SmsLogView } from '@repo/shared'
import { DemoBadge } from '../../components/DemoBadge'
import { NdviChart } from '../../components/NdviChart'
import { SkeletonRows } from '../../components/Skeleton'
import { firstName, seasonDate, seasonTime } from '../../lib/season'
import { PhotoSection } from '../PhotoSection'
import { ApproveDialog, DeclineDialog, Figures } from './AdvanceDialogs'
import { FactorList } from './FieldCardSection'
import { SmsLogSection } from './SmsLogSection'

// Tab 2 (plan §3): the queue of advances, each card the farmer's season record, then the
// money. Approve is the credit team's, and never the officer who verified the field's
// (maker-checker); the transfer runs on the simulated provider and says so.
export function ApprovalsSection({
  orgId,
  approvals,
  sms,
}: {
  orgId: string
  approvals: Approval[] | undefined
  sms: SmsLogView[] | undefined
}) {
  const [approving, setApproving] = useState<Approval | null>(null)
  const [declining, setDeclining] = useState<Approval | null>(null)
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section
        aria-labelledby="approvals"
        className="island min-w-0 px-[1.45rem] py-[1.3rem] md:px-[1.65rem] md:py-[1.55rem]"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="approvals" className="serif text-title font-semibold text-fg">
              Approvals
            </h2>
            <p className="text-label text-fg-2">
              {approvals ? `${approvals.length} waiting` : 'Loading'} · every advance needs the
              farmer&apos;s code, and an approver who did not verify the field
            </p>
          </div>
          {approvals && <DemoBadge rows={approvals} />}
        </div>
        {!approvals ? (
          <SkeletonRows rows={3} lines={4} label="Loading the approvals" />
        ) : approvals.length === 0 ? (
          <p className="mt-4 text-label text-fg-2">
            Nothing waiting. Requests appear here once the farmer confirms with the code.
          </p>
        ) : (
          <ol className="mt-4 flex flex-col gap-5">
            {approvals.map(a => (
              <li key={a.advance_id}>
                <ApprovalCard
                  approval={a}
                  otpSms={sms?.find(
                    s => s.purpose === 'otp' && s.farmer_name === a.card.farmer_name
                  )}
                  onApprove={() => setApproving(a)}
                  onDecline={() => setDeclining(a)}
                />
              </li>
            ))}
          </ol>
        )}
      </section>
      <SmsLogSection sms={sms} />
      {approving && (
        <ApproveDialog orgId={orgId} approval={approving} onClose={() => setApproving(null)} />
      )}
      {declining && (
        <DeclineDialog orgId={orgId} approval={declining} onClose={() => setDeclining(null)} />
      )}
    </div>
  )
}

function ApprovalCard({
  approval: a,
  otpSms,
  onApprove,
  onDecline,
}: {
  approval: Approval
  // The message that carried the amount, the fee and the code: what the farmer was really sent.
  otpSms: SmsLogView | undefined
  onApprove: () => void
  onDecline: () => void
}) {
  const card = a.card
  const check =
    card.ground_checks.find(
      g => g.verification === 'FIELD_VERIFIED' || g.verification === 'EXPERT_CONFIRMED'
    ) ?? card.ground_checks[0]
  const name = firstName(card.farmer_name)
  return (
    <article className="grid gap-x-6 gap-y-5 rounded-card bg-panel p-[1.1rem] shadow-[inset_0_0_0_1px_var(--hairline)] lg:grid-cols-[13rem_minmax(0,1fr)_minmax(15rem,18rem)]">
      <div className="min-w-0">
        {check ? (
          <PhotoSection path={check.photo_paths[0] ?? null} sim={check.sim} />
        ) : (
          <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-card bg-ground px-4 text-center text-label text-fg-2 shadow-[inset_0_0_0_1px_var(--hairline)]">
            <Satellite aria-hidden />
            Established from space: clear passes, no ground photo needed
          </div>
        )}
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-label">
          <dt className="text-fg-2">Farmer</dt>
          <dd className="font-semibold text-fg">{card.farmer_name}</dd>
          <dt className="text-fg-2">Camp</dt>
          <dd className="font-semibold text-fg">
            {card.camp}, {card.district}
          </dd>
          {!check && (
            <>
              {/* Said, not left to inference: this advance rests on greenness alone. */}
              <dt className="text-fg-2">Field visit</dt>
              <dd className="font-semibold text-fg">None this season</dd>
            </>
          )}
          {check && (
            <>
              <dt className="text-fg-2">Stage</dt>
              <dd className="font-semibold text-fg">{check.stage ?? 'Not recorded'}</dd>
              <dt className="text-fg-2">Photo taken</dt>
              <dd
                className={`font-semibold ${check.geofence_ok ? 'text-signal-text' : 'text-high-text'}`}
              >
                {check.geofence_ok ? 'Within 150 m of the field' : 'Outside the field'}
              </dd>
              <dt className="text-fg-2">Checked</dt>
              <dd className="font-semibold text-fg">
                {seasonDate(check.at).replace(/ \d{4}$/, '')} · {seasonTime(check.at)}
              </dd>
              <dt className="text-fg-2">Verified by</dt>
              <dd className="font-semibold text-fg">{check.verified_by_label ?? 'Not yet'}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-section font-semibold text-fg">Greenness from space</h3>
        </div>
        <div className="mt-2">
          <NdviChart
            compact
            height={150}
            curve={card.curve}
            plantingDate={card.planting_date}
            today={card.today}
            threshold={establishmentNdvi(card.crop)}
            label={`${card.farmer_name}'s NDVI against the ${card.camp} camp median`}
          />
        </div>
        <p className="mt-3 text-caption font-semibold text-fg-2">
          The factors when it was requested, {seasonDate(a.requested_at).replace(/ \d{4}$/, '')}{' '}
          {seasonTime(a.requested_at)}
        </p>
        <FactorList factors={a.eligibility_snapshot.factors} />
      </div>

      <div className="min-w-0">
        <Figures amount={a.amount_zmw} fee={a.fee_zmw} card={card} />
        <p className="mt-3 flex items-start gap-1.5 text-caption font-semibold leading-[1.4] text-fg-2">
          <MessageSquare size={14} aria-hidden className="mt-0.5 shrink-0" />
          {otpSms?.status === 'sent'
            ? `${name} got the amount and the fee by SMS before confirming`
            : `The SMS with the amount, the fee and the code: logged on screen, not sent (the gateway is off in the demo)`}
        </p>
        {a.otp_ok ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-label font-semibold text-signal-text">
            <CircleCheck size={16} aria-hidden />
            Confirmed with the code
          </p>
        ) : (
          <p className="mt-1.5 flex items-center gap-1.5 text-label font-semibold text-fg-2">
            <Clock size={16} aria-hidden />
            Waiting for {name}&apos;s code
          </p>
        )}
        {a.blocked_today && (
          <p className="mt-2 flex items-start gap-1.5 text-label font-semibold leading-[1.4] text-high-text">
            <CircleAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
            {a.blocked_today}. The rules are re-run on the day of approval.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={!a.otp_ok || a.caller_is_verifier || Boolean(a.blocked_today)}
            onClick={onApprove}
          >
            Approve {zmw(a.amount_zmw)}
          </button>
          <button type="button" className="btn-quiet" onClick={onDecline}>
            Decline
          </button>
        </div>
        <p className="mt-3 flex gap-2 text-caption leading-[1.4] text-fg-2">
          <ShieldCheck size={16} aria-hidden className="mt-0.5 shrink-0 text-signal-text" />
          {a.caller_is_verifier ? (
            <span>
              <span className="font-semibold text-fg">
                You verified this field, so you cannot approve it.
              </span>{' '}
              A second person on the credit team must.
            </span>
          ) : (
            <span>
              {a.verifier_labels.length ? (
                <>
                  <span className="font-semibold text-fg">
                    The officer who verified the field cannot approve:
                  </span>{' '}
                  {a.verifier_labels.join(', ')}.
                </>
              ) : (
                <span className="font-semibold text-fg">
                  No field visit: established from space.
                </span>
              )}{' '}
              The transfer runs on the simulated provider; the SMS is real when the gateway is on.
            </span>
          )}
        </p>
      </div>
    </article>
  )
}
