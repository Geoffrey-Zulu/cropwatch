import { findDistrict } from '@repo/shared'
import type { RainOutlook } from './scenario'

interface OpenMeteoDaily {
  daily?: { time: string[]; precipitation_sum: (number | null)[] }
}

// The next 14 days of forecast rain per district, straight from Open-Meteo (free, no key, CORS)
// in one request for every district: the scenario never calls the Phytos API, so it cannot slow
// the demo path. Districts outside the shared list are skipped.
export async function fetchRainOutlook(
  districtSlugs: string[],
  fetchImpl: typeof fetch = fetch
): Promise<Map<string, RainOutlook>> {
  const points = [...new Set(districtSlugs)]
    .map(slug => findDistrict(slug))
    .filter(d => d !== undefined)
  if (points.length === 0) return new Map()
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${points.map(d => d.center.latitude.toFixed(4)).join(',')}` +
    `&longitude=${points.map(d => d.center.longitude.toFixed(4)).join(',')}` +
    '&daily=precipitation_sum&forecast_days=14&timezone=Africa%2FLusaka'
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`Open-Meteo answered ${response.status}`)
  const body = (await response.json()) as OpenMeteoDaily | OpenMeteoDaily[]
  // One location comes back as an object, several as an array in request order.
  const results = Array.isArray(body) ? body : [body]
  const outlook = new Map<string, RainOutlook>()
  points.forEach((district, i) => {
    const rain = results[i]?.daily?.precipitation_sum
    if (!rain?.length) return
    outlook.set(district.slug, {
      rainMm: Math.round(rain.reduce<number>((sum, mm) => sum + (mm ?? 0), 0) * 10) / 10,
      days: rain.length,
    })
  })
  return outlook
}
