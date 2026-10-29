import { ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CROP_LABELS, ISSUE_LABELS } from '@repo/shared'
import { DemoBadge } from '../components/DemoBadge'
import { Muted, Panel } from '../components/Panel'
import type { Officer } from '../hooks/useAuth'
import type { DashCluster, DashObservation, LiveData } from '../hooks/useLive'
import { hrefFor } from '../hooks/useRoute'
import { ago, confidenceText, reportNumber, REVIEW_REASON_TEXT, SEVERITY_TEXT } from '../lib/copy'
import { PhotoSection } from '../sections/PhotoSection'
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
  const [tab, setTab] = useState<'review' | 'cluster'>('review')
  const clustered = useMemo(() => new Set((clusters ?? []).flatMap(c => c.members)), [clusters])
  const rows = useMemo(() => queueRows(observations ?? [], clusters), [observations, clusters])
  const review = rows.filter(NEEDS_REVIEW)
  const inCluster = rows.filter(o => !NEEDS_REVIEW(o))
  const shown = tab === 'review' ? review : inCluster
  const selected =
    (selectedId && (observations ?? []).find(o => o.id === selectedId)) || shown[0] || null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Human in the loop</p>
          <h1 className="mt-1 font-display text-display-xl font-bold text-fg">Officer queue</h1>
        </div>
        <DemoBadge rows={shown} />
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Queue">
        <Tab current={tab === 'review'} onClick={() => setTab('review')}>
          Routed to an officer ({review.length})
        </Tab>
        <Tab current={tab === 'cluster'} onClick={() => setTab('cluster')}>
          In a cluster, not verified ({inCluster.length})
        </Tab>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Panel eyebrow={tab === 'review' ? 'Never guessed' : 'Verify to upgrade the alert'}>
          {observations === null && <Muted>Loading…</Muted>}
          {observations && shown.length === 0 && <Muted>Nothing waiting here.</Muted>}
          <ul className="flex max-h-[70vh] flex-col divide-y divide-hairline overflow-y-auto">
            {shown.map(o => {
              const current = selected?.id === o.id
              return (
                <li key={o.id}>
                  <a
                    href={hrefFor({ page: 'queue', id: o.id })}
                    aria-current={current ? 'true' : undefined}
                    className={`flex items-center gap-3 px-2 py-2.5 ${current ? 'bg-well' : 'hover:bg-ground'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="eyebrow">
                        {reportNumber(o.id)} · {o.district} · {ago(o.createdAt)}
                        {o.sim && <span className="ml-1 text-attention-text">· demo</span>}
                      </p>
                      <p className="truncate font-semibold text-fg">
                        {CROP_LABELS[o.crop]} ·{' '}
                        {o.suspectedIssue && o.suspectedIssue !== 'unknown'
                          ? `AI: ${ISSUE_LABELS[o.suspectedIssue]}`
                          : 'AI: not sure'}
                      </p>
                      <p className="truncate text-caption text-fg-2">
                        {NEEDS_REVIEW(o) && o.reviewReason
                          ? REVIEW_REASON_TEXT[o.reviewReason]
                          : clustered.has(o.id)
                            ? 'In an active cluster'
                            : ''}
                      </p>
                    </div>
                    <ChevronRight size={18} strokeWidth={2} aria-hidden className="text-fg" />
                  </a>
                </li>
              )
            })}
          </ul>
        </Panel>

        {selected ? (
          <Panel
            eyebrow={`Report ${reportNumber(selected.id)}`}
            title={`${CROP_LABELS[selected.crop]} · ${selected.district}`}
            actions={
              <a
                href={hrefFor({ page: 'observation', id: selected.id })}
                className="text-label font-semibold text-fg underline decoration-hairline-strong underline-offset-2"
              >
                Full report
              </a>
            }
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="flex flex-col gap-2">
                <PhotoSection path={selected.photoPaths[0] ?? null} sim={selected.sim} />
                <p className="text-label">
                  {selected.band
                    ? `${selected.suspectedIssue ? ISSUE_LABELS[selected.suspectedIssue] : 'Unknown'} · ${confidenceText(selected.band)}`
                    : 'Not assessed yet'}
                  {selected.severity && ` · ${SEVERITY_TEXT[selected.severity]}`}
                </p>
                {selected.description && (
                  <p className="text-label text-fg-2">Farmer says: {selected.description}</p>
                )}
              </div>
              <VerifySection key={selected.id} observation={selected} officer={officer} />
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
    <button
      type="button"
      role="tab"
      aria-selected={current}
      onClick={onClick}
      className={`rounded-card border px-3 py-1.5 font-mono text-eyebrow font-medium uppercase ${
        current
          ? 'border-fg-2 bg-well text-fg'
          : 'border-hairline text-fg-2 hover:bg-well hover:text-fg'
      }`}
    >
      {children}
    </button>
  )
}
