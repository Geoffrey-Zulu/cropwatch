import type { KnownIssue } from './constants/issues'

// Weather context for Risk Model v0 (technicaldoc §9): forecast conditions that the corpus links
// to an issue. The guides give the link in words; the numeric cut-offs that turn a forecast into
// "these conditions" are Phytos prototype thresholds, and every factor says so on the dashboard.
// Weather never sets a district's level in v0: it is context, and it raises weather advisories.
// Phrased as "conditions favour", never as a prediction (invariant 2).

export const WEATHER_SOURCE = {
  name: 'Open-Meteo',
  url: 'https://open-meteo.com/',
  licence: 'Weather data by Open-Meteo.com (CC BY 4.0)',
} as const

export interface DailyWeather {
  date: string // YYYY-MM-DD, Africa/Lusaka
  tmean: number | null // °C
  tmax: number | null
  tmin: number | null
  rain: number | null // mm
  humidity: number | null // daily mean relative humidity
}

export interface WeatherWindow {
  // The last 14 days (oldest first), then today and the next 13.
  past: DailyWeather[]
  forecast: DailyWeather[]
  fetched_at: string
}

export interface WeatherNote {
  issue: KnownIssue
  // What the guide says, short.
  guide: string
  // The corpus document it comes from (tools/corpus/manifest.json id).
  document_id: string
  document_title: string
  tier: number
  // The prototype rule that operationalises it, in words.
  threshold: string
}

export const WEATHER_NOTES: Record<
  'late_blight' | 'early_blight' | 'tuta_absoluta' | 'fall_armyworm',
  WeatherNote
> = {
  late_blight: {
    issue: 'late_blight',
    guide: 'the disease shows in humid weather',
    document_id: 'pw-pmdg-late-blight-tomato-zambia-2021',
    document_title: 'Late blight on tomato, Zambia (Plantwise PMDG, 2021)',
    tier: 5,
    threshold: '3 or more of the next 7 days with mean humidity of 85 or above',
  },
  early_blight: {
    issue: 'early_blight',
    guide: 'outbreaks often follow a period of heavy rainfall',
    document_id: 'pw-pmdg-early-blight-tomato-zambia-2014',
    document_title: 'Early blight fungal disease in tomato, Zambia (Plantwise PMDG, 2014)',
    tier: 5,
    threshold: 'a day with 20 mm of rain or more in the last 7 or the next 7 days',
  },
  tuta_absoluta: {
    issue: 'tuta_absoluta',
    guide: 'avoid growing tomato in the late dry season',
    document_id: 'icipe-tuta-absoluta-manual-2020',
    document_title: 'Tuta absoluta management manual (icipe, 2020)',
    tier: 6,
    threshold: 'August to November with under 10 mm of rain in the last 14 days',
  },
  fall_armyworm: {
    issue: 'fall_armyworm',
    guide: 'larvae develop fastest near 28 °C',
    document_id: 'fao-cabi-faw-tot-manual-2019',
    document_title: 'FAW training of trainers manual (FAO and CABI, 2019), section 2.6',
    tier: 4,
    threshold: '5 or more of the next 7 days with a mean of 24 to 30 °C',
  },
}

export interface WeatherCondition {
  issue: KnownIssue
  favourable: boolean
  // What the forecast shows, in words, e.g. "1 mm of rain in the last 14 days".
  observed: string
  note: WeatherNote
}

const sum = (values: (number | null)[]) => values.reduce<number>((t, v) => t + (v ?? 0), 0)
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

// The forecast against each issue's note. Missing days count as not meeting the rule.
export function weatherConditions(window: WeatherWindow): WeatherCondition[] {
  const next7 = window.forecast.slice(0, 7)
  const last7 = window.past.slice(-7)
  const month = Number((window.forecast[0]?.date ?? window.fetched_at).slice(5, 7))

  const humid = next7.filter(d => (d.humidity ?? 0) >= 85).length
  const wettest = [...last7, ...next7].reduce<DailyWeather | null>(
    (best, d) => ((d.rain ?? 0) > (best?.rain ?? 0) ? d : best),
    null
  )
  const rain14 = sum(window.past.map(d => d.rain))
  const warm = next7.filter(d => d.tmean !== null && d.tmean >= 24 && d.tmean <= 30).length

  return [
    {
      issue: 'late_blight',
      favourable: humid >= 3,
      observed: `${humid} of the next 7 days humid`,
      note: WEATHER_NOTES.late_blight,
    },
    {
      issue: 'early_blight',
      favourable: (wettest?.rain ?? 0) >= 20,
      observed: wettest?.rain
        ? `heaviest rain ${fmt(wettest.rain)} mm on ${dayMonth(wettest.date)}`
        : 'no rain in the last or next 7 days',
      note: WEATHER_NOTES.early_blight,
    },
    {
      issue: 'tuta_absoluta',
      favourable: month >= 8 && month <= 11 && rain14 < 10,
      observed: `${fmt(rain14)} mm of rain in the last 14 days`,
      note: WEATHER_NOTES.tuta_absoluta,
    },
    {
      issue: 'fall_armyworm',
      favourable: warm >= 5,
      observed: `${warm} of the next 7 days at a mean of 24 to 30 °C`,
      note: WEATHER_NOTES.fall_armyworm,
    },
  ]
}

// The contributing-factor line for a favourable condition.
export const weatherFactor = (c: WeatherCondition) =>
  `Weather (Open-Meteo): ${c.observed}. Guide note: ${c.note.guide} (${c.note.document_title}).`

function dayMonth(date: string) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return `${Number(date.slice(8, 10))} ${months[Number(date.slice(5, 7)) - 1]}`
}
