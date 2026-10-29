import { ListChecks, Lock } from 'lucide-react'
import { useState } from 'react'
import { CROP_LABELS, type OutgrowerOverview, type Visit, type VisitReason } from '@repo/shared'
import { DemoBadge } from '../components/DemoBadge'
import { LevelDot } from '../components/LevelTag'
import { Figure, Figures, Muted, Panel } from '../components/Panel'
import type { Officer } from '../hooks/useAuth'
import { ago } from '../lib/copy'
import { trpc } from '../lib/trpc'

// The seeded outgrower (tools/seed): the org a Command Center officer sees here.
const DEMO_ORG_ID = 'demo-outgrower'

const PRIORITY = {
  1: { label: 'Visit first', className: 'border-signal-text text-signal-text' },
  2: { label: 'This week', className: 'border-attention text-attention-text' },
  3: { label: 'When nearby', className: 'border-hairline-strong text-fg-2' },
} as const

// At most two chips a row (patterns.md): the priority, then the top reason if it is one of
// these. Severity is a dot and a word; everything else folds into the row's one reason line.
const REASON_CHIP: Partial<Record<VisitReason, { label: string; className: string }>> = {
  cluster: { label: 'Cluster', className: 'border-attention text-attention-text' },
  awaiting_review: { label: 'Awaiting review', className: 'border-hairline-strong text-fg' },
}
const CHIP_ORDER: VisitReason[] = ['cluster', 'awaiting_review']

const SEVERITY_DOT: Partial<Record<VisitReason, { word: string; dot: string }>> = {
  severe: { word: 'Severe damage', dot: 'bg-high' },
  moderate: { word: 'Moderate damage', dot: 'bg-attention' },
}

function reasonParts(v: Visit) {
  const codes = v.reason_codes ?? []
  const chip = CHIP_ORDER.find(code => codes.includes(code)) ?? null
  const severity = codes.map(code => SEVERITY_DOT[code]).find(Boolean) ?? null
  const rest = codes.flatMap(code =>
    code === chip || SEVERITY_DOT[code]
      ? []
      : code === 'high_district'
        ? [`${v.district} at High`]
        : code === 'awaiting_review'
          ? ['Waiting for an officer']
          : code === 'cluster'
            ? ['In an active cluster']
            : []
  )
  return { chip, severity, rest }
}

// Outgrower View: what an outgrower company needs to send its field officers to the right
// farms. Camp and district level only: no farm locations (CLAUDE.md invariant 6). The API
// builds it from the org's reports; the browser never reads them.
export function OutgrowerViewPage({ officer }: { officer: Officer }) {
  const orgId = officer.commandCenter ? DEMO_ORG_ID : officer.orgId
  const overview = trpc.outgrower.overview.useQuery(
    { orgId: orgId ?? '' },
    { enabled: Boolean(orgId), refetchInterval: 60_000 }
  )
  if (!orgId) return <Muted>This account is not linked to an outgrower.</Muted>
  if (overview.isLoading) return <Muted>Building the view…</Muted>
  if (overview.error || !overview.data)
    return <Muted>The view could not be built ({overview.error?.message ?? 'no data'}).</Muted>
  return <Overview data={overview.data} />
}

