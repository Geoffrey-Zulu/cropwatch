import { ArrowLeft } from 'lucide-react'
import { useMemo } from 'react'
import { CROP_LABELS, ISSUE_LABELS } from '@repo/shared'
import { AlertCard } from '../components/AlertCard'
import { DemoBadge } from '../components/DemoBadge'
import { Figure, Muted, Panel } from '../components/Panel'
import { RiskFactors } from '../components/RiskFactors'
import { ZambiaMap } from '../components/ZambiaMap'
import {
  useAlertDoc,
  useClusterDoc,
  useRiskDoc,
  type DashAlert,
  type DashCluster,
  type DashObservation,
  type DashRisk,
  type LiveData,
} from '../hooks/useLive'
import { useNow } from '../hooks/useNow'
import { hrefFor } from '../hooks/useRoute'
import {
  confidenceText,
  dateTime,
  reportNumber,
  shortDate,
  STATUS_TEXT,
  VERIFICATION_TEXT,
} from '../lib/copy'
import { WeatherSection } from '../sections/WeatherSection'

const DAY = 86_400_000

// One cluster: the reports in it, how many an officer verified, its alert and class, the
// district's prototype risk signal with its factors, and the weather context.
export function OutbreakDetailPage({
  clusterId,
  observations,
  risk: allRisk,
}: { clusterId: string } & LiveData) {
  const cluster = useClusterDoc(clusterId)
  const alert = useAlertDoc(cluster?.alertId ?? null)
  const risk = useRiskDoc(cluster?.districtSlug ?? null)
  if (cluster === undefined) return <Muted>Opening the outbreak…</Muted>
  if (cluster === null) return <Muted>This cluster no longer exists.</Muted>
  return (
    <OutbreakDetailView
      cluster={cluster}
      alert={alert}
      risk={risk}
      observations={observations}
      allRisk={allRisk}
    />
  )
}

