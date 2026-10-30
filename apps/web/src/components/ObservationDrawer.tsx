import { useMemo } from 'react'
import { CROP_LABELS, ISSUE_LABELS, type Recommendation } from '@repo/shared'
import type { Officer } from '../hooks/useAuth'
import {
  useObservationDoc,
  useRecommendationDoc,
  type DashCluster,
  type DashObservation,
} from '../hooks/useLive'
import { useDrawerLinks } from '../hooks/useRoute'
import { reportNumber, STATUS_TEXT, VERIFICATION_TEXT } from '../lib/copy'
import { AdviceSection } from '../sections/AdviceSection'
import { EvidenceSection } from '../sections/EvidenceSection'
import { PhotoSection } from '../sections/PhotoSection'
import { AssessmentFacts, DetailBlock, ReportFacts } from '../sections/ReportDetailSection'
import { VerifySection } from '../sections/VerifySection'
import { DemoBadge } from './DemoBadge'
import { Drawer } from './Drawer'
import { Disclosure } from './PageHeader'
import { Bar, SkeletonRows } from './Skeleton'

// One report, in a drawer over the page it was opened from, in labelled blocks that read in
// seconds (polish 30 Oct): the key facts as a grid, then Photo, Assessment, the advice sent, the
// evidence (sources, the product check and escalation, one level down) and the officer's
// verification. Every citation is a chip that opens the original document.
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
  const { close } = useDrawerLinks()
  if (!o)
    return (
      <Drawer
        kicker="Report"
        title={
          o === null ? (
            'Report not found'
          ) : (
            <>
              <span className="sr-only">Opening the report</span>
              <Bar className="h-6 w-64" />
            </>
          )
        }
        closeHref={close()}
      >
        {o === null ? (
          <p className="text-label text-fg-2">This report does not exist or was removed.</p>
        ) : (
          <SkeletonRows rows={5} label="Loading the report" />
        )}
      </Drawer>
    )

  return (
    <Drawer
      kicker={`Report ${reportNumber(o.id)} · ${STATUS_TEXT[o.status]}`}
      title={`${CROP_LABELS[o.crop]} · ${o.issue && o.issue !== 'unknown' ? ISSUE_LABELS[o.issue] : 'Not identified yet'}`}
      aside={<DemoBadge rows={[o]} />}
      closeHref={close()}
    >
      <div className="flex flex-col gap-5">
        <ReportFacts observation={o} cluster={cluster} full />

        <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
          <DetailBlock label="Photo">
            <PhotoSection path={o.photoPaths[0] ?? null} sim={o.sim} />
          </DetailBlock>
          <DetailBlock label="Assessment">
            <AssessmentFacts observation={o} />
          </DetailBlock>
        </div>

        <DetailBlock label="Advice sent to the farmer">
          <AdviceSection recommendation={recommendation} />
        </DetailBlock>

        <DetailBlock label="Evidence">
          <Disclosure summary="Why this advice?" hint="sources, product check, escalation">
            <EvidenceSection obsId={o.id} bare />
          </Disclosure>
        </DetailBlock>

        <DetailBlock label={`Officer · ${VERIFICATION_TEXT[o.verification]}`}>
          <VerifySection observation={o} officer={officer} />
        </DetailBlock>
      </div>
    </Drawer>
  )
}
