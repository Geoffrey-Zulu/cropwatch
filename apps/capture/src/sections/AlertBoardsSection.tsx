import { Bell, BellOff, BellRing } from 'lucide-react'
import { ISSUE_LABELS } from '@repo/shared'
import { DemoBadge } from '../components/DemoBadge'
import type { AreaAlert } from '../hooks/useAreaAlerts'
import type { PushState } from '../hooks/usePush'
import { LEVEL_TEXT, shortDate } from '../lib/copy'

const BOARD = {
  HIGH: 'bg-laterite text-slip',
  ELEVATED: 'bg-maize text-ink',
  LOW: 'bg-slip text-ink',
} as const

// Area alerts as painted boards. A level never appears without its contributing factors
// (invariant 2).
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
        <h2 id="area-alerts" className="font-display text-display font-extrabold uppercase">
          Near you
        </h2>
        {alerts && <DemoBadge rows={alerts} />}
      </div>

      {!district && (
        <p className="text-body text-ink-2">
          Send your first report and we will show crop alerts for your district here.
        </p>
      )}

      {district && alerts?.length === 0 && (
        <p className="text-body">
          No crop outbreaks reported around <strong className="font-extrabold">{district}</strong>{' '}
          right now.
        </p>
      )}

      {alerts?.map(alert => (
        <article
          key={alert.id}
          className={`rounded-slip border-2 border-ink p-4 shadow-sign ${BOARD[alert.level]}`}
        >
          <p className="font-mono text-eyebrow font-semibold uppercase">
            {LEVEL_TEXT[alert.level]} · {alert.district} · {shortDate(alert.created_at)}
          </p>
          <h3 className="mt-1 font-display text-display font-extrabold uppercase">
            {alert.issue === 'unknown' ? 'Crop problem' : ISSUE_LABELS[alert.issue]}
          </h3>
          <ul className="mt-2 flex flex-col gap-1">
            {alert.contributing_factors.map(factor => (
              <li key={factor} className="flex gap-2 text-body font-semibold">
                <span aria-hidden className="mt-[11px] h-1.5 w-1.5 shrink-0 bg-current" />
                {factor}
              </li>
            ))}
          </ul>
        </article>
      ))}

      {district && push === 'off' && (
        <button type="button" onClick={onEnablePush} className="btn-quiet w-full">
          <Bell size={20} strokeWidth={2.25} aria-hidden />
          Send alerts for {district} to this phone
        </button>
      )}
      {district && push === 'on' && (
        <p className="flex items-center gap-2 text-label font-semibold text-leaf">
          <BellRing size={20} strokeWidth={2.25} aria-hidden />
          Alerts for {district} come to this phone
        </p>
      )}
      {push === 'blocked' && (
        <p className="flex items-center gap-2 text-label font-semibold text-ink-2">
          <BellOff size={20} strokeWidth={2.25} aria-hidden />
          Alerts are blocked. Allow notifications for CropWatch in your phone settings.
        </p>
      )}
    </section>
  )
}
