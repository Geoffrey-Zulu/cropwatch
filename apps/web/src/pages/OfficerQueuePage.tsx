import { ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CROP_LABELS, ISSUE_LABELS } from '@repo/shared'
import { DemoBadge } from '../components/DemoBadge'
import { PageHeader } from '../components/PageHeader'
import { SkeletonRows } from '../components/Skeleton'
import { Muted, Panel } from '../components/Panel'
import type { Officer } from '../hooks/useAuth'
import type { DashCluster, DashObservation, LiveData } from '../hooks/useLive'
import { hrefFor } from '../hooks/useRoute'
import { ago, reportNumber, REVIEW_REASON_TEXT } from '../lib/copy'
import { PhotoSection } from '../sections/PhotoSection'
import { AssessmentFacts, DetailBlock, ReportFacts } from '../sections/ReportDetailSection'
import { VerifySection } from '../sections/VerifySection'

const NEEDS_REVIEW = (o: DashObservation) => o.status === 'awaiting_expert_review'
const UNVERIFIED_IN_CLUSTER = (o: DashObservation, clustered: Set<string>) =>
  clustered.has(o.id) && (o.verification === 'AI_ASSESSED' || o.verification === 'UNVERIFIED')

// The queue: reports routed to an officer (never guessed: CLAUDE.md invariant 4), then reports
// in active clusters that no officer has verified yet (a verify upgrades the cluster's alert to
// a verified cluster alert). Newest first.
export function queueRows(observations: DashObservation[], clusters: DashCluster[] | null = []) {
  const clustered = new Set((clusters ?? []).flatMap(c => c.members))
  return observations
    .filter(o => NEEDS_REVIEW(o) || UNVERIFIED_IN_CLUSTER(o, clustered))
    .sort(
      (a, b) =>
        Number(NEEDS_REVIEW(b)) - Number(NEEDS_REVIEW(a)) || b.createdAt.localeCompare(a.createdAt)
    )
}

export function OfficerQueuePage({
  selectedId,
  officer,
  observations,
  clusters,
}: { selectedId: string | null; officer: Officer } & LiveData) {
  const [tab, setTab] = useQueueTab()
  const clustered = useMemo(() => new Set((clusters ?? []).flatMap(c => c.members)), [clusters])
  const rows = useMemo(() => queueRows(observations ?? [], clusters), [observations, clusters])
  const review = rows.filter(NEEDS_REVIEW)
  const inCluster = rows.filter(o => !NEEDS_REVIEW(o))
  const shown = tab === 'review' ? review : inCluster
  const selected =
    (selectedId && (observations ?? []).find(o => o.id === selectedId)) || shown[0] || null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Officer queue" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Queue">
          <Tab current={tab === 'review'} onClick={() => setTab('review')}>
            Routed to an officer ({review.length})
          </Tab>
          <Tab current={tab === 'cluster'} onClick={() => setTab('cluster')}>
            In a cluster, not verified ({inCluster.length})
          </Tab>
        </div>
        <DemoBadge rows={shown} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Panel
          eyebrow={
            tab === 'review'
              ? 'AI could not identify, or was unsure'
              : 'Verify to upgrade the alert'
          }
        >
          {observations === null && <SkeletonRows rows={6} label="Loading the queue" />}
          {observations && shown.length === 0 && <Muted>Nothing waiting here.</Muted>}
          <ul className="flex max-h-[70vh] flex-col gap-0.5 overflow-y-auto">
            {shown.map(o => {
              const current = selected?.id === o.id
              return (
                <li key={o.id}>
                  <a
                    href={hrefFor({ page: 'queue', id: o.id })}
                    aria-current={current ? 'true' : undefined}
                    className={`flex items-center gap-3 px-3 py-3 ${current ? 'bg-signal-tint' : 'hover:bg-well'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="meta">
                        <span className="font-mono">{reportNumber(o.id)}</span> · {o.district} ·{' '}
                        {ago(o.createdAt)}
                      </p>
                      <p className="mt-0.5 font-semibold text-fg">
                        {CROP_LABELS[o.crop]} ·{' '}
                        {o.suspectedIssue && o.suspectedIssue !== 'unknown'
                          ? `AI: ${ISSUE_LABELS[o.suspectedIssue]}`
                          : 'AI: not sure'}
                      </p>
                      <p className="text-caption text-fg-2">
                        {NEEDS_REVIEW(o) && o.reviewReason
                          ? REVIEW_REASON_TEXT[o.reviewReason]
                          : clustered.has(o.id)
                            ? 'In an active cluster'
                            : ''}
                      </p>
                    </div>
                    <ChevronRight aria-hidden className="text-fg" />
                  </a>
                </li>
              )
            })}
          </ul>
        </Panel>

        {selected ? (
          <Panel
            eyebrow={`Report ${reportNumber(selected.id)}`}
            title={`${CROP_LABELS[selected.crop]} · ${selected.suspectedIssue && selected.suspectedIssue !== 'unknown' ? ISSUE_LABELS[selected.suspectedIssue] : 'Not identified'}`}
            actions={
              <a
                href={hrefFor({
                  page: 'queue',
                  id: selected.id,
                  drawer: { kind: 'observation', id: selected.id },
                })}
                className="text-label font-semibold text-fg underline decoration-hairline-strong underline-offset-2"
              >
                Full report
              </a>
            }
          >
            <div className="flex flex-col gap-5">
              <ReportFacts observation={selected} columns="grid-cols-2 xl:grid-cols-4" />
              <div className="grid gap-5 sm:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)_minmax(0,1fr)]">
                <DetailBlock label="Photo">
                  <PhotoSection path={selected.photoPaths[0] ?? null} sim={selected.sim} />
                </DetailBlock>
                <DetailBlock label="Assessment">
                  <AssessmentFacts observation={selected} />
                </DetailBlock>
                <DetailBlock label="Verify" className="sm:col-span-2 xl:col-span-1">
                  <VerifySection key={selected.id} observation={selected} officer={officer} />
                </DetailBlock>
              </div>
            </div>
          </Panel>
        ) : (
          <Panel>
            <Muted>Select a report to verify it.</Muted>
          </Panel>
        )}
      </div>
    </div>
  )
}

type QueueTab = 'review' | 'cluster'

// The queue opens on the tab last used in this browser, so the demo laptop can be left on
// "In a cluster, not verified" (docs/demo-ops.md, pre-stage).
function useQueueTab(): [QueueTab, (tab: QueueTab) => void] {
  const key = 'phytos.queue-tab'
  const [tab, setTab] = useState<QueueTab>(() => {
    try {
      return window.localStorage.getItem(key) === 'cluster' ? 'cluster' : 'review'
    } catch {
      return 'review'
    }
  })
  return [
    tab,
    (next: QueueTab) => {
      setTab(next)
      try {
        window.localStorage.setItem(key, next)
      } catch {
        // Not remembered; the tab still changes.
      }
    },
  ]
}

function Tab({
  current,
  onClick,
  children,
}: {
  current: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button type="button" role="tab" aria-selected={current} onClick={onClick} className="toggle">
      {children}
    </button>
  )
}
