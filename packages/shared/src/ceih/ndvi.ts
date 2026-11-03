import {
  CAMP_MEDIAN_TOLERANCE,
  DEFAULT_ESTABLISHMENT_NDVI,
  EMERGENCE_DAYS,
  ESTABLISHMENT_NDVI,
  NDVI_DROP,
  NOT_PLANTED_NDVI,
  type SatelliteStatus,
} from '../constants/ceih'
import type { Crop } from '../constants/crops'
import type { SatellitePass } from '../schemas/ceih'
import { daysBetween } from './season'

// What a field's curve says (spec W2.3). Thresholds on NDVI against the crop calendar and the
// camp median, nothing more: no model, no score (invariant 12). Satellites see stress, never
// its cause.

export const establishmentNdvi = (crop: Crop) =>
  ESTABLISHMENT_NDVI[crop] ?? DEFAULT_ESTABLISHMENT_NDVI

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  return Math.round(value * 1000) / 1000
}

type PassReading = Pick<SatellitePass, 'date' | 'ndvi' | 'ndvi_camp_median' | 'usable'>

// The status at one pass, given the field's previous clear pass.
export function statusAt(
  pass: PassReading,
  previous: PassReading | null,
  plantingDate: string,
  crop: Crop
): SatelliteStatus {
  if (!pass.usable || pass.ndvi === null) return 'no_data'
  const emerged = daysBetween(plantingDate, pass.date) >= EMERGENCE_DAYS
  const camp = pass.ndvi_camp_median
  // Flat near bare soil past the expected emergence, while the camp has established.
  if (emerged && pass.ndvi < NOT_PLANTED_NDVI && (camp === null || camp >= establishmentNdvi(crop)))
    return 'not_planted'
  if (previous?.ndvi != null) {
    const fieldChange = pass.ndvi - previous.ndvi
    const campChange =
      camp !== null && previous.ndvi_camp_median !== null ? camp - previous.ndvi_camp_median : 0
    if (fieldChange <= -NDVI_DROP)
      return campChange <= -NDVI_DROP / 2 ? 'shared_stress' : 'field_stress'
  }
  // Well behind the camp after emergence: stress on this field.
  if (emerged && camp !== null && pass.ndvi < camp - 2 * CAMP_MEDIAN_TOLERANCE)
    return 'field_stress'
  return 'established'
}

// Passes sorted by date, each with its status recomputed from the clear pass before it.
export function deriveStatuses<P extends PassReading & { status_derived: SatelliteStatus }>(
  passes: P[],
  plantingDate: string,
  crop: Crop
): P[] {
  let previous: PassReading | null = null
  return [...passes]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(pass => {
      const status_derived = statusAt(pass, previous, plantingDate, crop)
      if (pass.usable && pass.ndvi !== null) previous = pass
      return { ...pass, status_derived }
    })
}

// What the system knew on a season day: passes up to and including that date, oldest first.
export function visiblePasses<P extends { date: string }>(passes: P[], today: string): P[] {
  const day = today.slice(0, 10)
  return passes.filter(p => p.date <= day).sort((a, b) => a.date.localeCompare(b.date))
}

// The status of the latest clear pass, or no_data.
export function latestStatus(
  passes: Pick<SatellitePass, 'usable' | 'status_derived'>[]
): SatelliteStatus {
  for (let i = passes.length - 1; i >= 0; i--) {
    if (passes[i].usable) return passes[i].status_derived
  }
  return 'no_data'
}
