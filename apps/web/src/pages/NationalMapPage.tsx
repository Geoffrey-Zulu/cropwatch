import { useMemo, useState } from 'react'
import { ISSUE_LABELS, RISK_ORDER } from '@repo/shared'
import { DemoBadge } from '../components/DemoBadge'
import { LevelPill } from '../components/LevelTag'
import { PageHeader } from '../components/PageHeader'
import { SkeletonRows } from '../components/Skeleton'
import { newThisWeek, SkeletonStatCards, StatCards, weekDelta } from '../components/StatCards'
import { ZambiaMap } from '../components/ZambiaMap'
import type { LiveData } from '../hooks/useLive'
import { useNow } from '../hooks/useNow'
import { useDrawerLinks } from '../hooks/useRoute'
import { ago, compactFactors, reportNumber, shortDate } from '../lib/copy'

const DAY = 86_400_000
const WINDOW_DAYS = 14
// Districts the rail shows before "Show all".
const RAIL_FIRST = 5

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

// The national map answers one question: where is it bad right now? The map, the districts
// to watch beside it and four live figures above it; alerts live behind the header bell and detail
// opens in drawers (patterns-v2.md).
export function NationalMapPage({ observations, clusters, risk }: LiveData) {
  const [focus, setFocus] = useState<keyof typeof FOCUS>('zambia')
  const [district, setDistrict] = useState<string | null>(null)
  const [allDistricts, setAllDistricts] = useState(false)
  const { open } = useDrawerLinks()

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
  const awaiting = recent.filter(o => o.status === 'awaiting_expert_review')
  const high = (risk ?? []).filter(r => r.level === 'HIGH').length
  // Week on week, from the reports themselves: this week is the last 7 days.
  const weekAgo = now - 7 * DAY
  const thisWeek = recent.filter(o => Date.parse(o.createdAt) > weekAgo).length
  const lastWeek = recent.length - thisWeek
  const newClusters = (clusters ?? []).filter(c => Date.parse(c.firstDetectedAt) > weekAgo).length
  const newAwaiting = awaiting.filter(o => Date.parse(o.createdAt) > weekAgo).length
  const shown = [...recent, ...(clusters ?? []), ...(risk ?? [])]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="National map" />

      {observations && clusters && risk ? (
        <StatCards
          stats={[
            {
              label: 'Reports this week',
              value: thisWeek,
              delta: weekDelta(thisWeek, lastWeek),
            },
            {
              label: 'Active clusters',
              value: clusters.length,
              delta: newThisWeek(newClusters),
            },
            { label: 'Districts at High', value: high },
            {
              label: 'Waiting for an officer',
              value: awaiting.length,
              delta: newThisWeek(newAwaiting),
            },
          ]}
        />
      ) : (
        <SkeletonStatCards />
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative min-w-0">
          <div
            className="mb-2 flex gap-1 rounded-card bg-well p-1 sm:absolute sm:left-3 sm:top-3 sm:z-10 sm:mb-0 sm:bg-panel sm:shadow-raise"
            role="group"
            aria-label="Map focus"
          >
            {(Object.keys(FOCUS) as (keyof typeof FOCUS)[]).map(key => (
              <button
                key={key}
                type="button"
                aria-pressed={focus === key}
                onClick={() => setFocus(key)}
                className={`rounded px-2.5 py-1 text-caption font-medium ${
                  focus === key ? 'bg-fg text-ground' : 'text-fg hover:bg-well'
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
            // The projector view (v2.1): most of the screen height.
            height="max(480px, 70vh)"
            badge={<DemoBadge rows={shown} className="bg-panel shadow-raise" />}
            selected={district}
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
            onCluster={id => (window.location.hash = open({ kind: 'outbreak', id }))}
            onPoint={id => (window.location.hash = open({ kind: 'observation', id }))}
            onDistrict={slug => setDistrict(d => (d === slug ? null : slug))}
          />
        </div>

        <section aria-labelledby="watch" className="min-w-0">
          <h2 id="watch" className="text-section font-semibold text-fg">
            Districts to watch
          </h2>
          <p className="text-caption text-fg-2">Risk signal from reports, not a forecast.</p>
          {risk === null && <SkeletonRows rows={6} label="Loading districts" />}
          {risk && watch.length === 0 && (
            <p className="py-4 text-label text-fg-2">No district is above Low.</p>
          )}
          {/* A table to scan: district and level on one line, its factors in one compact line
              below; open a row for every factor in full (CLAUDE.md invariant 2). */}
          {watch.length > 0 && (
            <div className="mt-3 flex justify-between border-b border-hairline pb-1.5">
              <span className="th">District</span>
              <span className="th">Signal</span>
            </div>
          )}
          <ul className="flex flex-col">
            {(allDistricts ? watch : watch.slice(0, RAIL_FIRST)).map(r => {
              const isOpen = district === r.districtSlug
              return (
                <li key={r.districtSlug} className="border-b border-hairline">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setDistrict(isOpen ? null : r.districtSlug)}
                    className={`-mx-2 grid w-[calc(100%+1rem)] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-card px-2 py-2.5 text-left hover:bg-well ${isOpen ? 'bg-signal-tint' : ''}`}
                  >
                    <span className="font-semibold text-fg">{r.district}</span>
                    <LevelPill level={r.level} />
                    <span className="col-span-2 text-caption tabular-nums text-fg-2">
                      {compactFactors(r.factors)}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="pb-3 pt-1">
                      <ul className="flex flex-col gap-1 text-caption text-fg">
                        {r.factors.map(f => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                      <p className="mt-1 text-caption text-fg-2">Computed {ago(r.computedAt)}</p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          {!allDistricts && watch.length > RAIL_FIRST && (
            <button
              type="button"
              onClick={() => setAllDistricts(true)}
              className="mt-1 text-label font-medium text-signal-text hover:underline"
            >
              Show all {watch.length} districts
            </button>
          )}
        </section>
      </div>
    </div>
  )
}
