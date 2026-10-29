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
        <h2 id="my-reports" className="font-display text-display font-bold text-fg">
          My reports
        </h2>
        {reports && <DemoBadge rows={reports} />}
      </div>

      {reports === null && <p className="text-body text-fg-2">Loading your reports…</p>}

      {reports?.length === 0 && (
        <div className="flex gap-3 rounded-card border-1.5 border-dashed border-hairline-strong p-4">
          <ClipboardList size={24} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0" />
          <p className="text-body">
            No reports yet. Photograph a sick crop and your report, with advice, will be kept here.
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {reports?.map(report => (
          <li key={report.id}>
            <a
              href={`#/report/${report.id}`}
              className="flex items-center gap-3 rounded-card border border-hairline bg-panel p-3 transition-colors duration-150 active:bg-well"
            >
              <div className="min-w-0 flex-1">
                <p className="eyebrow">
                  Report {reportNumber(report.id)} · {shortDate(report.createdAt)} ·{' '}
                  {report.district}
                </p>
                <p className="mt-1 truncate text-body font-extrabold">
                  {CROP_LABELS[report.crop]}
                  {report.issue && report.issue !== 'unknown'
                    ? ` · ${ISSUE_LABELS[report.issue]}`
                    : ''}
                </p>
                <div className="mt-2">
                  <StatusTag status={report.status} />
                </div>
              </div>
              <ChevronRight size={24} strokeWidth={2} aria-hidden className="shrink-0 text-fg" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
