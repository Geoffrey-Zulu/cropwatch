import { CloudSun, ExternalLink } from 'lucide-react'
import { ISSUE_LABELS, type DistrictWeather } from '@repo/shared'
import { Muted, Panel } from '../components/Panel'
import { trpc } from '../lib/trpc'

// Weather context (Open-Meteo, attributed): the last 14 days and the next 14 as rain bars and
// mean temperature, and how the forecast reads against each issue's guide note. Context only:
// it never sets a level (Risk Model v0).
export function WeatherSection({ districtSlug }: { districtSlug: string }) {
  const weather = trpc.weather.district.useQuery(
    { districtSlug },
    { staleTime: 30 * 60_000, retry: 1 }
  )
  return (
    <Panel
      eyebrow="Weather context"
      title={weather.data ? `${weather.data.district}: 14 days back, 14 ahead` : 'Weather'}
      actions={<CloudSun size={20} strokeWidth={2} aria-hidden className="text-navy" />}
    >
      {weather.isLoading && <Muted>Fetching the forecast…</Muted>}
      {weather.error && <Muted>The forecast is not available right now.</Muted>}
      {weather.data && <WeatherBody weather={weather.data} />}
    </Panel>
  )
}

function WeatherBody({ weather }: { weather: DistrictWeather }) {
  const days = [...weather.past, ...weather.forecast]
  const maxRain = Math.max(10, ...days.map(d => d.rain ?? 0))
  const temps = days.map(d => d.tmean).filter((t): t is number => t !== null)
  const tMin = Math.min(...temps, 15)
  const tMax = Math.max(...temps, 32)
  const W = 1000
  const H = 150
  const step = W / days.length
  const y = (t: number) => 10 + ((tMax - t) / (tMax - tMin)) * 56
  const line = days
    .map((d, i) => (d.tmean === null ? null : `${i * step + step / 2},${y(d.tmean)}`))
    .filter(Boolean)
    .join(' ')
  const today = weather.past.length * step

  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto max-h-48 w-full"
        role="img"
        aria-label="Daily rain and mean temperature, 14 days back and 14 ahead"
      >
        <rect x={today} y={0} width={W - today} height={H - 14} fill="var(--navy-tint)" />
        {days.map((d, i) => {
          const h = ((d.rain ?? 0) / maxRain) * 60
          return (
            <rect
              key={d.date}
              x={i * step + 2}
              y={H - 16 - h}
              width={step - 4}
              height={h}
              fill="var(--navy)"
            >
              <title>
                {d.date}: {d.rain ?? 0} mm, mean {d.tmean ?? '?'} °C
              </title>
            </rect>
          )
        })}
        <polyline points={line} fill="none" stroke="var(--copper)" strokeWidth={2} />
        <line
          x1={today}
          x2={today}
          y1={0}
          y2={H - 14}
          stroke="var(--ink-2)"
          strokeDasharray="3 3"
        />
        <text x={4} y={H - 2} fontSize={14} className="fill-ink-2 font-mono">
          {weather.past[0]?.date.slice(5)}
        </text>
        <text x={today + 4} y={H - 2} fontSize={14} className="fill-ink-2 font-mono">
          today (forecast)
        </text>
        <text x={W - 4} y={H - 2} fontSize={14} textAnchor="end" className="fill-ink-2 font-mono">
          {weather.forecast[weather.forecast.length - 1]?.date.slice(5)}
        </text>
      </svg>
      <p className="flex flex-wrap gap-x-4 text-caption text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 bg-navy" /> Rain per day (mm)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 bg-copper" /> Mean temperature ({tMin.toFixed(0)}{' '}
          to {tMax.toFixed(0)} °C scale)
        </span>
      </p>

      <ul className="flex flex-col divide-y divide-line">
        {weather.conditions.map(c => (
          <li key={c.issue} className="py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-tag border px-1.5 py-0.5 font-mono text-eyebrow font-semibold uppercase ${
                  c.favourable
                    ? 'border-navy bg-navy-tint text-navy'
                    : 'border-line-strong text-ink-2'
                }`}
              >
                {c.favourable ? 'Conditions favour' : 'Not indicated'}
              </span>
              <span className="font-semibold text-navy">{ISSUE_LABELS[c.issue]}</span>
            </div>
            <p className="mt-1 text-label">
              Forecast: {c.observed}. Guide note: {c.guide} ({c.document_title}).
            </p>
            <p className="text-caption text-ink-2">
              Prototype threshold, set by Phytos: {c.threshold}.
            </p>
          </li>
        ))}
      </ul>
      <a
        href={weather.source.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-caption font-semibold text-navy underline decoration-line-strong underline-offset-2"
      >
        {weather.source.licence}
        <ExternalLink size={12} strokeWidth={2} aria-hidden />
      </a>
    </div>
  )
}
