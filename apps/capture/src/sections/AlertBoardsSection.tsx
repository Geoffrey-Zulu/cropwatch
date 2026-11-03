import {
  Activity,
  BadgeCheck,
  Bell,
  BellOff,
  BellRing,
  CloudSun,
  Info,
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

// The level as on A's map key: a swatch (brick solid, maize hatched, fallow field) and its word.
const LEVEL_WORD = {
  HIGH: { text: 'text-high-text', swatch: 'sw-high' },
  ELEVATED: { text: 'text-attention-text', swatch: 'sw-elev' },
  LOW: { text: 'text-fg-2', swatch: 'sw-low' },
} as const

// Solid means verified (in field green); dashed means modelled or forecast only (MASTER.md §2).
const CLASS_TAG: Record<AlertClass, { icon: LucideIcon; className: string }> = {
  weather_advisory: { icon: CloudSun, className: 'border-dashed border-hairline-strong text-fg-2' },
  verified_cluster: {
    icon: BadgeCheck,
    className: 'border-transparent bg-signal-tint text-signal-text',
  },
  model_risk_signal: {
    icon: Activity,
    className: 'border-dashed border-attention-stripe text-attention-text',
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
        <h2 id="area-alerts" className="font-display text-display font-semibold text-fg">
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
        <p className="rounded-card bg-panel p-5 text-body shadow-island-sm">
          No crop outbreaks reported around <strong className="font-bold">{district}</strong> right
          now.
        </p>
      )}

      {alerts?.map(alert => {
        const alertClass = alertClassOf(alert)
        const tag = CLASS_TAG[alertClass]
        const level = LEVEL_WORD[alert.level]
        return (
          <article key={alert.id} className="island p-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-tag border-1.5 py-1 pl-2 pr-3 text-[14px] font-semibold leading-5 ${tag.className}`}
              >
                <tag.icon size={16} strokeWidth={2} aria-hidden />
                {ALERT_CLASS_LABELS[alertClass]}
              </span>
              <span
                className={`ml-auto inline-flex items-center gap-1.5 whitespace-nowrap text-[15px] font-bold leading-5 ${level.text}`}
              >
                <span aria-hidden className={`sw ${level.swatch}`} />
                {LEVEL_TEXT[alert.level]}
              </span>
            </div>
            <h3 className="mt-3 font-display text-title font-semibold text-fg">
              {alert.issue === 'unknown' ? 'Crop problem' : ISSUE_LABELS[alert.issue]}
            </h3>
            <p className="mt-1 text-label text-fg-2">
              {alert.district} · {shortDate(alert.created_at)}
            </p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {alert.contributing_factors.map(factor => (
                <li key={factor} className="flex gap-2.5 text-body">
                  <span
                    aria-hidden
                    className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-leaf"
                  />
                  {factor}
                </li>
              ))}
            </ul>
            {/* How sure, in words: A's honest line. */}
            <p className="mt-3 flex gap-2 border-t border-hairline pt-3 text-label font-semibold text-fg-2">
              <Info size={17} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                {alertUncertainty(alertClass, {
                  verified: alert.verified_reports ?? 0,
                  reports: alert.observation_ids.length,
                })}
              </span>
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
