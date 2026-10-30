import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CROP_LABELS, WEATHER_SOURCE } from '@repo/shared'
import { DemoBadge } from '../components/DemoBadge'
import { Disclosure, PageHeader } from '../components/PageHeader'
import { Bar, Loading, SkeletonRows } from '../components/Skeleton'
import { SkeletonStatCards, StatCards } from '../components/StatCards'
import type { DashObservation } from '../hooks/useLive'
import { useNow } from '../hooks/useNow'
import { ISSUE_SHORT } from '../lib/copy'
import { fetchRainOutlook } from '../lib/rainOutlook'
import {
  campScenarios,
  DRY_THRESHOLD_MM,
  RULES,
  SCENARIO_WINDOW_DAYS,
  STAGE_TABLE,
  UNKNOWN_STAGE_NOTE,
  type Band,
  type CampScenario,
  type Concern,
} from '../lib/scenario'

// The camps shown before "more" (patterns-v2.md decision 4).
const FIRST = 10

// The band is the group a camp sits in; only "closer monitoring" is shown by default.
const BAND: Record<Band, { label: string; className: string }> = {
  closer: { label: 'Closer monitoring', className: 'text-high-text' },
  watch: { label: 'Watch', className: 'text-attention-text' },
  routine: { label: 'Routine', className: 'text-fg-2' },
}

