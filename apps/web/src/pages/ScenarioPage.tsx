import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CROP_LABELS, WEATHER_SOURCE } from '@repo/shared'
import { DemoBadge } from '../components/DemoBadge'
import { Figure, Figures, Muted, Panel } from '../components/Panel'
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

const BAND: Record<Band, { label: string; className: string }> = {
  closer: { label: 'Closer monitoring', className: 'border-signal-text text-signal-text' },
  watch: { label: 'Watch', className: 'border-attention text-attention-text' },
  routine: { label: 'Routine', className: 'border-hairline-strong text-fg-2' },
}

const CONCERN: Record<Concern, string> = {
  high: 'border-high text-high-text',
  moderate: 'border-attention text-attention-text',
  low: 'border-hairline-strong text-fg-2',
  none: 'border-hairline text-fg-2',
}

const chip = 'chip'

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="eyebrow">Scenario · next {SCENARIO_WINDOW_DAYS} days</p>
          <h1 className="mt-1 font-display text-display font-bold text-fg">
            If the next 14 days turn dry, which camps need closer monitoring?
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip border-attention text-attention-text">Prototype</span>
          <DemoBadge rows={rows} />
        </div>
      </div>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
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
                className={`absolute top-0.5 h-[18px] w-[18px] rounded-full transition-transform ${
                  drySpell ? 'translate-x-[22px] bg-signal-ink' : 'translate-x-0.5 bg-fg-2'
                }`}
              />
            </button>
            <span>
              <span className="block font-semibold text-fg">
                Dry spell: assume no rain for the next 14 days
              </span>
              <span className="block text-label text-fg-2">
                The one canned scenario. Off, the ranking uses the published forecast.
              </span>
            </span>
          </div>
          <p className="meta">
            {drySpell
              ? 'Rain: dry spell scenario'
              : forecast.isPending && slugs.length > 0
                ? 'Rain: fetching the forecast…'
                : forecast.isError
                  ? 'Rain: forecast unavailable, turn on the dry spell'
                  : `Rain: Open-Meteo forecast, ${forecast.data?.size ?? 0} districts`}
          </p>
        </div>
      </Panel>

      <Figures>
        <Figure value={observations ? count('closer') : '·'} label="camps for closer monitoring" />
        <Figure value={observations ? count('watch') : '·'} label="camps to watch" />
        <Figure value={observations ? count('routine') : '·'} label="camps routine" />
        <Figure
          value={observations ? rows.length : '·'}
          label="camps with reports in the last 14 days"
        />
      </Figures>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel eyebrow="Where to look first" title="Camps, ranked">
          {observations === null && <Muted>Loading reports…</Muted>}
          {observations && rows.length === 0 && <Muted>No reports in the last 14 days.</Muted>}
          {closer.length + watch.length === 0 && rows.length > 0 && (
            <Muted>
              {drySpell
                ? 'No camp crosses the rules even with a dry spell.'
                : 'The forecast is not dry for any camp with reports. Turn on the dry spell to see which camps would need closer monitoring.'}
            </Muted>
          )}
          <CampRows rows={closer} start={1} drySpell={drySpell} />
          {/* Watch and routine fold away; closer monitoring is the answer. */}
          {[
            { band: 'watch', rows: watch, start: closer.length + 1 },
            { band: 'routine', rows: routine, start: closer.length + watch.length + 1 },
          ].map(
            group =>
              group.rows.length > 0 && (
                <details key={group.band} className="mt-2">
                  <summary className="cursor-pointer py-2 text-label font-medium text-fg-2 hover:text-fg">
                    {group.rows.length} camps {group.band === 'watch' ? 'to watch' : 'routine'}
                  </summary>
                  <CampRows rows={group.rows} start={group.start} drySpell={drySpell} />
                </details>
              )
          )}
          <p className="mt-3 text-caption text-fg-2">
            An ordering of where to look first, from the rules on the right: not a likelihood, and
            no yield or loss estimate. Camp and district level only.
          </p>
        </Panel>

        <Panel eyebrow="Every assumption" title="How this is worked out">
          <ul className="flex flex-col gap-2 text-label text-fg">
            <li>
              <span className="eyebrow block">Reports</span>
              The last {SCENARIO_WINDOW_DAYS} days, grouped by camp (or district where the camp was
              not recorded).
            </li>
            <li>
              <span className="eyebrow block">Dry</span>
              Under {DRY_THRESHOLD_MM} mm of forecast rain over the next 14 days at the district
              town (a Phytos prototype threshold), or the dry spell when it is on.
            </li>
            <li>
              <span className="eyebrow block">Crop stage</span>
              Days from the report&apos;s planting date to the middle of the window, read against
              the table below. {UNKNOWN_STAGE_NOTE}
            </li>
            <li>
              <span className="eyebrow block">Rules</span>
              <ul className="mt-0.5 flex flex-col gap-1">
                {RULES.map(rule => (
                  <li key={rule} className="flex gap-2">
                    <span aria-hidden className="mt-[8px] h-1 w-1 shrink-0 bg-attention" />
                    {rule}
                  </li>
                ))}
              </ul>
            </li>
            <li>
              <span className="eyebrow block">Forecast</span>
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
        </Panel>
      </div>

      <Panel eyebrow="Assumption table" title="Crop stage: what a dry spell would leave unchecked">
        <div className="-mx-6 overflow-x-auto px-6">
          <table className="w-full min-w-[860px] text-left text-label">
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
                  <td className="whitespace-nowrap py-2 pr-3 font-mono">
                    {r.to === null ? `${r.from}+` : `${r.from} to ${r.to}`}
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`${chip} ${CONCERN[r.concern]}`}>{r.concern}</span>
                  </td>
                  <td className="py-2 pr-3">{r.watch}</td>
                  <td className="py-2 pr-3 text-fg-2">
                    {r.basis}
                    {r.source && (
                      <span className="mt-0.5 block font-mono text-caption">{r.source}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
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

// Two lines a row (patterns.md rules 8 and 9): the camp with its one chip (the band), then one
// secondary line in full: crop-stage concern as a dot and words, the rain, the verified reports.
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
    <ol className="flex flex-col divide-y divide-hairline">
      {rows.map((c, i) => (
        <li key={`${c.districtSlug}|${c.camp}`} className="py-3">
          <div className="flex items-start gap-2">
            <span className="w-5 shrink-0 pt-0.5 font-mono text-caption text-fg-2">
              {start + i}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-fg">{c.camp}</span>
                <span className={`chip ${BAND[c.band].className}`}>{BAND[c.band].label}</span>
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
