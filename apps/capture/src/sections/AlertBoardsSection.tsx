import {
  Activity,
  BadgeCheck,
  Bell,
  BellOff,
  BellRing,
  CloudSun,
  type LucideIcon,
} from 'lucide-react'
import {
  ALERT_CLASS_LABELS,
  alertClassOf,
  alertUncertainty,
  ISSUE_LABELS,
  type AlertClass,
} from '@repo/shared'
import { DemoBadge } from '../components/DemoBadge'
import type { AreaAlert } from '../hooks/useAreaAlerts'
import type { PushState } from '../hooks/usePush'
import { LEVEL_TEXT, shortDate } from '../lib/copy'

const LEVEL_BLOCK = {
  HIGH: 'bg-high text-high-ink border border-high',
  ELEVATED: 'bg-attention-tint text-attention-text border border-attention',
  LOW: 'bg-panel text-fg-2 border border-hairline-strong',
} as const

// Solid means verified (in leaf); dashed means modelled or forecast only (MASTER.md §2).
const CLASS_TAG: Record<AlertClass, { icon: LucideIcon; className: string }> = {
  weather_advisory: { icon: CloudSun, className: 'border-dashed border-hairline-strong text-fg-2' },
  verified_cluster: { icon: BadgeCheck, className: 'border-leaf bg-signal-tint text-signal-text' },
  model_risk_signal: {
    icon: Activity,
    className: 'border-dashed border-attention text-attention-text',
  },
}

// Area alerts: the class (what it rests on), the level with its contributing factors, and how
// sure it is in words. A level never appears without its factors (invariant 2).
export function AlertBoardsSection({
  district,
  alerts,
  push,
  onEnablePush,
}: {
  district: string | null
  alerts: AreaAlert[] | null
  push: PushState
  onEnablePush: () => void
}) {
  return (
    <section aria-labelledby="area-alerts" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <h2 id="area-alerts" className="font-display text-display font-bold text-fg">
          Near you
        </h2>
        {alerts && <DemoBadge rows={alerts} />}
      </div>

      {!district && (
        <p className="text-body text-fg-2">
          Send your first report and we will show crop alerts for your district here.
        </p>
      )}

      {district && alerts?.length === 0 && (
        <p className="text-body">
          No crop outbreaks reported around <strong className="font-extrabold">{district}</strong>{' '}
          right now.
        </p>
      )}

      {alerts?.map(alert => {
        const alertClass = alertClassOf(alert)
        const tag = CLASS_TAG[alertClass]
        return (
          <article key={alert.id} className="rounded-card border border-hairline bg-panel p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-tag border-1.5 px-2 py-1 font-mono text-eyebrow font-semibold uppercase ${tag.className}`}
              >
                <tag.icon size={16} strokeWidth={2} aria-hidden />
                {ALERT_CLASS_LABELS[alertClass]}
              </span>
              <span
                className={`rounded-tag px-2 py-1 font-mono text-eyebrow font-semibold uppercase ${LEVEL_BLOCK[alert.level]}`}
              >
                {LEVEL_TEXT[alert.level]}
              </span>
            </div>
            <h3 className="mt-2 font-display text-title font-bold text-fg">
              {alert.issue === 'unknown' ? 'Crop problem' : ISSUE_LABELS[alert.issue]}
            </h3>
            <p className="eyebrow mt-0.5">
              {alert.district} · {shortDate(alert.created_at)}
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {alert.contributing_factors.map(factor => (
                <li key={factor} className="flex gap-2 text-body">
                  <span aria-hidden className="mt-[11px] h-1.5 w-1.5 shrink-0 bg-attention" />
                  {factor}
                </li>
              ))}
            </ul>
            <p className="mt-2 border-t border-hairline pt-2 text-label font-semibold text-fg-2">
              {alertUncertainty(alertClass, {
                verified: alert.verified_reports ?? 0,
                reports: alert.observation_ids.length,
              })}
            </p>
          </article>
        )
      })}

      {district && push === 'off' && (
        <button type="button" onClick={onEnablePush} className="btn-quiet w-full">
          <Bell size={20} strokeWidth={2} aria-hidden />
          Send alerts for {district} to this phone
        </button>
      )}
      {district && push === 'on' && (
        <p className="flex items-center gap-2 text-label font-semibold text-signal-text">
          <BellRing size={20} strokeWidth={2} aria-hidden />
          Alerts for {district} come to this phone
        </p>
      )}
      {push === 'blocked' && (
        <p className="flex items-center gap-2 text-label font-semibold text-fg-2">
          <BellOff size={20} strokeWidth={2} aria-hidden />
          Alerts are blocked. Allow notifications for Phytos in your phone settings.
        </p>
      )}
    </section>
  )
}
