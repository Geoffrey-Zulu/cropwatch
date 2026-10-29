import { Activity, BadgeCheck, ChevronRight, CloudSun, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { ALERT_CLASS_LABELS, alertUncertainty, ISSUE_LABELS, type AlertClass } from '@repo/shared'
import type { DashAlert } from '../hooks/useLive'
import { useDrawerLinks } from '../hooks/useRoute'
import { ago, uncertaintyShort } from '../lib/copy'
import { DemoBadge } from './DemoBadge'
import { Drawer } from './Drawer'
import { LevelDot } from './LevelTag'
import { SkeletonRows } from './Skeleton'

const CLASS_ICON: Record<AlertClass, LucideIcon> = {
  weather_advisory: CloudSun,
  verified_cluster: BadgeCheck,
  model_risk_signal: Activity,
}

const FILTERS: { key: AlertClass | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'verified_cluster', label: 'Verified' },
  { key: 'model_risk_signal', label: 'Model' },
  { key: 'weather_advisory', label: 'Weather' },
]

const uncertaintyOf = (alert: DashAlert) => ({
  verified: alert.verifiedReports ?? 0,
  reports: alert.observationIds.length,
})

// The alerts, off the map page and behind the header bell (patterns-v2.md). A row says what
// and where, how bad and how sure; its factors and the full uncertainty sentence are one click
// down; the outbreak opens in its own drawer.
export function AlertsDrawer({ alerts }: { alerts: DashAlert[] | null }) {
  const { open, close } = useDrawerLinks()
  const [filter, setFilter] = useState<AlertClass | 'all'>('all')
  const shown = (alerts ?? []).filter(a => filter === 'all' || a.alertClass === filter)
  const count = (key: AlertClass | 'all') =>
    (alerts ?? []).filter(a => key === 'all' || a.alertClass === key).length
  return (
    <Drawer
      width="list"
      kicker="Alerts"
      title="What has been raised"
      question="Each alert with how bad it is and how sure we are."
      aside={<DemoBadge rows={alerts ?? []} />}
      closeHref={close()}
    >
      <div className="mb-2 flex flex-wrap gap-1" role="tablist" aria-label="Alert class">
        {FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className="toggle"
          >
            {f.label} <span className="text-fg-2">{count(f.key)}</span>
          </button>
        ))}
      </div>
      {alerts === null && <SkeletonRows rows={6} label="Loading alerts" />}
      {alerts && shown.length === 0 && <p className="py-6 text-label text-fg-2">No alerts.</p>}
      <ul className="flex flex-col">
        {shown.map(alert => {
          const Icon = CLASS_ICON[alert.alertClass]
          return (
            <li key={alert.id} className="border-b border-hairline last:border-b-0">
              <details className="group">
                <summary className="flex cursor-pointer list-none flex-col gap-1 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-baseline gap-3">
                    <LevelDot level={alert.level} />
                    <span className="min-w-0 flex-1 font-semibold text-fg">
                      {alert.issue === 'unknown' ? 'Crop problem' : ISSUE_LABELS[alert.issue]} ·{' '}
                      {alert.district}
                    </span>
                    <span className="meta shrink-0">{ago(alert.createdAt)}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-caption text-fg-2">
                    <Icon size={14} strokeWidth={2} aria-hidden />
                    {ALERT_CLASS_LABELS[alert.alertClass]} ·{' '}
                    {uncertaintyShort(alert.alertClass, uncertaintyOf(alert))}
                    <ChevronRight
                      size={14}
                      strokeWidth={2}
                      aria-hidden
                      className="ml-auto transition-transform group-open:rotate-90"
                    />
                  </span>
                </summary>
                <div className="flex flex-col gap-2 pb-4 text-label">
                  <ul className="flex flex-col gap-1">
                    {alert.factors.map(f => (
                      <li key={f} className="text-fg">
                        {f}
                      </li>
                    ))}
                  </ul>
                  <p className="text-caption text-fg-2">
                    {alertUncertainty(alert.alertClass, uncertaintyOf(alert))}
                  </p>
                  {alert.clusterId && (
                    <a
                      href={open({ kind: 'outbreak', id: alert.clusterId })}
                      className="inline-flex items-center gap-0.5 self-start font-semibold text-signal-text hover:underline"
                    >
                      Open the outbreak
                      <ChevronRight size={16} strokeWidth={2} aria-hidden />
                    </a>
                  )}
                </div>
              </details>
            </li>
          )
        })}
      </ul>
    </Drawer>
  )
}