// The page itself, from data: pure, so the dev preview can render it from seed fixtures.
export function OutbreakDetailView({
  cluster,
  alert,
  risk,
  observations,
  allRisk,
}: {
  cluster: DashCluster
  alert: DashAlert | null | undefined
  risk: DashRisk | null | undefined
  observations: DashObservation[] | null
  allRisk: DashRisk[] | null
}) {
  const members = useMemo(() => {
    if (!cluster || !observations) return []
    const ids = new Set(cluster.members)
    return observations
      .filter(o => ids.has(o.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [cluster, observations])

  const levels = useMemo(
    () => new Map((allRisk ?? []).map(r => [r.districtSlug, r.level])),
    [allRisk]
  )

  const { latitude: lat, longitude: lng } = cluster.center
  const focus: [[number, number], [number, number]] = [
    [lng - 0.32, lat - 0.25],
    [lng + 0.32, lat + 0.25],
  ]

  return (
    <div className="flex flex-col gap-4">
      <a href="#/" className="inline-flex items-center gap-1 text-label font-semibold text-navy">
        <ArrowLeft size={16} strokeWidth={2} aria-hidden /> National map
      </a>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">
            Outbreak · cluster {cluster.active ? 'active' : 'closed'} · first detected{' '}
            {dateTime(cluster.firstDetectedAt)}
          </p>
          <h1 className="font-display text-display-xl font-semibold text-navy">
            {ISSUE_LABELS[cluster.issue]} near {cluster.district}
          </h1>
        </div>
        <DemoBadge rows={[cluster, ...members]} />
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-card border border-line bg-sheet p-4 md:grid-cols-4">
        <Figure value={cluster.size} label={`Reports within ${cluster.radiusKm} km`} />
        <Figure value={cluster.verifiedMembers} label="Verified by an officer" />
        <Figure value={cluster.newLast24h} label="New in 24 hours" />
        <Figure value={shortDate(cluster.updatedAt)} label="Last updated" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-4">
          <ZambiaMap
            levels={levels}
            focus={focus}
            height={420}
            points={members.map(m => ({
              id: m.id,
              location: m.location,
              sim: m.sim,
              issue: m.issue,
              label: `Report ${reportNumber(m.id)} · ${shortDate(m.createdAt)}`,
            }))}
            clusters={[
              {
                id: cluster.id,
                center: cluster.center,
                radiusKm: cluster.radiusKm,
                issue: cluster.issue,
                size: cluster.size,
                sim: cluster.sim,
              },
            ]}
            onPoint={id => (window.location.hash = hrefFor({ page: 'observation', id }))}
          />
          <Panel eyebrow="Timeline" title="Reports per day in this cluster">
            <Timeline members={members} />
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Panel eyebrow="Alert" title="What was raised">
            {alert === undefined && <Muted>Loading…</Muted>}
            {alert === null && <Muted>No alert for this cluster.</Muted>}
            {alert && <AlertCard alert={alert} />}
          </Panel>
          <Panel eyebrow="Prototype risk signal" title={`${cluster.district} district`}>
            {risk ? <RiskFactors risk={risk} /> : <Muted>Not computed yet.</Muted>}
          </Panel>
        </div>
      </div>

      <Panel eyebrow="Evidence" title="Reports in this cluster">
        <ReportsTable rows={members} />
      </Panel>

      <WeatherSection districtSlug={cluster.districtSlug} />
    </div>
  )
}

function Timeline({ members }: { members: DashObservation[] }) {
  const days = 7
  const end = useNow()
  const counts = Array.from({ length: days }, (_, i) => {
    const from = end - (days - i) * DAY
    return {
      label: shortDate(new Date(from + DAY).toISOString()),
      n: members.filter(m => {
        const t = Date.parse(m.createdAt)
        return t > from && t <= from + DAY
      }).length,
    }
  })
  const max = Math.max(1, ...counts.map(c => c.n))
  return (
    <div className="flex h-36 items-end gap-2" role="img" aria-label="Reports per day, last 7 days">
      {counts.map(c => (
        <div key={c.label} className="flex flex-1 flex-col items-center gap-1">
          <span className="font-mono text-caption text-ink-2">{c.n || ''}</span>
          <div
            className="w-full rounded-t-[2px] bg-navy"
            style={{ height: `${(c.n / max) * 90}px` }}
          />
          <span className="font-mono text-[11px] text-ink-2">{c.label}</span>
        </div>
      ))}
    </div>
  )
}

export function ReportsTable({ rows }: { rows: DashObservation[] }) {
  if (rows.length === 0) return <Muted>No reports to show.</Muted>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-label">
        <thead>
          <tr className="border-b border-line">
            {['Report', 'Sent', 'Place', 'Crop', 'AI assessment', 'Verification', 'Status'].map(
              h => (
                <th key={h} className="eyebrow py-2 pr-3 font-semibold">
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(o => (
            <tr key={o.id} className="border-b border-line last:border-b-0">
              <td className="py-2 pr-3">
                <a
                  href={hrefFor({ page: 'observation', id: o.id })}
                  className="font-mono font-semibold text-navy underline decoration-line-strong underline-offset-2"
                >
                  {reportNumber(o.id)}
                </a>
                {o.sim && (
                  <span className="ml-1 font-mono text-eyebrow text-copper-deep">DEMO</span>
                )}
              </td>
              <td className="py-2 pr-3 font-mono">{dateTime(o.createdAt)}</td>
              <td className="py-2 pr-3">
                {o.district}
                {o.camp ? ` · ${o.camp}` : ''}
              </td>
              <td className="py-2 pr-3">{CROP_LABELS[o.crop]}</td>
              <td className="py-2 pr-3">
                {o.suspectedIssue ? ISSUE_LABELS[o.suspectedIssue] : 'Not assessed'}
                {o.band && (
                  <span className="block text-caption text-ink-2">{confidenceText(o.band)}</span>
                )}
              </td>
              <td className="py-2 pr-3">{VERIFICATION_TEXT[o.verification]}</td>
              <td className="py-2 pr-3">{STATUS_TEXT[o.status] ?? o.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
