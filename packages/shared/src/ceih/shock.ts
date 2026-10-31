import {
  NDVI_DROP,
  SHOCK_FALLING_SHARE,
  SHOCK_LOOKBACK_DAYS,
  SHOCK_RAIN_30D_MM,
} from '../constants/ceih'
import type { SatellitePass } from '../schemas/ceih'
import { ndviText } from './format'
import { addDays } from './season'

// The shock trigger (spec W5): one rule a camp, two independent sources that must agree. Rain
// over the last 30 days below the threshold AND the camp median NDVI falling across most fields.
// Rule-based with its data kept (invariant 12); the payout it would start is simulated.

type Pass = Pick<SatellitePass, 'date' | 'ndvi' | 'ndvi_camp_median' | 'usable'>

export interface ShockEvaluation {
  fired: boolean
  window_start: string
  window_end: string
  rain_30d: number
  threshold: number
  median_start: number | null
  median_end: number | null
  fields_falling: number
  fields_total: number
  factors: string[]
}

export function evaluateShock(input: {
  today: string
  rain: { date: string; rain_mm: number }[]
  // Each field's passes up to today.
  fields: Pass[][]
}): ShockEvaluation {
  const window_end = input.today.slice(0, 10)
  const window_start = addDays(window_end, -SHOCK_LOOKBACK_DAYS + 1)
  const within = (date: string) => date >= window_start && date <= window_end
  const rain_30d =
    Math.round(input.rain.filter(d => within(d.date)).reduce((sum, d) => sum + d.rain_mm, 0) * 10) /
    10

  let fields_falling = 0
  let median_start: number | null = null
  let median_end: number | null = null
  let startDate = '9999'
  let endDate = ''
  for (const passes of input.fields) {
    const clear = passes.filter(p => within(p.date) && p.usable && p.ndvi !== null)
    if (clear.length >= 2 && clear[clear.length - 1].ndvi! - clear[0].ndvi! <= -NDVI_DROP)
      fields_falling++
    for (const p of passes.filter(q => within(q.date) && q.ndvi_camp_median !== null)) {
      if (p.date < startDate) [startDate, median_start] = [p.date, p.ndvi_camp_median]
      if (p.date > endDate) [endDate, median_end] = [p.date, p.ndvi_camp_median]
    }
  }
  const fields_total = input.fields.length
  const dry = rain_30d < SHOCK_RAIN_30D_MM
  const falling = fields_total > 0 && fields_falling / fields_total >= SHOCK_FALLING_SHARE
  const medianFell =
    median_start !== null && median_end !== null && median_end <= median_start - NDVI_DROP

  return {
    fired: dry && falling && medianFell,
    window_start,
    window_end,
    rain_30d,
    threshold: SHOCK_RAIN_30D_MM,
    median_start,
    median_end,
    fields_falling,
    fields_total,
    factors: [
      `Rain over 30 days: ${rain_30d} mm, ${dry ? 'below' : 'above'} the ${SHOCK_RAIN_30D_MM} mm rule`,
      median_start !== null && median_end !== null
        ? `Camp median NDVI ${ndviText(median_start)} to ${ndviText(median_end)} · ${fields_falling} of ${fields_total} fields falling`
        : `No clear passes in the window · ${fields_falling} of ${fields_total} fields falling`,
    ],
  }
}
