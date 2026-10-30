import { ChevronRight } from 'lucide-react'
import { ALERT_CLASS_LABELS, alertUncertainty, ISSUE_LABELS, type RiskLevel } from '@repo/shared'
import type { DashAlert } from '../hooks/useLive'
import { useDrawerLinks } from '../hooks/useRoute'
import { markAlertSeen } from '../hooks/useSeenAlerts'
import { ago, LEVEL_TEXT, uncertaintyShort } from '../lib/copy'
import { DemoBadge } from './DemoBadge'
import { Drawer } from './Drawer'
import { LevelIcon } from './LevelTag'
import { Disclosure } from './PageHeader'
import { SkeletonRows } from './Skeleton'

const LEVEL_WORD: Record<RiskLevel, string> = {
  HIGH: 'text-high-text',
  ELEVATED: 'text-attention-text',
  LOW: 'text-fg-2',
}

const uncertaintyOf = (alert: DashAlert) => ({
  verified: alert.verifiedReports ?? 0,
  reports: alert.observationIds.length,
})

// The alerts, behind the header bell (patterns-v2.md decision 7, after Grafana's alert list):
// grouped by level with counts, newest first; Low only on request. A row is what and where and
// when, then level, class and how sure, then the first factor in full. Opening a row shows the
// outbreak in this drawer, with a way back.
export function AlertsDrawer({ alerts }: { alerts: DashAlert[] | null }) {
  const { close } = useDrawerLinks()
  const sorted = [...(alerts ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const group = (level: RiskLevel) => sorted.filter(a => a.level === level)
  return (
    <Drawer title="Alerts" aside={<DemoBadge rows={alerts ?? []} />} closeHref={close()}>
      {alerts === null && <SkeletonRows rows={6} label="Loading alerts" />}
      {alerts && alerts.length === 0 && <p className="py-6 text-label text-fg-2">No alerts.</p>}
      {(['HIGH', 'ELEVATED'] as const).map(level =>
        group(level).length ? (
          <section key={level} className="mb-5" aria-label={`${LEVEL_TEXT[level]} alerts`}>
            <h3 className="mb-1 text-section font-semibold text-fg">
              {LEVEL_TEXT[level]}{' '}
              <span className="font-normal text-fg-2">· {group(level).length}</span>
            </h3>
            <AlertList alerts={group(level)} />
          </section>
        ) : null
      )}
      {group('LOW').length > 0 && (
        <Disclosure summary="Show low" hint={group('LOW').length}>
          <AlertList alerts={group('LOW')} />
        </Disclosure>
      )}
    </Drawer>
  )
}

function AlertList({ alerts }: { alerts: DashAlert[] }) {
  const { open } = useDrawerLinks()
  return (
    <ul className="-mx-2 flex flex-col">
      {alerts.map(alert => {
        const body = (
          <>
            <span className="flex items-center gap-2">
              <LevelIcon level={alert.level} />
              <span className="min-w-0 flex-1 font-medium text-fg">
                {alert.issue === 'unknown' ? 'Crop problem' : ISSUE_LABELS[alert.issue]} ·{' '}
                {alert.district}
              </span>
              <span className="meta shrink-0">{ago(alert.createdAt)}</span>
            </span>
            <span className="mt-0.5 block pl-6 text-caption text-fg-2">
              <span className={`font-medium ${LEVEL_WORD[alert.level]}`}>
                {LEVEL_TEXT[alert.level]}
              </span>{' '}
              · {ALERT_CLASS_LABELS[alert.alertClass]} ·{' '}
              {uncertaintyShort(alert.alertClass, uncertaintyOf(alert))}
            </span>
            <span className="mt-0.5 block pl-6 text-caption text-fg-2">{alert.factors[0]}</span>
          </>
        )
        const title = alertUncertainty(alert.alertClass, uncertaintyOf(alert))
        return (
          <li key={alert.id}>
            {alert.clusterId ? (
              <a
                href={open({ kind: 'outbreak', id: alert.clusterId, via: 'alerts' })}
                title={title}
                onClick={() => markAlertSeen(alert.id)}
                className="block rounded-card px-2 py-2.5 hover:bg-well"
              >
                {body}
              </a>
            ) : (
              <details className="group rounded-card px-2 py-2.5 hover:bg-well">
                <summary
                  title={title}
                  onClick={() => markAlertSeen(alert.id)}
                  className="cursor-pointer list-none [&::-webkit-details-marker]:hidden"
                >
                  {body}
                </summary>
                <div className="mt-2 flex flex-col gap-1 pl-6 text-caption">
                  {alert.factors.slice(1).map(f => (
                    <p key={f} className="text-fg">
                      {f}
                    </p>
                  ))}
                  <p className="text-fg-2">{title}</p>
                  <p className="inline-flex items-center gap-1 text-fg-2">
                    <ChevronRight size={16} aria-hidden />
                    {alert.alertClass === 'weather_advisory'
                      ? 'No outbreak: forecast conditions only.'
                      : 'A district signal, not a single outbreak.'}
                  </p>
                </div>
              </details>
            )}
          </li>
        )
      })}
    </ul>
  )
}
