import type { ReactNode } from 'react'
import { CountUp } from '../hooks/useCountUp'
import { Bar, Loading } from './Skeleton'

export interface Stat {
  label: string
  value: ReactNode
  // A small change line where the data has one: "↑3 new this week", "↓2 on last week".
  delta?: string | null
  // A small unit before the figure ("ZMW"), and figures with thousands separators.
  prefix?: string
}

const FIGURE = { fontVariationSettings: '"SOFT" 100, "WONK" 0, "opsz" 72' }

// The figures above a page, as mockup A's ledger island: one white island, a Fraunces figure
// that counts up when it changes, its label and its change line, cells divided by hairlines.
export function StatCards({
  stats,
  columns = 'grid-cols-2 lg:grid-cols-4',
  countFromZero = false,
}: {
  stats: Stat[]
  columns?: string
  // Count up from 0 when the page opens (the season's portfolio, plan §4 beat 1).
  countFromZero?: boolean
}) {
  return (
    <dl className={`island grid overflow-hidden ${columns}`}>
      {stats.map(s => (
        <div
          key={s.label}
          className="min-w-0 px-[1.45rem] py-[1.05rem] shadow-[inset_1px_0_0_var(--hairline),inset_0_1px_0_var(--hairline)]"
        >
          <dd className="serif text-stat font-semibold tabular-nums text-fg" style={FIGURE}>
            {s.prefix && (
              <span className="mr-1 font-body text-[0.85rem] font-[650] tracking-normal text-fg-2">
                {s.prefix}
              </span>
            )}
            {typeof s.value === 'number' ? (
              <CountUp
                value={s.value}
                start={countFromZero ? 0 : undefined}
                format={n => n.toLocaleString('en-GB')}
              />
            ) : (
              s.value
            )}
          </dd>
          <dt className="mt-[0.35rem] text-[0.93rem] font-semibold leading-[1.3] text-fg">
            {s.label}
          </dt>
          {s.delta && (
            <p className="mt-[0.12rem] text-[0.84rem] leading-[1.3] tabular-nums text-fg-2">
              {s.delta}
            </p>
          )}
        </div>
      ))}
    </dl>
  )
}

export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <Loading label="Loading figures">
      <div className="island grid grid-cols-2 overflow-hidden lg:grid-cols-4">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 px-[1.45rem] py-[1.05rem]">
            <Bar className="h-8 w-14" />
            <Bar className="h-3.5 w-28" />
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
