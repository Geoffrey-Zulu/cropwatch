import { useMemo, useState } from 'react'
import { ISSUE_LABELS, RISK_ORDER } from '@repo/shared'
import { AlertRows } from '../components/AlertCard'
import { DemoBadge } from '../components/DemoBadge'
import { LevelTag } from '../components/LevelTag'
import { RiskFactors } from '../components/RiskFactors'
import { Figure, Figures, Muted, Panel } from '../components/Panel'
import { ZambiaMap } from '../components/ZambiaMap'
import type { LiveData } from '../hooks/useLive'
import { useNow } from '../hooks/useNow'
import { hrefFor } from '../hooks/useRoute'
import { reportNumber, shortDate } from '../lib/copy'

const DAY = 86_400_000
const WINDOW_DAYS = 14

const FOCUS = {
  zambia: { label: 'All Zambia', box: null },
  lusaka: {
    label: 'Lusaka and Chongwe',
    box: [
      [27.85, -15.95],
      [29.45, -14.95],
    ],
  },
  eastern: {
    label: 'Eastern Province',
    box: [
      [30.2, -14.8],
      [33.4, -11.6],
    ],
  },
} as const satisfies Record<
  string,
  { label: string; box: [[number, number], [number, number]] | null }
>

// The national picture: districts shaded by the prototype risk signal, the last 14 days of
// reports, active clusters, the districts to watch with their factors, and the latest alerts.
export function NationalMapPage({ observations, clusters, risk, alerts }: LiveData) {
  const [focus, setFocus] = useState<keyof typeof FOCUS>('zambia')
  const [district, setDistrict] = useState<string | null>(null)

  const now = useNow()
  const recent = useMemo(() => {
    const since = now - WINDOW_DAYS * DAY
    return (observations ?? []).filter(o => Date.parse(o.createdAt) > since)
  }, [observations, now])
  const levels = useMemo(() => new Map((risk ?? []).map(r => [r.districtSlug, r.level])), [risk])
  const watch = useMemo(
    () =>
      (risk ?? [])
        .filter(r => r.level !== 'LOW')
        .sort(
          (a, b) =>
            RISK_ORDER.indexOf(b.level) - RISK_ORDER.indexOf(a.level) ||
            a.district.localeCompare(b.district)
        ),
    [risk]
  )
  const selected = district ? (risk ?? []).find(r => r.districtSlug === district) : null
  const awaiting = recent.filter(o => o.status === 'awaiting_expert_review').length
  const shown = [...recent, ...(clusters ?? []), ...(risk ?? []), ...(alerts ?? [])]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Zambia · last {WINDOW_DAYS} days</p>
          <h1 className="mt-1 font-display text-display-xl font-bold text-fg">National picture</h1>
        </div>
        <DemoBadge rows={shown} />
      </div>

      <Figures>
        <Figure value={observations ? recent.length : '·'} label="Reports, 14 days" />
        <Figure value={clusters?.length ?? '·'} label="Active clusters" emphasis />
        <Figure
          value={risk ? risk.filter(r => r.level === 'HIGH').length : '·'}
          label="Districts at High"
        />
        <Figure value={observations ? awaiting : '·'} label="Waiting for an officer" />
      </Figures>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Map focus">
            {(Object.keys(FOCUS) as (keyof typeof FOCUS)[]).map(key => (
              <button
                key={key}
                type="button"
                aria-pressed={focus === key}
                onClick={() => setFocus(key)}
                className={`rounded-card border px-3 py-1.5 font-mono text-eyebrow font-medium uppercase ${
                  focus === key
                    ? 'border-fg-2 bg-well text-fg'
                    : 'border-hairline text-fg-2 hover:bg-well hover:text-fg'
                }`}
              >
                {FOCUS[key].label}
              </button>
            ))}
          </div>
          <ZambiaMap
            key={focus}
            levels={levels}
            focus={FOCUS[focus].box as [[number, number], [number, number]] | null}
            height={620}
            points={recent.map(o => ({
              id: o.id,
              location: o.location,
              sim: o.sim,
              issue: o.issue,
              label: `Report ${reportNumber(o.id)} · ${o.issue && o.issue !== 'unknown' ? ISSUE_LABELS[o.issue] : 'not identified'} · ${o.district} · ${shortDate(o.createdAt)}${o.sim ? ' · simulated' : ''}`,
            }))}
            clusters={(clusters ?? []).map(c => ({
              id: c.id,
              center: c.center,
              radiusKm: c.radiusKm,
              issue: c.issue,
              size: c.size,
              sim: c.sim,
            }))}
            onCluster={id => (window.location.hash = hrefFor({ page: 'outbreak', id }))}
            onPoint={id => (window.location.hash = hrefFor({ page: 'observation', id }))}
            onDistrict={setDistrict}
          />
          <Muted>
            Shading is Risk Model v0, a rule-based prototype signal from reports (and weather
            context): not a prediction. Click a cluster ring for its outbreak detail, a dot for the
            report, a district for its factors.
          </Muted>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {selected && (
            <Panel eyebrow="Selected district" title={selected.district}>
              <RiskFactors risk={selected} />
            </Panel>
          )}
          <Panel eyebrow="Prototype risk signal" title="Districts to watch">
            {risk === null && <Muted>Loading…</Muted>}
            {risk && watch.length === 0 && <Muted>No district is above Low.</Muted>}
            <ul className="-mx-4 flex flex-col">
              {watch.map(r => (
                <li key={r.districtSlug} className="border-t border-hairline first:border-t-0">
                  <button
                    type="button"
                    onClick={() => setDistrict(r.districtSlug)}
                    aria-pressed={district === r.districtSlug}
                    title={r.factors[0]}
                    className={`flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-well ${district === r.districtSlug ? 'bg-well' : ''}`}
                  >
                    <LevelTag level={r.level} />
                    <span className="shrink-0 font-semibold text-fg">{r.district}</span>
                    <span className="min-w-0 truncate text-label text-fg-2">{r.factors[0]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Panel eyebrow="Latest" title="Alerts">
        {alerts === null && <Muted>Loading…</Muted>}
        {alerts?.length === 0 && <Muted>No alerts yet.</Muted>}
        {alerts && alerts.length > 0 && <AlertRows alerts={alerts.slice(0, 8)} />}
      </Panel>
    </div>
  )
}
