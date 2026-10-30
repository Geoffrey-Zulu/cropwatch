import type { ReactNode } from 'react'
import { Bar, Loading } from './Skeleton'

export interface Stat {
  label: string
  value: ReactNode
  // A small change line where the data has one: "↑3 new this week", "↓2 on last week".
  delta?: string | null
}

// The figures above a page (polish 30 Oct): a card each, a small grey label on top and a large
// tabular number that settles in again when it changes, so they read as live figures. No border:
// a quiet fill groups each one (patterns-v2.md decision 3).
export function StatCards({
  stats,
  columns = 'grid-cols-2 lg:grid-cols-4',
}: {
  stats: Stat[]
  columns?: string
}) {
  return (
    <dl className={`grid gap-3 ${columns}`}>
      {stats.map(s => (
        <div key={s.label} className="min-w-0 rounded-card bg-well px-4 py-3">
          <dt className="text-caption font-medium text-fg-2">{s.label}</dt>
          <dd className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span
              key={String(s.value)}
              className="animate-tag text-stat font-semibold tabular-nums text-fg"
            >
              {s.value}
            </span>
            {s.delta && (
              <span className="text-caption font-medium tabular-nums text-fg-2">{s.delta}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <Loading label="Loading figures">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-card bg-well px-4 py-3">
            <Bar className="h-3 w-24" />
            <Bar className="h-7 w-14" />
          </div>
        ))}
      </div>
    </Loading>
  )
}

// "↑3 on last week", "↓2 on last week", "Same as last week".
export function weekDelta(thisWeek: number, lastWeek: number) {
  const change = thisWeek - lastWeek
  if (change === 0) return 'Same as last week'
  return `${change > 0 ? '↑' : '↓'}${Math.abs(change)} on last week`
}

// "↑2 new this week", or nothing new.
export const newThisWeek = (n: number) => (n > 0 ? `↑${n} new this week` : 'None new this week')
