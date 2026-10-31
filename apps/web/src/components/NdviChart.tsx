import { useEffect, useId, useRef, useState } from 'react'
import type { CurvePoint } from '@repo/shared'

// Labels that sit over the plot (the cloud band, the latest value, the dates) get A's map-label
// halo, so a line or a hatch never strikes through them.
const HALO = {
  paintOrder: 'stroke',
  stroke: 'var(--panel)',
  strokeWidth: 4,
  strokeLinejoin: 'round',
} as const

// The field's greenness from space against its camp's median (CEIH, spec W2): Sentinel-2 NDVI a
// pass, a clouded pass as a break in the line over a hatched band, the establishment line, the
// planting date and today. Drawn in real pixels from the container's width, so the text stays
// the same size on a phone and a projector. Colours are the theme's: field green for the field,
// the quiet ink for the camp.

const DAY = 86_400_000
const at = (date: string) => Date.parse(`${date.slice(0, 10)}T00:00:00Z`)
const dayMonth = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}

// Runs of consecutive points that pass a test, for lines that break.
function runs<T>(items: T[], keep: (item: T) => boolean): T[][] {
  const out: T[][] = []
  let run: T[] = []
  for (const item of items) {
    if (keep(item)) run.push(item)
    else if (run.length) {
      out.push(run)
      run = []
    }
  }
  if (run.length) out.push(run)
  return out
}