function Overview({ data }: { data: OutgrowerOverview }) {
  const [prioritised, setPrioritised] = useState(false)
  const [allCamps, setAllCamps] = useState(false)
  const camps = allCamps ? data.camps : data.camps.slice(0, 8)
  const visits = data.officers.reduce((n, o) => n + o.visits.length, 0) + data.unassigned.length
  const rows = [{ sim: data.sim }, ...data.officers.flatMap(o => o.visits), ...data.unassigned]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Outgrower View · last {data.window_days} days</p>
          <h1 className="mt-1 font-display text-display-xl font-bold text-fg">{data.name}</h1>
        </div>
        <DemoBadge rows={rows} />
      </div>
      <p className="flex items-center gap-2 text-label text-fg-2">
        <Lock size={16} strokeWidth={2} aria-hidden />
        Camp and district level only. No farm locations are shown in this view.
      </p>

      <Figures>
        <Figure
          value={data.enrolled_farmers.toLocaleString('en-GB')}
          label="enrolled farmers in the scheme"
        />
        <Figure value={data.reports} label="reports from members, last 14 days" />
        <Figure value={data.verified_reports} label="verified by an officer" />
        <Figure
          value={data.top_issue ? data.top_issue.issue_label : 'None'}
          label={
            data.top_issue
              ? `top emerging issue: ${data.top_issue.this_week} this week, ${data.top_issue.last_week} the week before`
              : 'top emerging issue'
          }
        />
      </Figures>

      <Panel eyebrow="Where to look" title="Camps needing attention">
        {data.camps.length === 0 ? (
          <Muted>No reports from member farms in this window.</Muted>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-label">
              <thead>
                <tr className="border-b border-hairline">
                  {[
                    'Camp',
                    'District signal',
                    'Reports',
                    'Top issue',
                    'Damage reported',
                    'In a cluster',
                    'With an officer',
                  ].map(h => (
                    <th key={h} className="th py-2 pr-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {camps.map(c => (
                  <tr key={c.camp} className="border-b border-hairline last:border-b-0">
                    <td className="py-2 pr-3">
                      <span className="font-semibold text-fg">{c.camp}</span>
                      {c.attention && (
                        <span className="chip ml-2 border-attention text-attention-text">
                          Attention
                        </span>
                      )}
                      <span className="block text-caption text-fg-2">{c.district}</span>
                    </td>
                    <td className="py-2 pr-3">
                      {c.district_level ? <LevelDot level={c.district_level} /> : 'None'}
                    </td>
                    <td className="py-2 pr-3 font-mono">{c.reports}</td>
                    <td className="py-2 pr-3">{c.top_issue_label ?? 'Not identified'}</td>
                    <td className="py-2 pr-3 font-mono">{c.damaged}</td>
                    <td className="py-2 pr-3 font-mono">{c.in_cluster}</td>
                    <td className="py-2 pr-3 font-mono">{c.awaiting_review}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.camps.length > camps.length && (
              <button type="button" className="btn-quiet mt-2" onClick={() => setAllCamps(true)}>
                Show all {data.camps.length} camps
              </button>
            )}
          </div>
        )}
      </Panel>

      <Panel
        eyebrow="Field team"
        title="Visit lists"
        actions={
          <button
            type="button"
            className="btn-primary"
            aria-expanded={prioritised}
            onClick={() => setPrioritised(true)}
          >
            <ListChecks size={18} strokeWidth={2} aria-hidden />
            Prioritise field officers
          </button>
        }
      >
        {!prioritised ? (
          <Muted>
            {visits} farm visits suggested across {data.officers.length} field officers. Prioritise
            to see each officer's list, most urgent first.
          </Muted>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {data.officers.map(o => (
              <OfficerList
                key={o.officer_id}
                title={o.label}
                district={o.district}
                visits={o.visits}
              />
            ))}
            {data.unassigned.length > 0 && (
              <OfficerList
                title="No field officer in district"
                district="Unassigned"
                visits={data.unassigned}
              />
            )}
          </div>
        )}
        <p className="mt-3 text-caption text-fg-2">
          Priority is an ordering from the reasons shown (cluster membership, damage reported,
          officer review, district signal), not a likelihood. Loan-exposure and credit views are on
          the roadmap only; they are not built.
        </p>
      </Panel>
    </div>
  )
}

function OfficerList({
  title,
  district,
  visits,
}: {
  title: string
  district: string
  visits: Visit[]
}) {
  // Visit first and this week lead; the rest fold away until asked for.
  const urgent = visits.filter(v => v.priority < 3)
  const nearby = visits.filter(v => v.priority === 3)
  return (
    <section className="rounded-card border border-hairline bg-ground p-4">
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="font-display text-[17px] font-semibold text-fg">{title}</h3>
        <span className="meta">
          {district} · {visits.length} visits
        </span>
      </header>
      {visits.length === 0 ? (
        <Muted>No visits needed.</Muted>
      ) : (
        <>
          <VisitItems visits={urgent} start={1} />
          {nearby.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer py-2 text-label font-medium text-fg-2 hover:text-fg">
                {nearby.length} more when nearby
              </summary>
              <VisitItems visits={nearby} start={urgent.length + 1} />
            </details>
          )}
        </>
      )}
    </section>
  )
}

function VisitItems({ visits, start }: { visits: Visit[]; start: number }) {
  return (
    <ol className="flex flex-col divide-y divide-hairline">
      {visits.map((v, i) => {
        const { chip, severity, rest } = reasonParts(v)
        const chipStyle = chip ? REASON_CHIP[chip] : undefined
        return (
          <li key={`${v.report_number}-${v.farm_label}`} className="py-3">
            <div className="flex items-start gap-2">
              <span className="w-5 shrink-0 pt-0.5 font-mono text-caption text-fg-2">
                {start + i}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-fg">{v.farm_label}</span>
                  <span className={`chip ${PRIORITY[v.priority].className}`}>
                    {PRIORITY[v.priority].label}
                  </span>
                  {chipStyle && (
                    <span className={`chip ${chipStyle.className}`}>{chipStyle.label}</span>
                  )}
                  <span className="meta ml-auto">{ago(v.last_report_at)}</span>
                </div>
                {/* One secondary line: where, what, and every reason left after the chips. */}
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-label text-fg-2">
                  <span>
                    {v.camp} · {CROP_LABELS[v.crop]} · {v.issue_label}
                  </span>
                  {severity && (
                    <>
                      <span aria-hidden>·</span>
                      <span aria-hidden className={`h-2 w-2 rounded-full ${severity.dot}`} />
                      <span className="text-fg">{severity.word}</span>
                    </>
                  )}
                  {rest.map(r => (
                    <span key={r}>· {r}</span>
                  ))}
                  {!v.reason_codes && <span>· {v.reasons.join(' · ')}</span>}
                </p>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
