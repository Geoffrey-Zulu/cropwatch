import type { ReactNode } from 'react'
import { CROP_LABELS, ISSUE_LABELS, withoutEmDash } from '@repo/shared'
import type { DashCluster, DashObservation } from '../hooks/useLive'
import { useDrawerLinks } from '../hooks/useRoute'
import { dateTime, REVIEW_REASON_TEXT, SEVERITY_TEXT } from '../lib/copy'
import { stageRowFor } from '../lib/scenario'

const DAY = 86_400_000

// The report detail reads in labelled blocks (polish 30 Oct): Photo · Assessment · Advice ·
// Evidence, the key facts as a grid above them. Used by the full report drawer and the queue.
export function DetailBlock({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <section aria-label={label} className={`border-t border-hairline pt-3 ${className}`}>
      <h3 className="mb-2 text-caption font-semibold text-fg-2">{label}</h3>
      {children}
    </section>
  )
}

// A definition grid, two columns unless told otherwise; an entry with `wide` takes two.
export function Facts({
  facts,
  columns = 'grid-cols-2',
}: {
  facts: { label: string; value: ReactNode; wide?: boolean }[]
  columns?: string
}) {
  return (
    <dl className={`grid gap-x-6 gap-y-3 text-label ${columns}`}>
      {facts.map(f => (
        <div key={f.label} className={`min-w-0 ${f.wide ? 'col-span-2' : ''}`}>
          <dt className="text-caption text-fg-2">{f.label}</dt>
          <dd className="text-fg">{f.value}</dd>
        </div>
      ))}
    </dl>
  )
}

// The crop stage on the day of the report, from the planting date the farmer gave.
export function stageText(o: Pick<DashObservation, 'crop' | 'createdAt' | 'plantingDate'>) {
  if (!o.plantingDate) return 'Not recorded'
  const days = Math.floor((Date.parse(o.createdAt) - Date.parse(o.plantingDate)) / DAY)
  if (days < 0) return 'Not recorded'
  const row = stageRowFor(o.crop, days)
  return row ? `${row.stage} · day ${days}` : `Day ${days} after planting`
}

// Crop / District / Sent / Stage, then where it is (Command Center only) and the farmer's words.
export function ReportFacts({
  observation: o,
  cluster = null,
  full = false,
  columns,
}: {
  observation: DashObservation
  cluster?: DashCluster | null
  // The drawer adds the precise point, the reporter and the cluster.
  full?: boolean
  columns?: string
}) {
  const { open } = useDrawerLinks()
  return (
    <Facts
      columns={columns}
      facts={[
        { label: 'Crop', value: CROP_LABELS[o.crop] },
        {
          label: 'District',
          value: (
            <>
              {o.district}
              {o.camp && <span className="block text-caption text-fg-2">{o.camp}</span>}
            </>
          ),
        },
        { label: 'Sent', value: dateTime(o.createdAt) },
        { label: 'Stage', value: stageText(o) },
        ...(full
          ? [
              {
                label: 'Reporter',
                value: o.reporterRole === 'field_officer' ? 'Field officer' : 'Farmer',
              },
              {
                label: 'Precise point',
                value: (
                  <>
                    <span className="font-mono">
                      {o.location.latitude.toFixed(4)}, {o.location.longitude.toFixed(4)}
                    </span>
                    <span className="block text-caption text-fg-2">Command Center only</span>
                  </>
                ),
              },
            ]
          : []),
        ...(full && cluster
          ? [
              {
                label: 'Cluster',
                wide: true,
                value: (
                  <a
                    href={open({ kind: 'outbreak', id: cluster.id })}
                    className="font-semibold text-signal-text hover:underline"
                  >
                    {cluster.size} {ISSUE_LABELS[cluster.issue]} reports near {cluster.district}
                  </a>
                ),
              },
            ]
          : []),
        ...(o.description
          ? [{ label: 'Farmer says', wide: true, value: `"${o.description}"` }]
          : []),
      ]}
    />
  )
}

// The AI assessment in words: issue, confidence band, damage, why it was routed, what it saw.
export function AssessmentFacts({ observation: o }: { observation: DashObservation }) {
  if (!o.band) return <p className="text-label text-fg-2">Not assessed yet.</p>
  return (
    <Facts
      facts={[
        {
          label: 'Issue',
          wide: true,
          value: (
            <span className="font-semibold">
              {o.suspectedIssue && o.suspectedIssue !== 'unknown'
                ? ISSUE_LABELS[o.suspectedIssue]
                : 'Not identified'}
            </span>
          ),
        },
        {
          label: 'AI assessment',
          value: `${o.band.charAt(0).toUpperCase()}${o.band.slice(1)} confidence`,
        },
        { label: 'Damage', value: o.severity ? SEVERITY_TEXT[o.severity] : 'Not recorded' },
        ...(o.needsReview && o.reviewReason
          ? [
              {
                label: 'Routed to an officer',
                wide: true,
                value: REVIEW_REASON_TEXT[o.reviewReason],
              },
            ]
          : []),
        ...(o.symptoms.length
          ? [
              {
                label: 'What it saw',
                wide: true,
                value: (
                  <ul className="flex list-disc flex-col gap-0.5 pl-4">
                    {o.symptoms.map(s => (
                      <li key={s}>{withoutEmDash(s)}</li>
                    ))}
                  </ul>
                ),
              },
            ]
          : []),
      ]}
    />
  )
}
