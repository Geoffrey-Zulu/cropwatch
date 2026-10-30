import { ExternalLink, ShieldCheck, ShieldX } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  ISSUE_LABELS,
  PRODUCT_SOURCE_LABELS,
  withoutEmDash,
  type ObservationEvidence,
} from '@repo/shared'
import { Muted, Panel } from '../components/Panel'
import { SkeletonRows } from '../components/Skeleton'
import {
  confidenceText,
  REJECTION_TEXT,
  REVIEW_REASON_TEXT,
  STATUS_TEXT,
  TIER_NAMES,
  VERIFICATION_TEXT,
} from '../lib/copy'
import { trpc } from '../lib/trpc'

// What the diagnosis and the advice rested on, all of it already logged by the API: the
// sources retrieved (with tiers), the register check (passed and refused, and why), and the
// escalation state. Confidence in words only; model numbers never leave the API.
// `bare` drops the panel, for use one level down inside a drawer ("Why this advice?").
export function EvidenceSection({ obsId, bare = false }: { obsId: string; bare?: boolean }) {
  const evidence = trpc.evidence.observation.useQuery({ obsId }, { retry: 1 })
  if (bare)
    return evidence.data ? (
      <EvidenceBody evidence={evidence.data} />
    ) : evidence.error ? (
      <Muted>The evidence could not be loaded ({evidence.error.message}).</Muted>
    ) : (
      <SkeletonRows rows={4} label="Loading the evidence" />
    )
  return (
    <Panel eyebrow="Evidence" title="What this rests on">
      {evidence.isLoading && <SkeletonRows rows={4} label="Loading the evidence" />}
      {evidence.error && (
        <Muted>The evidence could not be loaded ({evidence.error.message}).</Muted>
      )}
      {evidence.data && <EvidenceBody evidence={evidence.data} />}
    </Panel>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="eyebrow mb-1.5">{title}</h3>
      {children}
    </div>
  )
}

function Tier({ tier }: { tier: number }) {
  return (
    <span className="chip ml-1.5 border-hairline-strong text-fg-2">
      Tier {tier} · {TIER_NAMES[tier] ?? 'Source'}
    </span>
  )
}

function EvidenceBody({ evidence }: { evidence: ObservationEvidence }) {
  const { diagnosis, retrieval, regulatory } = evidence
  return (
    <div className="flex flex-col gap-3">
      <Block title="Escalation">
        <ul className="flex flex-col gap-0.5 text-label">
          <li>Status: {STATUS_TEXT[evidence.status]}</li>
          <li>
            Verification: {VERIFICATION_TEXT[evidence.verification_state]}
            {evidence.verified_issue && ` as ${ISSUE_LABELS[evidence.verified_issue]}`}
          </li>
          {diagnosis?.needs_expert_review ? (
            <li className="font-semibold text-fg">
              Routed to an officer:{' '}
              {diagnosis.expert_review_reason
                ? REVIEW_REASON_TEXT[diagnosis.expert_review_reason]
                : 'review requested'}
            </li>
          ) : (
            diagnosis && <li>Not routed: the AI assessment met the bar for advice.</li>
          )}
        </ul>
      </Block>

      <Block title="AI assessment">
        {diagnosis ? (
          <ul className="flex flex-col gap-0.5 text-label">
            <li>
              {ISSUE_LABELS[diagnosis.suspected_issue]} ·{' '}
              {confidenceText(diagnosis.confidence_band)}
            </li>
            <li className="font-mono text-caption text-fg-2">
              {diagnosis.model_id} · prompt {diagnosis.prompt_version}
              {diagnosis.attempts ? ` · ${diagnosis.attempts} attempt(s)` : ''}
            </li>
          </ul>
        ) : (
          <Muted>Not assessed yet.</Muted>
        )}
      </Block>

      <Block title="Sources retrieved">
        {retrieval ? (
          <div className="flex flex-col gap-2">
            <p className="text-label">
              {retrieval.retrieved} passages found; {retrieval.excerpts.length} given to the model
              for the query:
            </p>
            <p className="rounded-card bg-ground px-2 py-1 font-mono text-caption text-fg-2">
              {retrieval.query}
            </p>
            <ul className="flex flex-col gap-1">
              {retrieval.excerpts.map(e => (
                <li key={`${e.ref}-${e.document_id}`} className="flex items-start gap-2 text-label">
                  <span className="mt-0.5 rounded-tag border border-hairline-strong px-1 font-mono text-[11px]">
                    {e.ref}
                  </span>
                  <span className="min-w-0">
                    {e.source_url ? (
                      <a
                        href={e.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-fg underline decoration-hairline-strong underline-offset-2"
                      >
                        {e.title}
                        <ExternalLink
                          size={16}

                          aria-hidden
                          className="ml-1 inline"
                        />
                      </a>
                    ) : (
                      <span className="font-semibold">{e.title}</span>
                    )}
                    <Tier tier={e.tier} />
                  </span>
                </li>
              ))}
            </ul>
            {retrieval.dropped.length > 0 && (
              <div>
                <p className="text-label font-semibold">Steps the checks removed</p>
                <ul className="flex flex-col gap-0.5">
                  {retrieval.dropped.map(d => (
                    <li key={d.text} className="text-caption text-fg-2">
                      {withoutEmDash(d.text)} ({d.reason.replace(/_/g, ' ')})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {retrieval.model_id && (
              <p className="font-mono text-caption text-fg-2">
                Composed by {retrieval.model_id} · prompt {retrieval.prompt_version}
              </p>
            )}
          </div>
        ) : regulatory?.sources.length ? (
          <ul className="flex flex-col gap-1">
            {regulatory.sources.map(s => (
              <li key={s.uri} className="text-label">
                <span className="font-semibold">{s.title}</span>
                <Tier tier={s.tier} />
              </li>
            ))}
          </ul>
        ) : (
          <Muted>No retrieval logged for this report.</Muted>
        )}
      </Block>

      <Block title="Register check (deterministic)">
        {regulatory ? (
          <div className="flex flex-col gap-2">
            {regulatory.passed.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {regulatory.passed.map(p => (
                  <li key={p.registration_no} className="flex gap-2 text-label">
                    <ShieldCheck
                      size={16}

                      aria-hidden
                      className="mt-0.5 shrink-0 text-signal-text"
                    />
                    <span>
                      <strong className="font-semibold">{p.trade_name}</strong> (
                      {p.active_ingredient}),{' '}
                      {p.source === 'plantwise_pmdg'
                        ? PRODUCT_SOURCE_LABELS.plantwise_pmdg
                        : `reg. ${p.registration_no}`}
                      <span className="block font-mono text-caption">
                        {p.source === 'plantwise_pmdg' ? 'Dose (from the guide)' : 'Label dose'}:{' '}
                        {p.label_dose}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-label">
                No chemical passed: the advice is IPM only, with a referral to an extension officer.
              </p>
            )}
            {regulatory.rejected.length > 0 && (
              <ul className="flex flex-col gap-1">
                {regulatory.rejected.map(r => (
                  <li key={r.candidate} className="flex gap-2 text-label">
                    <ShieldX
                      size={16}

                      aria-hidden
                      className="mt-0.5 shrink-0 text-fg-2"
                    />
                    <span>
                      {r.candidate}: {REJECTION_TEXT[r.reason] ?? r.reason.replace(/_/g, ' ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-caption text-fg-2">
              Every chemical is checked against registered_products; doses come from the label,
              never from the model.
            </p>
          </div>
        ) : (
          <Muted>No recommendation yet.</Muted>
        )}
      </Block>
    </div>
  )
}
