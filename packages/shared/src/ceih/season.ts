import { SEASON_PHASE_DATES, type SeasonPhase } from '../constants/ceih'

// The demo's season calendar (docs/ceih-overnight-plan.md §4). The real clock shifted by whole
// days: the date lands in the season (January for the advance, March for the drought trigger,
// June for the harvest) while the time of day stays real, so "a minute ago" still reads right.
// In production the offset is 0 and the season calendar is the calendar.

const DAY_MS = 86_400_000

export function seasonNow(realNow: Date | string | number, offsetDays: number): string {
  return new Date(new Date(realNow).getTime() + offsetDays * DAY_MS).toISOString()
}

// Whole days from the real (UTC) date to the phase's season date.
export function offsetForPhase(phase: SeasonPhase, realNow: Date | string | number): number {
  const real = new Date(realNow)
  const realDay = Date.UTC(real.getUTCFullYear(), real.getUTCMonth(), real.getUTCDate())
  return Math.round((Date.parse(`${SEASON_PHASE_DATES[phase]}T00:00:00Z`) - realDay) / DAY_MS)
}

// YYYY-MM-DD of an ISO time (UTC).
export const dateOf = (iso: string) => new Date(iso).toISOString().slice(0, 10)

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10)
}

// Days from a to b (fractional; negative when b is earlier). Dates or ISO times.
export function daysBetween(a: string, b: string): number {
  const at = (s: string) => Date.parse(s.length === 10 ? `${s}T00:00:00Z` : s)
  return (at(b) - at(a)) / DAY_MS
}
