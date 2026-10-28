import type { DailyWeather, GeoPoint, WeatherWindow } from '@repo/shared'

export type FetchWeather = (point: GeoPoint) => Promise<WeatherWindow>

const DAILY = [
  'temperature_2m_mean',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'relative_humidity_2m_mean',
].join(',')

interface OpenMeteoDaily {
  daily?: {
    time: string[]
    temperature_2m_mean: (number | null)[]
    temperature_2m_max: (number | null)[]
    temperature_2m_min: (number | null)[]
    precipitation_sum: (number | null)[]
    relative_humidity_2m_mean: (number | null)[]
  }
}

// Open-Meteo daily forecast (free, no key; attribution in WEATHER_SOURCE): the last 14 days and
// the next 14, for a district centre. Cached per point for three hours, so a burst of reports
// makes one call; a failed call is not cached.
export function openMeteo({
  fetchImpl = fetch,
  ttlMs = 3 * 3_600_000,
  now = Date.now,
}: { fetchImpl?: typeof fetch; ttlMs?: number; now?: () => number } = {}): FetchWeather {
  const cache = new Map<string, { at: number; window: WeatherWindow }>()
  return async ({ latitude, longitude }) => {
    const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`
    const hit = cache.get(key)
    if (hit && now() - hit.at < ttlMs) return hit.window
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(4)}` +
      `&longitude=${longitude.toFixed(4)}&daily=${DAILY}` +
      '&past_days=14&forecast_days=14&timezone=Africa%2FLusaka'
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(8_000) })
    if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`)
    const { daily } = (await response.json()) as OpenMeteoDaily
    if (!daily?.time?.length) throw new Error('Open-Meteo: no daily data')
    const days: DailyWeather[] = daily.time.map((date, i) => ({
      date,
      tmean: daily.temperature_2m_mean[i] ?? null,
      tmax: daily.temperature_2m_max[i] ?? null,
      tmin: daily.temperature_2m_min[i] ?? null,
      rain: daily.precipitation_sum[i] ?? null,
      humidity: daily.relative_humidity_2m_mean[i] ?? null,
    }))
    const window: WeatherWindow = {
      past: days.slice(0, 14),
      forecast: days.slice(14),
      fetched_at: new Date(now()).toISOString(),
    }
    cache.set(key, { at: now(), window })
    return window
  }
}
