import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CROP_LABELS, WEATHER_SOURCE } from '@repo/shared'
import { DemoBadge } from '../components/DemoBadge'
import { Disclosure, PageHeader } from '../components/PageHeader'
import { SkeletonRows, SkeletonStats } from '../components/Skeleton'
import type { DashObservation } from '../hooks/useLive'
import { useNow } from '../hooks/useNow'
import { fetchRainOutlook } from '../lib/rainOutlook'
import {
  campScenarios,
  DRY_THRESHOLD_MM,
  RULES,
  SCENARIO_WINDOW_DAYS,
  STAGE_TABLE,
  UNKNOWN_STAGE_NOTE,
  verifiedText,
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

// Scenario (prototype): "If the next 14 days turn dry, which camps need closer monitoring?"
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
  const count = (band: Band) => rows.filter(r => r.band === band).length
  const closer = rows.filter(r => r.band === 'closer')
  const watch = rows.filter(r => r.band === 'watch')
  const routine = rows.filter(r => r.band === 'routine')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dry-spell scenario"
        question="If the next 14 days turn dry, which camps need closer monitoring?"
        aside={
          <>
            <span className="chip border-hairline-strong text-fg-2">Prototype</span>
            <DemoBadge rows={rows} />
          </>
        }
      />

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
        <p className="meta">
          {drySpell
            ? 'Rain: the dry spell'
            : forecast.isPending && slugs.length > 0
              ? 'Rain: fetching the forecast…'
              : forecast.isError
                ? 'Rain: forecast unavailable, turn on the dry spell'
                : `Rain: Open-Meteo forecast for ${forecast.data?.size ?? 0} districts`}
        </p>
      </div>

      {observations ? (
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-label">
          {[
            [count('closer'), 'camps for closer monitoring'],
            [count('watch'), 'camps to watch'],
            [rows.length, `camps with reports in ${SCENARIO_WINDOW_DAYS} days`],
          ].map(([value, label]) => (
            <div key={label} className="flex items-baseline gap-2">
              <dt className="sr-only">{label}</dt>
              <dd className="text-stat font-semibold tabular-nums text-fg">{value}</dd>
              <span aria-hidden className="text-fg-2">
                {label}
              </span>
            </div>
          ))}
        </dl>
      ) : (
        <SkeletonStats count={3} />
      )}

      <section aria-labelledby="ranked" className="max-w-4xl">
        <h2 id="ranked" className="text-section font-semibold text-fg">
          Camps, ranked
        </h2>
        <p className="text-caption text-fg-2">
          An ordering of where to look first, from the rules below: not a likelihood, and no yield
          or loss estimate. Camp and district level only.
        </p>
        {observations === null && <SkeletonRows rows={6} label="Loading camps" />}
        {observations && rows.length === 0 && (
          <p className="py-4 text-label text-fg-2">No reports in the last 14 days.</p>
        )}
        {closer.length + watch.length === 0 && rows.length > 0 && (
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
        <CampRows rows={closer.slice(0, FIRST)} start={1} drySpell={drySpell} />
        {closer.length > FIRST && (
          <Disclosure summary="More camps for closer monitoring" hint={closer.length - FIRST}>
            <CampRows rows={closer.slice(FIRST)} start={FIRST + 1} drySpell={drySpell} />
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
                <CampRows rows={group.rows} start={group.start} drySpell={drySpell} />
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
              town (a Phytos prototype threshold), or the dry spell when it is on.
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
                <ExternalLink size={13} strokeWidth={2} aria-hidden />
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

function rainText(c: CampScenario, drySpell: boolean) {
  if (drySpell) return 'Dry spell (scenario)'
  if (c.rainMm === null) return 'Forecast unavailable'
  return `${c.dry ? 'Dry' : 'Not dry'}: ${c.rainMm} mm forecast`
}

const CONCERN_DOT: Record<Concern, string> = {
  high: 'bg-high',
  moderate: 'bg-attention',
  low: 'bg-hairline-strong',
  none: 'bg-hairline',
}

// Two lines a row: the camp, then one secondary line in full: crop-stage concern as a dot and
// words, the rain, the verified reports. The band is the group the row sits in, not a chip.
function CampRows({
  rows,
  start,
  drySpell,
}: {
  rows: CampScenario[]
  start: number
  drySpell: boolean
}) {
  return (
    <ol className="flex flex-col">
      {rows.map((c, i) => (
        <li key={`${c.districtSlug}|${c.camp}`} className="py-3">
          <div className="flex items-start gap-2">
            <span className="w-5 shrink-0 pt-0.5 font-mono text-caption text-fg-2">
              {start + i}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-fg">{c.camp}</span>
              </div>
              {/* One secondary line: the camp, then every input that ranked it. */}
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-label text-fg-2">
                <span>
                  {c.district} · {c.crops.map(crop => CROP_LABELS[crop]).join(', ')} · {c.reports}{' '}
                  {c.reports === 1 ? 'report' : 'reports'}
                </span>
                {c.stageRow && (
                  <>
                    <span aria-hidden>·</span>
                    <span
                      aria-hidden
                      className={`h-2 w-2 rounded-full ${CONCERN_DOT[c.concern]}`}
                    />
                    <span className="text-fg" title={c.stageRow.watch}>
                      {c.stageUnknown ? 'Stage not recorded' : c.stageRow.stage}
                      {c.concern !== 'none' ? ` (${c.concern})` : ''}
                    </span>
                  </>
                )}
                <span>· {rainText(c, drySpell)}</span>
                {c.verified.map(v => (
                  <span key={v.issue}>· {verifiedText(v)}</span>
                ))}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
