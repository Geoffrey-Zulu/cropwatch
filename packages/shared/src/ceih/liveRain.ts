// Real rainfall for a farm added live (Add farm, 1 Nov): the last 30 days at the centroid of its
// traced outline, from the free Open-Meteo archive (no key). It is card data only: it never
// enters eligibility, the loan check or the season's rules, which run on the simulated season.
// The dates are the real calendar's, always written out, so they never blur into the season clock.

export interface LiveRain {
  from: string // YYYY-MM-DD, the first day with data
  to: string // YYYY-MM-DD, the last day with data
  mm: number // one decimal
}

const DAY = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

// The archive lags a few days behind today: ask for 30 days ending two days ago and keep the days
// that have data.
export function liveRainWindow(now: Date) {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 2 * DAY
  return { start: iso(end - 29 * DAY), end: iso(end) }
}

export function liveRainUrl(latitude: number, longitude: number, now: Date) {
  const { start, end } = liveRainWindow(now)
  return (
    `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude.toFixed(4)}` +
    `&longitude=${longitude.toFixed(4)}&start_date=${start}&end_date=${end}` +
    '&daily=precipitation_sum&timezone=Africa%2FLusaka'
  )
}

// The total over the days that carry a value; null when none does (never a made-up number).
export function sumLiveRain(body: unknown): LiveRain | null {
  const daily = (body as { daily?: { time?: unknown; precipitation_sum?: unknown } })?.daily
  const time = Array.isArray(daily?.time) ? (daily.time as unknown[]) : []
  const rain = Array.isArray(daily?.precipitation_sum) ? (daily.precipitation_sum as unknown[]) : []
  const days = time
    .map((t, i) => ({ t, v: rain[i] }))
    .filter(
      (d): d is { t: string; v: number } =>
        typeof d.t === 'string' && typeof d.v === 'number' && Number.isFinite(d.v)
    )
  if (!days.length) return null
  const mm = Math.round(days.reduce((n, d) => n + d.v, 0) * 10) / 10
  return { from: days[0].t, to: days[days.length - 1].t, mm }
}
