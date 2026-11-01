import type { SeasonRow } from '@repo/shared'
import { trpc } from './trpc'

// CEIH on the dashboard: the season's views poll every few seconds so a ground check or a new
// season day shows up while the presenter talks; every action refreshes them at once.
export const SEASON_POLL_MS = 6000

export function useSeasonQueries(orgId: string) {
  const options = { refetchInterval: SEASON_POLL_MS, staleTime: 2000 }
  return {
    portfolio: trpc.season.portfolio.useQuery({ orgId }, options),
  }
}

export function useSeasonRefresh() {
  const utils = trpc.useUtils()
  return () => utils.season.invalidate()
}

// The dates and names live in ./dates, which pulls in no API client (the farmer app uses it).
export { firstName, seasonDate, seasonTime } from './dates'

// The roster as CSV for the credit team: farmer level for this agribusiness (under the farmers'
// contract consent), camp level for places: no pin, no polygon, no phone number.
export function rosterCsv(rows: SeasonRow[]) {
  const header = [
    'farmer',
    'camp',
    'district',
    'crop',
    'hectares',
    'verified',
    'verified_on',
    'eligible',
    'eligibility',
    'cap_zmw',
    'advance',
    'advance_zmw',
    'exposure_zmw',
    'shock_flag',
    'simulated',
  ]
  const cell = (value: string | number | boolean | null) => {
    const text = value === null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const lines = rows.map(r =>
    [
      r.farmer_name,
      r.camp,
      r.district,
      r.crop,
      r.contracted_ha,
      r.verified.label,
      r.verified.date,
      r.eligible,
      r.eligibility_label,
      r.cap_zmw,
      r.advance?.state ?? '',
      r.advance?.amount_zmw ?? '',
      r.exposure_zmw,
      r.shock,
      r.sim,
    ]
      .map(cell)
      .join(',')
  )
  return [header.join(','), ...lines].join('\n')
}

export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
