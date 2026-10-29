import { ChevronRight } from 'lucide-react'
import { alertUncertainty, ISSUE_LABELS } from '@repo/shared'
import type { DashAlert } from '../hooks/useLive'
import { hrefFor } from '../hooks/useRoute'
import { ago } from '../lib/copy'
import { AlertClassTag } from './AlertClassTag'
import { LevelTag } from './LevelTag'

// One alert: what it rests on (class), the level with its factors, and how sure it is.
export function AlertCard({ alert, compact = false }: { alert: DashAlert; compact?: boolean }) {
  const factors = compact ? alert.factors.slice(0, 1) : alert.factors
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <AlertClassTag alertClass={alert.alertClass} />
        <LevelTag level={alert.level} />
        {alert.sim && (
          <span className="font-mono text-eyebrow font-semibold uppercase text-copper-deep">
            Demo
          </span>
        )}
        <span className="ml-auto font-mono text-eyebrow text-ink-2">{ago(alert.createdAt)}</span>
      </div>
      <p className="mt-1.5 font-display text-[17px] font-semibold leading-snug text-navy">
        {alert.issue === 'unknown' ? 'Crop problem' : ISSUE_LABELS[alert.issue]} · {alert.district}
      </p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {factors.map(f => (
          <li key={f} className="flex gap-2 text-label">
            <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 bg-copper" />
            {f}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-caption font-semibold text-ink-2">
        {alertUncertainty(alert.alertClass, {
          verified: alert.verifiedReports ?? 0,
          reports: alert.observationIds.length,
        })}
      </p>
    </>
  )
  return alert.clusterId ? (
    <a
      href={hrefFor({ page: 'outbreak', id: alert.clusterId })}
      className="group block rounded-card border border-line bg-sheet p-3 transition-colors hover:border-navy"
    >
      {body}
      <span className="mt-1 inline-flex items-center gap-0.5 text-caption font-semibold text-navy group-hover:underline">
        Outbreak detail
        <ChevronRight size={14} strokeWidth={2} aria-hidden />
      </span>
    </a>
  ) : (
    <div className="rounded-card border border-line bg-sheet p-3">{body}</div>
  )
}
