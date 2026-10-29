import { ArrowLeft } from 'lucide-react'
import { useMemo } from 'react'
import { CROP_LABELS, ISSUE_LABELS, withoutEmDash, type Recommendation } from '@repo/shared'
import { DemoBadge } from '../components/DemoBadge'
import { Muted, Panel } from '../components/Panel'
import type { Officer } from '../hooks/useAuth'
import {
  useObservationDoc,
  useRecommendationDoc,
  type DashCluster,
  type DashObservation,
  type LiveData,
} from '../hooks/useLive'
import { hrefFor } from '../hooks/useRoute'
import {
  confidenceText,
  dateTime,
  reportNumber,
  REVIEW_REASON_TEXT,
  SEVERITY_TEXT,
  shortDate,
  STATUS_TEXT,
  VERIFICATION_TEXT,
} from '../lib/copy'
import { AdviceSection } from '../sections/AdviceSection'
import { EvidenceSection } from '../sections/EvidenceSection'
import { PhotoSection } from '../sections/PhotoSection'
import { VerifySection } from '../sections/VerifySection'

// One report, as the Command Center sees it: the photo, the facts (including the precise place,
// which only Command Center roles see), the AI assessment in words, the advice sent, the
// Evidence panel, and the officer's verify.
export function ObservationDetailPage({
  obsId,
  officer,
  clusters,
}: { obsId: string; officer: Officer } & LiveData) {
  const observation = useObservationDoc(obsId)
  const recommendation = useRecommendationDoc(observation?.recommendationId ?? null)
  const cluster = useMemo(
    () => (clusters ?? []).find(c => c.members.includes(obsId)) ?? null,
    [clusters, obsId]
  )

  if (observation === undefined) return <Muted>Opening the report…</Muted>
  if (observation === null) return <Muted>This report does not exist or was removed.</Muted>
  return (
    <ObservationDetailView
      observation={observation}
      recommendation={observation.recommendationId ? recommendation : null}
      cluster={cluster}
      officer={officer}
    />
  )
}

// The page itself, from data: pure, so the dev preview can render it from seed fixtures.
export function ObservationDetailView({
  observation: o,
  recommendation,
  cluster,
  officer,
}: {
  observation: DashObservation
  recommendation: Recommendation | null | undefined
  cluster: DashCluster | null
  officer: Officer
}) {
  return (
    <div className="flex flex-col gap-4">
      <a
        href={cluster ? hrefFor({ page: 'outbreak', id: cluster.id }) : '#/'}
        className="inline-flex items-center gap-1 text-label font-semibold text-fg"
      >
        <ArrowLeft size={16} strokeWidth={2} aria-hidden />
        {cluster ? 'Outbreak detail' : 'National map'}
      </a>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">
            Report {reportNumber(o.id)} · {dateTime(o.createdAt)} · {STATUS_TEXT[o.status]}
          </p>
          <h1 className="mt-1 font-display text-display-xl font-bold text-fg">
            {CROP_LABELS[o.crop]} ·{' '}
            {o.issue && o.issue !== 'unknown' ? ISSUE_LABELS[o.issue] : 'Not identified yet'}
          </h1>
        </div>
        <DemoBadge rows={[o]} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <PhotoSection path={o.photoPaths[0] ?? null} sim={o.sim} />
          <Panel eyebrow="Report" title="Facts">
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5 text-label">
              <dt className="eyebrow pt-0.5">Place</dt>
              <dd>
                {o.district}
                {o.camp ? ` · ${o.camp}` : ''} ({o.province})
              </dd>
              <dt className="eyebrow pt-0.5">Precise point</dt>
              <dd className="font-mono">
                {o.location.latitude.toFixed(4)}, {o.location.longitude.toFixed(4)}
                <span className="block font-body text-caption text-fg-2">
                  Command Center only; never in outgrower views.
                </span>
              </dd>
              <dt className="eyebrow pt-0.5">Reporter</dt>
              <dd>{o.reporterRole === 'field_officer' ? 'Field officer' : 'Farmer'}</dd>
              {o.plantingDate && (
                <>
                  <dt className="eyebrow pt-0.5">Planted</dt>
                  <dd>{shortDate(o.plantingDate)}</dd>
                </>
              )}
              {o.description && (
                <>
                  <dt className="eyebrow pt-0.5">Farmer says</dt>
                  <dd>{o.description}</dd>
                </>
              )}
              {cluster && (
                <>
                  <dt className="eyebrow pt-0.5">Cluster</dt>
                  <dd>
                    <a
                      href={hrefFor({ page: 'outbreak', id: cluster.id })}
                      className="font-semibold text-fg underline decoration-hairline-strong underline-offset-2"
                    >
                      {cluster.size} {ISSUE_LABELS[cluster.issue]} reports near {cluster.district}
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </Panel>
          <Panel eyebrow="AI assessment" title="What the model saw">
            {o.band ? (
              <div className="flex flex-col gap-2 text-label">
                <p>
                  <strong className="font-semibold">
                    {o.suspectedIssue ? ISSUE_LABELS[o.suspectedIssue] : 'Unknown'}
                  </strong>{' '}
                  · {confidenceText(o.band)}
                  {o.severity && ` · ${SEVERITY_TEXT[o.severity]}`}
                </p>
                {o.needsReview && o.reviewReason && (
                  <p className="font-semibold text-attention-text">
                    Routed to an officer: {REVIEW_REASON_TEXT[o.reviewReason]}
                  </p>
                )}
                {o.symptoms.length > 0 && (
                  <ul className="flex flex-col gap-0.5">
                    {o.symptoms.map(s => (
                      <li key={s} className="flex gap-2">
                        <span aria-hidden className="mt-[8px] h-1 w-1 shrink-0 bg-attention" />
                        {withoutEmDash(s)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <Muted>Not assessed yet.</Muted>
            )}
          </Panel>
          <Panel eyebrow="Officer" title={VERIFICATION_TEXT[o.verification]}>
            <VerifySection observation={o} officer={officer} />
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Panel eyebrow="Advice sent" title="What the farmer received">
            <AdviceSection recommendation={recommendation} />
          </Panel>
          <EvidenceSection obsId={o.id} />
        </div>
      </div>
    </div>
  )
}
