import { useQuery } from '@tanstack/react-query'
import { CloudRain } from 'lucide-react'
import {
  liveRainUrl,
  liveRainWindow,
  ringCentroid,
  sumLiveRain,
  type FieldCard,
  type LiveRain,
} from '@repo/shared'
import { trpc } from '../../lib/trpc'

// "1 Oct 2026": the real calendar, year always written, so it never reads as the season's clock.
const day = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

// Real rainfall on a farm added live (Add farm): the last 30 days at its outline's centroid, from
// the Open-Meteo archive. The browser asks first; if it is blocked, our API asks; the answer is
// kept for the day. If both fail, nothing renders: never a made-up number. Card data only: it
// does not enter eligibility, the loan check or the season's rules.
export function LiveRainLine({
  orgId,
  card,
  ring,
}: {
  orgId: string
  card: FieldCard
  ring: [number, number][]
}) {
  const utils = trpc.useUtils()
  const rain = useQuery({
    queryKey: ['live-rain', card.contract_id],
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    queryFn: async (): Promise<LiveRain | null> => {
      const now = new Date()
      const key = `phytos-live-rain:${card.contract_id}:${liveRainWindow(now).end}`
      try {
        const kept = localStorage.getItem(key)
        if (kept) return JSON.parse(kept) as LiveRain
      } catch {
        // No storage in this browser: ask again.
      }
      let found: LiveRain | null = null
      try {
        const { latitude, longitude } = ringCentroid(ring)
        const response = await fetch(liveRainUrl(latitude, longitude, now), {
          signal: AbortSignal.timeout(8_000),
        })
        if (response.ok) found = sumLiveRain(await response.json())
      } catch {
        found = null
      }
      if (!found)
        try {
          found = await utils.season.liveRain.fetch({ orgId, contractId: card.contract_id })
        } catch {
          found = null
        }
      if (found)
        try {
          localStorage.setItem(key, JSON.stringify(found))
        } catch {
          // Kept in memory for this visit only.
        }
      return found
    },
  })
  const r = rain.data
  if (!r) return null
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-caption text-fg">
      <CloudRain size={14} aria-hidden className="shrink-0 text-fg-2" />
      <span>
        Rain, {day(r.from)} to {day(r.to)}:{' '}
        <span className="font-semibold tabular-nums">{r.mm.toFixed(1)} mm</span>
      </span>
      <span className="text-fg-2">· Open-Meteo, fetched live</span>
    </p>
  )
}
