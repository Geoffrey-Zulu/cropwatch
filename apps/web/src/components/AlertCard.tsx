import { ChevronRight } from 'lucide-react'
import { alertUncertainty, ISSUE_LABELS } from '@repo/shared'
import type { DashAlert } from '../hooks/useLive'
import { hrefFor } from '../hooks/useRoute'
import { ago, uncertaintyShort } from '../lib/copy'
import { AlertClassTag } from './AlertClassTag'
import { LevelTag } from './LevelTag'

const issueName = (alert: DashAlert) =>
  alert.issue === 'unknown' ? 'Crop problem' : ISSUE_LABELS[alert.issue]

// Rows drop the common name in brackets ("Tuta absoluta (tomato leafminer)"); hover has it all.
const shortIssueName = (alert: DashAlert) => issueName(alert).replace(/ \(.*\)$/, '')

const uncertaintyOf = (alert: DashAlert) => ({
  verified: alert.verifiedReports ?? 0,
  reports: alert.observationIds.length,
})

// One alert in full: what it rests on (class), the level with its factors, and how sure it is.
export function AlertCard({ alert }: { alert: DashAlert }) {
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <AlertClassTag alertClass={alert.alertClass} />
        <LevelTag level={alert.level} />
        {alert.sim && (
          <span className="font-mono text-eyebrow font-semibold uppercase text-attention-text">
            Demo
          </span>
        )}
        <span className="meta ml-auto">{ago(alert.createdAt)}</span>
      </div>
      <p className="mt-2 font-display text-[17px] font-semibold leading-snug text-fg">
        {issueName(alert)} · {alert.district}
      </p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {alert.factors.map(f => (
          <li key={f} className="flex gap-2 text-label text-fg">
            <span aria-hidden className="mt-[8px] h-1 w-1 shrink-0 bg-attention" />
            {f}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-caption font-semibold text-fg-2">
        {alertUncertainty(alert.alertClass, uncertaintyOf(alert))}
      </p>
    </>
  )
  return alert.clusterId ? (
    <a
      href={hrefFor({ page: 'outbreak', id: alert.clusterId })}
      className="group block rounded-card border border-hairline bg-panel p-4 transition-colors hover:border-hairline-strong"
    >
      {body}
      <span className="mt-2 inline-flex items-center gap-0.5 text-label font-semibold text-fg group-hover:underline">
        Outbreak detail
        <ChevronRight size={14} strokeWidth={2} aria-hidden />
      </span>
    </a>
  ) : (
    <div className="rounded-card border border-hairline bg-panel p-4">{body}</div>
  )
}

// Alerts as signal rows: class, level, issue and district, the first factor in full (wrapped,
// never cut), how sure it is (the full uncertainty sentence on hover and on the outbreak
// detail), age, link.
// Pass rows to the page's DemoBadge: a row does not repeat it.
export function AlertRows({ alerts }: { alerts: DashAlert[] }) {
  return (
    <div className="-mx-6 overflow-x-auto px-6">
      <table className="w-full border-collapse text-label">
        <thead className="sr-only">
          <tr>
            <th>Class</th>
            <th>Level</th>
            <th>Issue and district</th>
            <th>Reason</th>
            <th>Verification</th>
            <th>Age</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map(alert => (
            <tr
              key={alert.id}
              className="border-t border-hairline first:border-t-0 [&>td]:whitespace-nowrap [&>td]:py-3 [&>td]:pr-4 [&>td]:align-top"
            >
              <td>
                <AlertClassTag alertClass={alert.alertClass} />
              </td>
              <td>
                <LevelTag level={alert.level} />
              </td>
              <td
                className="font-semibold text-fg"
                title={`${issueName(alert)} · ${alert.district}${alert.sim ? ' (simulated)' : ''}`}
              >
                {shortIssueName(alert)} · {alert.district}
              </td>
              <td className="w-full min-w-[16rem] !whitespace-normal text-fg-2">
                {alert.factors[0]}
              </td>
              <td className="meta" title={alertUncertainty(alert.alertClass, uncertaintyOf(alert))}>
                {uncertaintyShort(alert.alertClass, uncertaintyOf(alert))}
              </td>
              <td className="meta">{ago(alert.createdAt)}</td>
              <td className="!pr-0 text-right">
                {alert.clusterId && (
                  <a
                    href={hrefFor({ page: 'outbreak', id: alert.clusterId })}
                    className="inline-flex items-center gap-0.5 text-label font-semibold text-fg hover:text-signal-text"
                  >
                    Detail
                    <ChevronRight size={14} strokeWidth={2} aria-hidden />
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
