import { ChevronRight, ClipboardList } from 'lucide-react'
import { CROP_LABELS, ISSUE_LABELS } from '@repo/shared'
import { StatusTag } from '../components/StatusTag'
import { DemoBadge } from '../components/DemoBadge'
import type { ReportSummary } from '../hooks/useMyReports'
import { shortDate } from '../lib/copy'
import { reportNumber } from '../lib/report'

export function MyReportsSection({ reports }: { reports: ReportSummary[] | null }) {
  return (
    <section aria-labelledby="my-reports" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <h2 id="my-reports" className="font-display text-display font-semibold text-fg">
          My reports
        </h2>
        {reports && <DemoBadge rows={reports} />}
      </div>

      {reports === null && (
        <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only">Loading your reports</span>
          {[0, 1, 2].map(row => (
            <div key={row} className="report-skeleton" aria-hidden>
              <span className="skeleton-line skeleton-line--short" />
              <span className="skeleton-line skeleton-line--long" />
              <span className="skeleton-line skeleton-line--medium" />
            </div>
          ))}
        </div>
      )}

      {reports?.length === 0 && (
        <div className="flex gap-3 rounded-card bg-panel p-5 shadow-island-sm">
          <ClipboardList
            size={24}
            strokeWidth={2}
            aria-hidden
            className="mt-0.5 shrink-0 text-signal-text"
          />
          <p className="text-body">
            No reports yet. Photograph a sick crop and your report, with advice, will be kept here.
          </p>
        </div>
      )}

      {/* One island, a ruled row per report, as A's watch list. */}
      <ul className="island flex flex-col divide-y divide-hairline p-1.5 empty:hidden">
        {reports?.map(report => (
          <li key={report.id}>
            <a
              href={`#/report/${report.id}`}
              className="flex items-center gap-3 rounded-inner px-3.5 py-3 transition-colors duration-300 ease-out hover:bg-[var(--hover)] active:bg-well"
            >
              <div className="min-w-0 flex-1">
                <p className="text-label text-fg-2">
                  Report <span className="font-mono">{reportNumber(report.id)}</span> ·{' '}
                  {shortDate(report.createdAt)} · {report.district}
                </p>
                <p className="mt-0.5 text-body font-bold">
                  {CROP_LABELS[report.crop]}
                  {report.issue && report.issue !== 'unknown'
                    ? ` · ${ISSUE_LABELS[report.issue]}`
                    : ''}
                </p>
                <div className="mt-2">
                  <StatusTag status={report.status} />
                </div>
              </div>
              <ChevronRight size={22} strokeWidth={2} aria-hidden className="shrink-0 text-fg-2" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
