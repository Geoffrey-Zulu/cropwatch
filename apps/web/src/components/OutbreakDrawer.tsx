import { Activity, BadgeCheck, ChevronRight, CloudSun, type LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import { ALERT_CLASS_LABELS, alertUncertainty, ISSUE_LABELS, type AlertClass } from '@repo/shared'
import {
  useAlertDoc,
  useClusterDoc,
  useRiskDoc,
  type DashAlert,
  type DashCluster,
  type DashObservation,
  type DashRisk,
} from '../hooks/useLive'
import { useNow } from '../hooks/useNow'
import { useDrawerLinks } from '../hooks/useRoute'
import {
  ago,
  confidenceText,
  dateTime,
  reportNumber,
  shortDate,
  VERIFICATION_TEXT,
} from '../lib/copy'
import { WeatherSection } from '../sections/WeatherSection'
import { DemoBadge } from './DemoBadge'
import { Drawer } from './Drawer'
import { LevelDot } from './LevelTag'
import { Disclosure } from './PageHeader'
import { Bar, SkeletonRows } from './Skeleton'
import { StatCards } from './StatCards'

const DAY = 86_400_000

const CLASS_ICON: Record<AlertClass, LucideIcon> = {
  weather_advisory: CloudSun,
  verified_cluster: BadgeCheck,
  model_risk_signal: Activity,
}

// One cluster, in a drawer over the map. The default answers "how big, and how sure?"; the
// reports, the day-by-day count, the district's factors and the weather are one click down.
export function OutbreakDrawer({
  clusterId,
  observations,
}: {
  clusterId: string
  observations: DashObservation[] | null
}) {
  const cluster = useClusterDoc(clusterId)
  const alert = useAlertDoc(cluster?.alertId ?? null)
  const risk = useRiskDoc(cluster?.districtSlug ?? null)
  return (
    <OutbreakDrawerView cluster={cluster} alert={alert} risk={risk} observations={observations} />
  )
}

export function OutbreakDrawerView({
  cluster,
  alert,
  risk,
  observations,
}: {
  // undefined while loading; null when the cluster is gone.
  cluster: DashCluster | null | undefined
  alert: DashAlert | null | undefined
  risk: DashRisk | null | undefined
  observations: DashObservation[] | null
}) {
  const { route, open, close } = useDrawerLinks()
  const fromAlerts = route.drawer?.kind === 'outbreak' && route.drawer.via === 'alerts'
  const members = useMemo(() => {
    if (!cluster || !observations) return []
    const ids = new Set(cluster.members)
    return observations
      .filter(o => ids.has(o.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [cluster, observations])

  if (!cluster)
    return (
      <Drawer
        kicker="Outbreak"
        title={
          cluster === null ? (
            'Outbreak not found'
          ) : (
            <>
              <span className="sr-only">Opening the outbreak</span>
              <Bar className="h-6 w-64" />
            </>
          )
        }
        closeHref={close()}
      >
        {cluster === null ? (
          <p className="text-label text-fg-2">This cluster no longer exists.</p>
        ) : (
          <SkeletonRows rows={4} label="Loading the outbreak" />
        )}
      </Drawer>
    )

  const Icon = alert ? CLASS_ICON[alert.alertClass] : null
  return (
    <Drawer
      kicker={`Outbreak · ${cluster.active ? 'active' : 'closed'} · first seen ${dateTime(cluster.firstDetectedAt)}`}
      title={`${ISSUE_LABELS[cluster.issue]} near ${cluster.district}`}
      back={fromAlerts ? { href: open({ kind: 'alerts' }), label: 'Back to alerts' } : undefined}
      aside={<DemoBadge rows={[cluster, ...members]} />}
      closeHref={close()}
    >
      <StatCards
        columns="grid-cols-2"
        stats={[
          {
            label: `Reports within ${cluster.radiusKm} km`,
            value: cluster.size,
            delta: cluster.newLast24h ? `↑${cluster.newLast24h} in 24 h` : 'None new in 24 h',
          },
          { label: 'Verified by an officer', value: cluster.verifiedMembers },
        ]}
      />

      <section className="mt-6" aria-labelledby="raised">
        <h3 id="raised" className="text-section font-semibold text-fg">
          What was raised
        </h3>
        {alert === undefined && <SkeletonRows rows={1} label="Loading the alert" />}
        {alert === null && <p className="mt-1 text-label text-fg-2">No alert for this cluster.</p>}
        {alert && Icon && (
          <div className="mt-2 flex flex-col gap-1">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5 text-label font-medium text-fg">
                <Icon size={16} aria-hidden />
                {ALERT_CLASS_LABELS[alert.alertClass]}
              </span>
              <LevelDot level={alert.level} />
              <span className="meta">{ago(alert.createdAt)}</span>
            </p>
            <p className="text-label text-fg-2">
              {alertUncertainty(alert.alertClass, {
                verified: alert.verifiedReports ?? 0,
                reports: alert.observationIds.length,
              })}
            </p>
          </div>
        )}
      </section>

      <section className="mt-6" aria-labelledby="district">
        <h3 id="district" className="text-section font-semibold text-fg">
          {cluster.district} district
        </h3>
        {risk === undefined && <SkeletonRows rows={1} label="Loading the district signal" />}
        {risk === null && <p className="mt-1 text-label text-fg-2">Not computed yet.</p>}
        {risk && (
          <div className="mt-1 text-label">
            <p className="flex items-baseline gap-2">
              <LevelDot level={risk.level} />
              <span className="meta">computed {ago(risk.computedAt)}</span>
            </p>
            <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-fg">
              {risk.factors.map(f => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <p className="mt-6 text-label">
        <a href="#/queue" className="font-medium text-signal-text hover:underline">
          Verify these reports in the officer queue
        </a>
        <span className="text-fg-2">
          : a verified report turns this into a verified cluster alert.
        </span>
      </p>

      <div className="mt-6">
        <Disclosure summary="Reports in this cluster" hint={members.length}>
          <ul className="flex flex-col">
            {members.map(o => (
              <li key={o.id}>
                <a
                  href={open({ kind: 'observation', id: o.id })}
                  className="-mx-2 flex items-start gap-3 rounded-card px-2 py-2 hover:bg-well"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-label text-fg">
                      <span className="font-mono font-semibold">{reportNumber(o.id)}</span> ·{' '}
                      {dateTime(o.createdAt)}
                      {o.camp ? ` · ${o.camp}` : ''}
                    </span>
                    <span className="block text-caption text-fg-2">
                      {o.band ? confidenceText(o.band) : 'Not assessed'} ·{' '}
                      {VERIFICATION_TEXT[o.verification]}
                    </span>
                  </span>
                  <ChevronRight
                    size={16}

                    aria-hidden
                    className="mt-1 shrink-0 text-fg-2"
                  />
                </a>
              </li>
            ))}
          </ul>
        </Disclosure>
        <Disclosure summary="Reports per day" hint="last 7 days">
          <Timeline members={members} />
        </Disclosure>
        <Disclosure summary="Weather context" hint="Open-Meteo">
          <WeatherSection districtSlug={cluster.districtSlug} bare />
        </Disclosure>
      </div>
    </Drawer>
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
    <div className="flex h-28 items-end gap-2" role="img" aria-label="Reports per day, last 7 days">
      {counts.map(c => (
        <div key={c.label} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-caption tabular-nums text-fg-2">{c.n || ''}</span>
          <div
            className="w-full rounded-t-[2px] bg-fg-2"
            style={{ height: `${(c.n / max) * 64}px` }}
          />
          <span className="text-[11px] text-fg-2">{c.label}</span>
        </div>
      ))}
    </div>
  )
}