export function NdviChart({
  curve,
  plantingDate,
  today,
  threshold,
  height = 230,
  compact = false,
  label,
}: {
  curve: CurvePoint[]
  plantingDate: string
  today: string
  threshold: number
  height?: number
  compact?: boolean
  label: string
}) {
  const { ref, width } = useWidth<HTMLDivElement>(560)
  const pattern = useId().replace(/:/g, '')
  if (curve.length === 0)
    return (
      <div ref={ref} className="rounded-card bg-well px-4 py-6 text-label text-fg-2">
        No satellite passes yet.
      </div>
    )
  const pad = {
    left: compact ? 30 : 36,
    right: compact ? 10 : 14,
    top: compact ? 14 : 30,
    bottom: 22,
  }
  // From three weeks before planting: the rise gets the room, not the fallow months.
  const start = Math.max(at(curve[0].date) - 3 * DAY, at(plantingDate) - 21 * DAY)
  const end = Math.max(at(today), at(curve[curve.length - 1].date)) + 2 * DAY
  const x = (ms: number) =>
    pad.left + ((ms - start) / (end - start)) * (width - pad.left - pad.right)
  const top = 0.85
  const y = (v: number) => pad.top + (1 - v / top) * (height - pad.top - pad.bottom)
  const points = curve.map(p => ({ ...p, ms: at(p.date) })).filter(p => p.ms >= start)
  const field = runs(points, p => p.ndvi !== null)
  const camp = runs(points, p => p.camp_median !== null)
  const line = (run: typeof points, value: (p: (typeof points)[number]) => number) =>
    run.map(p => `${x(p.ms).toFixed(1)},${y(value(p)).toFixed(1)}`).join(' ')
  // A clouded run spans halfway to its clear neighbours.
  const gaps = runs(
    points.map((p, i) => ({ ...p, i })),
    p => p.ndvi === null
  ).map(run => {
    const before = points[run[0].i - 1]
    const after = points[run[run.length - 1].i + 1]
    const from = before ? (before.ms + run[0].ms) / 2 : run[0].ms - 3 * DAY
    const to = after
      ? (after.ms + run[run.length - 1].ms) / 2
      : Math.min(run[run.length - 1].ms + 3 * DAY, end)
    return { from: x(from), to: x(to), count: run.length }
  })
  const months: number[] = []
  for (let d = new Date(start); d.getTime() <= end; d.setUTCMonth(d.getUTCMonth() + 1, 1)) {
    const first = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
    if (first >= start) months.push(first)
  }
  const last = [...points].reverse().find(p => p.ndvi !== null)
  const planting = at(plantingDate)
  const todayX = x(at(today))
  const textSize = compact ? 10.5 : 11.5

  return (
    <div ref={ref} className="w-full">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={label}
        className="block overflow-visible"
      >
        <defs>
          <pattern
            id={pattern}
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="3" height="7" fill="rgb(27 41 32 / 0.075)" />
          </pattern>
        </defs>
        {gaps.map(g => (
          <g key={g.from}>
            <rect
              x={g.from}
              y={pad.top - 6}
              width={Math.max(4, g.to - g.from)}
              height={height - pad.top - pad.bottom + 6}
              fill="var(--canvas-1)"
            />
            <rect
              x={g.from}
              y={pad.top - 6}
              width={Math.max(4, g.to - g.from)}
              height={height - pad.top - pad.bottom + 6}
              fill={`url(#${pattern})`}
            />
            {!compact && g.to - g.from > 46 && (
              <text
                {...HALO}
                x={(g.from + g.to) / 2}
                y={pad.top + 12}
                textAnchor="middle"
                fontSize={textSize}
                fill="var(--fg-2)"
              >
                Clouded out
              </text>
            )}
          </g>
        ))}
        {[0, 0.2, 0.4, 0.6, 0.8].map(v => (
          <g key={v}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--hairline)"
            />
            <text
              x={pad.left - 7}
              y={y(v) + 3.5}
              textAnchor="end"
              fontSize={textSize}
              fill="var(--fg-2)"
            >
              {v === 0 ? '0' : v.toFixed(1)}
            </text>
          </g>
        ))}
        <line
          x1={pad.left}
          x2={width - pad.right}
          y1={y(threshold)}
          y2={y(threshold)}
          stroke="var(--fg-3)"
          strokeDasharray="2 4"
        />
        {!compact && (
          <text
            {...HALO}
            x={pad.left + 6}
            y={y(threshold) - 5}
            fontSize={textSize}
            fill="var(--fg-2)"
          >
            Established at {threshold.toFixed(2)}
          </text>
        )}
        {months.map(m => (
          <text
            key={m}
            x={x(m)}
            y={height - 5}
            textAnchor="middle"
            fontSize={textSize}
            fill="var(--fg-2)"
          >
            {dayMonth(m)}
          </text>
        ))}
        {planting >= start && (
          <g>
            <line
              x1={x(planting)}
              x2={x(planting)}
              y1={pad.top - 10}
              y2={height - pad.bottom}
              stroke="var(--fg-3)"
              strokeDasharray="3 3"
            />
            {!compact && (
              <text
                {...HALO}
                x={x(planting) + 5}
                y={pad.top - 14}
                fontSize={textSize}
                fontWeight={650}
                fill="var(--fg)"
              >
                Planted {dayMonth(planting)}
              </text>
            )}
          </g>
        )}
        {camp.map((run, i) => (
          <polyline
            key={i}
            points={line(run, p => p.camp_median!)}
            fill="none"
            stroke="var(--fg-3)"
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {field.map((run, i) => (
          <polyline
            key={i}
            className="chart-draw"
            points={line(run, p => p.ndvi!)}
            fill="none"
            stroke="var(--signal)"
            strokeWidth={compact ? 2.4 : 3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {!compact &&
          points
            .filter(p => p.ndvi !== null)
            .map(p => (
              <circle
                key={p.date}
                cx={x(p.ms)}
                cy={y(p.ndvi!)}
                r={3.2}
                fill="var(--signal)"
                stroke="#fff"
                strokeWidth={1.4}
              />
            ))}
        {last && (
          <text
            {...HALO}
            x={x(last.ms)}
            y={y(last.ndvi!) - 9}
            textAnchor="end"
            fontSize={textSize + 0.5}
            fontWeight={650}
            fill="var(--fg)"
          >
            {last.ndvi!.toFixed(2)}
          </text>
        )}
        <line
          x1={todayX}
          x2={todayX}
          y1={pad.top - 10}
          y2={height - pad.bottom}
          stroke="var(--fg)"
          strokeWidth={1.2}
        />
        {!compact && (
          <text
            {...HALO}
            x={todayX - 4}
            y={pad.top - 14}
            textAnchor="end"
            fontSize={textSize}
            fontWeight={650}
            fill="var(--fg)"
          >
            Today {dayMonth(at(today))}
          </text>
        )}
      </svg>
      {!compact && (
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-caption text-fg-2" aria-label="Key">
          <li className="inline-flex items-center gap-2">
            <span aria-hidden className="inline-block h-0 w-5 border-t-[2.5px] border-signal" />
            This field
          </li>
          <li className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-0 w-5 border-t-2 border-dashed border-[var(--fg-3)]"
            />
            Camp median
          </li>
          <li className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3 w-4 rounded-[0.2rem] shadow-[inset_0_0_0_1px_rgb(27_41_32/0.12)]"
              style={{ background: 'var(--hatch), var(--canvas-1)' }}
            />
            No clear pass
          </li>
        </ul>
      )}
    </div>
  )
}

// One line a row: the field's NDVI at its last passes, broken where clouded out.
export function Sparkline({ values, label }: { values: (number | null)[]; label: string }) {
  const w = 96
  const h = 26
  const step = values.length > 1 ? (w - 4) / (values.length - 1) : 0
  const y = (v: number) => h - 3 - (v / 0.85) * (h - 6)
  const segments = runs(
    values.map((v, i) => ({ v, i })),
    p => p.v !== null
  )
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label}
      className="block overflow-visible"
    >
      {segments.map(run =>
        run.length === 1 ? (
          <circle
            key={run[0].i}
            cx={2 + run[0].i * step}
            cy={y(run[0].v!)}
            r={1.8}
            fill="var(--signal)"
          />
        ) : (
          <polyline
            key={run[0].i}
            points={run.map(p => `${(2 + p.i * step).toFixed(1)},${y(p.v!).toFixed(1)}`).join(' ')}
            fill="none"
            stroke="var(--signal)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )
      )}
    </svg>
  )
}