// Scenario: "If the next 14 days turn dry, which camps need closer monitoring?"
// Real Open-Meteo forecast (or one canned dry spell) × the crop-stage table × verified reports,
// every assumption on the page, the answer an ordering of camps with reasons. No free text, no
// yields. Behind VITE_FEATURE_SCENARIO; it reads only the browser's live reports and Open-Meteo.
export function ScenarioPage({ observations }: { observations: DashObservation[] | null }) {
  const now = useNow()
  const [drySpell, setDrySpell] = useState(false)
  const slugs = useMemo(
    () => [...new Set((observations ?? []).map(o => o.districtSlug))].sort(),
    [observations]
  )
  const forecast = useQuery({
    queryKey: ['rain-outlook', slugs.join(',')],
    queryFn: () => fetchRainOutlook(slugs),
    enabled: slugs.length > 0,
    staleTime: 3 * 3_600_000,
    retry: 1,
  })
  const rows = useMemo(
    () =>
      campScenarios({
        observations: observations ?? [],
        rain: forecast.data ?? new Map(),
        mode: drySpell ? 'dry_spell' : 'forecast',
        now,
      }),
    [observations, forecast.data, drySpell, now]
  )
  // While the forecast is on its way the ranking is not known yet: shimmer, never "0 camps".
  const fetching = !drySpell && slugs.length > 0 && forecast.isPending
  const count = (band: Band) => rows.filter(r => r.band === band).length
  const ranked = fetching ? [] : rows
  const closer = ranked.filter(r => r.band === 'closer')
  const watch = ranked.filter(r => r.band === 'watch')
  const routine = ranked.filter(r => r.band === 'routine')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dry-spell scenario" />

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-card bg-well px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={drySpell}
            aria-label="Dry spell: assume no rain for the next 14 days"
            onClick={() => setDrySpell(on => !on)}
            className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
              drySpell ? 'border-signal bg-signal' : 'border-hairline-strong bg-well'
            }`}
          >
            <span
              aria-hidden
              className={`absolute left-0 top-0.5 h-[18px] w-[18px] rounded-full transition-transform ${
                drySpell ? 'translate-x-[22px] bg-signal-ink' : 'translate-x-0.5 bg-fg-2'
              }`}
            />
          </button>
          <span>
            <span className="block font-semibold text-fg">
              Dry spell: assume no rain for the next 14 days
            </span>
            <span className="block text-caption text-fg-2">
              The one canned scenario. Off, the ranking uses the published forecast.
            </span>
          </span>
        </div>
        {fetching ? (
          <Loading label="Fetching the forecast">
            <Bar className="h-3.5 w-56" />
          </Loading>
        ) : (
          <p className="meta">
            {drySpell
              ? 'Rain: the dry spell'
              : forecast.isError
                ? 'Rain: forecast unavailable, turn on the dry spell'
                : `Rain: Open-Meteo forecast for ${forecast.data?.size ?? 0} districts`}
          </p>
        )}
      </div>

      {observations && !fetching ? (
        <StatCards
          stats={[
            { label: 'Camps for closer monitoring', value: count('closer') },
            { label: 'Camps to watch', value: count('watch') },
            { label: `Camps with reports, ${SCENARIO_WINDOW_DAYS} days`, value: rows.length },
          ]}
        />
      ) : (
        <SkeletonStatCards count={3} />
      )}

      <section aria-labelledby="ranked">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div>
            <h2 id="ranked" className="text-section font-semibold text-fg">
              Camps, ranked
            </h2>
            <p className="text-caption text-fg-2">
              Where to look first, from the rules below. Not a likelihood; no yield or loss
              estimate. Camp and district level only.
            </p>
          </div>
          <DemoBadge rows={rows} />
        </div>
        {(observations === null || fetching) && <SkeletonRows rows={6} label="Loading camps" />}
        {!fetching && observations && rows.length === 0 && (
          <p className="py-4 text-label text-fg-2">No reports in the last 14 days.</p>
        )}
        {!fetching && closer.length + watch.length === 0 && rows.length > 0 && (
          <p className="py-4 text-label text-fg-2">
            {drySpell
              ? 'No camp crosses the rules even with a dry spell.'
              : 'The forecast is not dry for any camp with reports. Turn on the dry spell to see which camps would need closer monitoring.'}
          </p>
        )}
        {closer.length > 0 && (
          <h3 className={`mt-4 text-label font-semibold ${BAND.closer.className}`}>
            {BAND.closer.label} <span className="font-normal text-fg-2">· {closer.length}</span>
          </h3>
        )}
        {closer.length > 0 && (
          <CampTable rows={closer.slice(0, FIRST)} start={1} drySpell={drySpell} />
        )}
        {closer.length > FIRST && (
          <Disclosure summary="More camps for closer monitoring" hint={closer.length - FIRST}>
            <CampTable rows={closer.slice(FIRST)} start={FIRST + 1} drySpell={drySpell} />
          </Disclosure>
        )}
        {/* Watch and routine fold away; closer monitoring is the answer. */}
        {[
          { band: 'watch', rows: watch, start: closer.length + 1 },
          { band: 'routine', rows: routine, start: closer.length + watch.length + 1 },
        ].map(
          group =>
            group.rows.length > 0 && (
              <Disclosure
                key={group.band}
                summary={group.band === 'watch' ? 'Camps to watch' : 'Routine camps'}
                hint={group.rows.length}
              >
                <CampTable rows={group.rows} start={group.start} drySpell={drySpell} />
              </Disclosure>
            )
        )}
      </section>

      <div className="max-w-4xl">
        <Disclosure summary="Assumptions and rules" hint="every input, with its source">
          <ul className="flex flex-col gap-3 text-label text-fg">
            <li>
              <span className="th block">Reports</span>
              The last {SCENARIO_WINDOW_DAYS} days, grouped by camp (or district where the camp was
              not recorded).
            </li>
            <li>
              <span className="th block">Dry</span>
              Under {DRY_THRESHOLD_MM} mm of forecast rain over the next 14 days at the district
              town (a threshold set by Phytos), or the dry spell when it is on.
            </li>
            <li>
              <span className="th block">Crop stage</span>
              Days from the planting date on each report to the middle of the window, read against
              the table below. {UNKNOWN_STAGE_NOTE}
            </li>
            <li>
              <span className="th block">Rules</span>
              <ul className="mt-0.5 flex list-disc flex-col gap-1 pl-5">
                {RULES.map(rule => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </li>
            <li>
              <span className="th block">Forecast</span>
              <a
                href={WEATHER_SOURCE.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline"
              >
                {WEATHER_SOURCE.licence}
                <ExternalLink size={16} aria-hidden />
              </a>
            </li>
          </ul>
          <h3 className="mt-5 text-label font-semibold text-fg">
            Crop stage: what a dry spell would leave unchecked
          </h3>
          <div className="mt-2 overflow-x-auto" data-visual-scroll>
            <table className="w-full min-w-[760px] text-left text-label">
              <thead>
                <tr className="border-b border-hairline">
                  {['Crop', 'Stage', 'Days after planting', 'Concern', 'Watch for', 'Basis'].map(
                    h => (
                      <th key={h} className="th py-2 pr-4">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {STAGE_TABLE.map(r => (
                  <tr
                    key={`${r.crop}-${r.stage}`}
                    className="border-b border-hairline align-top last:border-b-0"
                  >
                    <td className="py-2 pr-3 font-semibold text-fg">{CROP_LABELS[r.crop]}</td>
                    <td className="py-2 pr-3">{r.stage}</td>
                    <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
                      {r.to === null ? `${r.from}+` : `${r.from} to ${r.to}`}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className={`h-2 w-2 rounded-full ${CONCERN_DOT[r.concern]}`}
                        />
                        {r.concern}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{r.watch}</td>
                    <td className="py-2 pr-3 text-fg-2">
                      {r.basis}
                      {r.source && <span className="mt-0.5 block text-caption">{r.source}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Disclosure>
      </div>
    </div>
  )
}

const CONCERN_DOT: Record<Concern, string> = {
  high: 'bg-high',
  moderate: 'bg-attention',
  low: 'bg-hairline-strong',
  none: 'bg-hairline',
}

const RANK_COLUMNS = [
  { label: '#', className: 'w-9' },
  { label: 'Camp', className: '' },
  { label: 'Crop', className: 'w-28 max-md:hidden' },
  { label: 'Reports', className: 'w-20 text-right max-md:hidden' },
  { label: 'Crop stage', className: 'w-56 max-md:w-40' },
  { label: 'Rain, next 14 days', className: 'w-40 max-md:hidden' },
  { label: 'Verified', className: 'w-36 max-md:hidden' },
]

function rainCell(c: CampScenario, drySpell: boolean) {
  if (drySpell) return 'Dry spell'
  if (c.rainMm === null) return 'Unavailable'
  return `${c.rainMm} mm${c.dry ? ' · dry' : ''}`
}

// One row a camp, every input that ranked it in its own column (polish 30 Oct): the crop-stage
// concern as a dot and words, the rain, the verified reports. Phones keep the camp and the stage.
// The band is the group the table sits in, not a chip.
function CampTable({
  rows,
  start,
  drySpell,
}: {
  rows: CampScenario[]
  start: number
  drySpell: boolean
}) {
  return (
    <div className="overflow-x-auto" data-visual-scroll>
      <table className="w-full table-fixed text-left text-label">
        <thead>
          <tr className="border-b border-hairline">
            {RANK_COLUMNS.map(col => (
              <th key={col.label} className={`th py-2 pr-4 ${col.className}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr
              key={`${c.districtSlug}|${c.camp}`}
              className="border-b border-hairline align-top last:border-b-0"
            >
              <td className="py-2 pr-4 font-mono text-caption tabular-nums text-fg-2">
                {start + i}
              </td>
              <td className="py-2 pr-4">
                <span className="font-semibold text-fg">{c.camp}</span>
                <span className="block text-caption text-fg-2">{c.district}</span>
              </td>
              <td className="py-2 pr-4 max-md:hidden">
                {c.crops.map(crop => CROP_LABELS[crop]).join(', ')}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums max-md:hidden">{c.reports}</td>
              <td className="py-2 pr-4" title={c.stageRow?.watch}>
                {c.stageRow ? (
                  <span className="inline-flex items-baseline gap-1.5">
                    <span
                      aria-hidden
                      className={`h-2 w-2 shrink-0 self-center rounded-full ${CONCERN_DOT[c.concern]}`}
                    />
                    <span>
                      {c.stageUnknown ? 'Stage not recorded' : c.stageRow.stage}
                      {c.concern !== 'none' && <span className="text-fg-2"> · {c.concern}</span>}
                    </span>
                  </span>
                ) : (
                  <span className="text-fg-2">Not recorded</span>
                )}
              </td>
              <td className="py-2 pr-4 tabular-nums max-md:hidden">{rainCell(c, drySpell)}</td>
              <td className="py-2 pr-4 tabular-nums max-md:hidden">
                {c.verified.length
                  ? c.verified.map(v => `${v.count} ${ISSUE_SHORT[v.issue]}`).join(', ')
                  : 'None'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
