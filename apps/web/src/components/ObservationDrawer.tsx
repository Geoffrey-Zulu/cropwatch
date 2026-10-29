import { useMemo } from 'react'
import { CROP_LABELS, ISSUE_LABELS, withoutEmDash, type Recommendation } from '@repo/shared'
import type { Officer } from '../hooks/useAuth'
import {
  useObservationDoc,
  useRecommendationDoc,
  type DashCluster,
  type DashObservation,
} from '../hooks/useLive'
import { useDrawerLinks } from '../hooks/useRoute'
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
import { DemoBadge } from './DemoBadge'
import { Drawer } from './Drawer'
import { Disclosure } from './PageHeader'
import { SkeletonRows } from './Skeleton'

// One report, in a drawer over the page it was opened from. The default answers "what did the
// farmer report, and what did they get back?": the photo and facts, the AI assessment in words,
// the advice sent, and the officer's verification. Why the advice says what it says (sources,
// the register check, escalation) is one level down.
export function ObservationDrawer({
  obsId,
  officer,
  clusters,
}: {
  obsId: string
  officer: Officer
  clusters: DashCluster[] | null
}) {
  const observation = useObservationDoc(obsId)
  const recommendation = useRecommendationDoc(observation?.recommendationId ?? null)
  const cluster = useMemo(
    () => (clusters ?? []).find(c => c.members.includes(obsId)) ?? null,
    [clusters, obsId]
  )
  return (
    <ObservationDrawerView
      observation={observation}
      recommendation={observation?.recommendationId ? recommendation : null}
      cluster={cluster}
      officer={officer}
    />
  )
}

export function ObservationDrawerView({
  observation: o,
  recommendation,
  cluster,
  officer,
}: {
  // undefined while loading; null when the report is gone.
  observation: DashObservation | null | undefined
  recommendation: Recommendation | null | undefined
  cluster: DashCluster | null
  officer: Officer
}) {
  const { open, close } = useDrawerLinks()
  if (!o)
    return (
      <Drawer kicker="Report" title="Opening the report" closeHref={close()}>
        {o === null ? (
          <p className="text-label text-fg-2">This report does not exist or was removed.</p>
        ) : (
          <SkeletonRows rows={5} label="Loading the report" />
        )}
      </Drawer>
    )

  const facts: [string, React.ReactNode][] = [
    ['Place', `${o.district}${o.camp ? ` · ${o.camp}` : ''} (${o.province})`],
    [
      'Precise point',
      <>
        <span className="font-mono">
          {o.location.latitude.toFixed(4)}, {o.location.longitude.toFixed(4)}
        </span>
        <span className="block text-caption text-fg-2">
          Command Center only; never in outgrower views.
        </span>
      </>,
    ],
    ['Reporter', o.reporterRole === 'field_officer' ? 'Field officer' : 'Farmer'],
    ...(o.plantingDate ? [['Planted', shortDate(o.plantingDate)] as [string, string]] : []),
    ...(o.description ? [['Farmer says', o.description] as [string, string]] : []),
  ]

  return (
    <Drawer
      kicker={`Report ${reportNumber(o.id)} · ${dateTime(o.createdAt)} · ${STATUS_TEXT[o.status]}`}
      title={`${CROP_LABELS[o.crop]} · ${o.issue && o.issue !== 'unknown' ? ISSUE_LABELS[o.issue] : 'Not identified yet'}`}
      question="What did the farmer report, and what did they get back?"
      aside={<DemoBadge rows={[o]} />}
      closeHref={close()}
    >
      <div className="grid gap-5 sm:grid-cols-[200px_minmax(0,1fr)]">
        <PhotoSection path={o.photoPaths[0] ?? null} sim={o.sim} />
        <dl className="flex flex-col gap-2 text-label">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-caption text-fg-2">{label}</dt>
              <dd className="text-fg">{value}</dd>
            </div>
          ))}
          {cluster && (
            <div>
              <dt className="text-caption text-fg-2">Cluster</dt>
              <dd>
                <a
                  href={open({ kind: 'outbreak', id: cluster.id })}
                  className="font-semibold text-signal-text hover:underline"
                >
                  {cluster.size} {ISSUE_LABELS[cluster.issue]} reports near {cluster.district}
                </a>
              </dd>
            </div>
          )}
        </dl>
      </div>

      <section className="mt-6" aria-labelledby="ai">
        <h3 id="ai" className="text-section font-semibold text-fg">
          AI assessment
        </h3>
        {o.band ? (
          <div className="mt-1 flex flex-col gap-1 text-label text-fg">
            <p>
              {o.suspectedIssue ? ISSUE_LABELS[o.suspectedIssue] : 'Unknown'} ·{' '}
              {confidenceText(o.band)}
              {o.severity && ` · ${SEVERITY_TEXT[o.severity]}`}
            </p>
            {o.needsReview && o.reviewReason && (
              <p className="text-fg-2">
                Routed to an officer: {REVIEW_REASON_TEXT[o.reviewReason]}
              </p>
            )}
            {o.symptoms.length > 0 && (
              <p className="text-fg-2">Saw: {o.symptoms.map(withoutEmDash).join('; ')}</p>
            )}
          </div>
        ) : (
          <p className="mt-1 text-label text-fg-2">Not assessed yet.</p>
        )}
      </section>

      <section className="mt-6" aria-labelledby="advice">
        <h3 id="advice" className="text-section font-semibold text-fg">
          What the farmer received
        </h3>
        <div className="mt-2">
          <AdviceSection recommendation={recommendation} />
        </div>
      </section>

      <section className="mt-6" aria-labelledby="officer">
        <h3 id="officer" className="text-section font-semibold text-fg">
          Officer: {VERIFICATION_TEXT[o.verification]}
        </h3>
        <div className="mt-2">
          <VerifySection observation={o} officer={officer} />
        </div>
      </section>

      <div className="mt-6">
        <Disclosure summary="Why this advice?" hint="sources, register check, escalation">
          <EvidenceSection obsId={o.id} bare />
        </Disclosure>
      </div>
    </Drawer>
  )
}
