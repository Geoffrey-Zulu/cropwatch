import { ISSUE_LABELS, type Crop } from '@repo/shared'
import type { DashObservation } from '../hooks/useLive'

// "If the next 14 days turn dry, which camps need closer monitoring?" (prototype, behind
// VITE_FEATURE_SCENARIO). A qualitative ordering of camps from three inputs, every one shown on
// the page: the Open-Meteo 14-day rain forecast (or the canned dry spell), the crop stage the
// camp's reports were planted at, and the camp's officer-verified reports. No yields, no losses,
// no likelihoods: the bands are an ordering for where to look first.

const DAY = 86_400_000

// Reports from the last 14 days, as on the rest of the Command Center.
export const SCENARIO_WINDOW_DAYS = 14
// Under 10 mm in the next 14 days counts as dry: a Phytos prototype threshold, not a guide's.
export const DRY_THRESHOLD_MM = 10
// Crop stage is read at the middle of the 14-day window.
const STAGE_AT_DAYS_AHEAD = 7

export type ScenarioMode = 'forecast' | 'dry_spell'
export type Concern = 'high' | 'moderate' | 'low' | 'none'
export type Band = 'closer' | 'watch' | 'routine'

export const CONCERN_ORDER: Concern[] = ['none', 'low', 'moderate', 'high']

export interface StageRow {
  crop: Crop
  stage: string
  // Days after planting, at the middle of the window; null `to` means "and later".
  from: number
  to: number | null
  concern: Concern
  watch: string
  // The guide's words, or what Phytos assumes where no guide says it.
  basis: string
  source: string | null
}

const FAW_GUIDE = 'FAO fall armyworm farmer field school guide (2018)'

// The crop-stage vulnerability table: what a dry spell would leave unchecked, by crop and stage.
export const STAGE_TABLE: StageRow[] = [
  {
    crop: 'maize',
    stage: 'Early vegetative',
    from: 0,
    to: 35,
    concern: 'high',
    watch: 'Fall armyworm in the whorl',
    basis:
      '"Early vegetative-stage FAW infestation can cause more leaf damage … than late vegetative stage infestation." "Heavy rains can wash young larvae off leaves, and drown those in the whorl": a dry spell removes that check (Phytos reading).',
    source: FAW_GUIDE,
  },
  {
    crop: 'maize',
    stage: 'Late vegetative',
    from: 36,
    to: 60,
    concern: 'moderate',
    watch: 'Fall armyworm in the whorl',
    basis:
      'Still in the whorl, where heavy rain drowns young larvae; less leaf damage than early infestation (same guide).',
    source: FAW_GUIDE,
  },
  {
    crop: 'maize',
    stage: 'Tasselling and later',
    from: 61,
    to: null,
    concern: 'low',
    watch: 'Fall armyworm on tassels and cobs',
    basis: '"The adult larvae might occasionally move to the tassel and the ears."',
    source: FAW_GUIDE,
  },
  {
    crop: 'tomato',
    stage: 'Any stage in the field',
    from: 0,
    to: null,
    concern: 'high',
    watch: 'Tuta absoluta leaf mines',
    basis: '"Avoid growing tomatoes during the late dry season."',
    source: 'Tuta absoluta management manual (icipe, 2020)',
  },
  {
    crop: 'cassava',
    stage: 'Young (first 3 months)',
    from: 0,
    to: 90,
    concern: 'moderate',
    watch: 'Whiteflies, which spread cassava mosaic',
    basis:
      '"When cassava is young, scout for whiteflies." That dry weather raises whitefly numbers is a Phytos assumption, not from the guide.',
    source: 'Cassava mosaic disease in cassava, Zambia (Plantwise PMDG, 2024)',
  },
  {
    crop: 'cassava',
    stage: 'Older than 3 months',
    from: 91,
    to: null,
    concern: 'low',
    watch: 'Whiteflies, which spread cassava mosaic',
    basis: 'Phytos assumption: older plants are scouted less often in the guide.',
    source: null,
  },
  {
    crop: 'cabbage',
    stage: 'Any stage',
    from: 0,
    to: null,
    concern: 'none',
    watch: 'Diamondback moth',
    basis: 'The diamondback moth guide gives no link to dry weather: not scored.',
    source: null,
  },
  {
    crop: 'soybean',
    stage: 'Any stage',
    from: 0,
    to: null,
    concern: 'none',
    watch: 'No soybean issue in the Phytos vocabulary',
    basis: 'Not scored.',
    source: null,
  },
]

// No planting date on the report: the stage is unknown, so the crop counts at moderate at most
// (tomato does not depend on stage; cabbage and soybean are not scored).
export const UNKNOWN_STAGE_NOTE =
  'No planting date: maize and young-cassava concern counts as moderate at most; tomato does not depend on stage.'

// Issues whose verified reports count: the two the guides tie to dry weather.
export const DRY_FAVOURED = ['fall_armyworm', 'tuta_absoluta'] as const

const VERIFIED = new Set(['FIELD_VERIFIED', 'EXPERT_CONFIRMED'])

export const RULES = [
  'Closer monitoring: dry, and either a high-concern crop stage with at least one verified report, or two or more verified reports.',
  'Watch: dry, and either a moderate or high-concern crop stage or one verified report.',
  'Routine: everything else, including every camp where the forecast is not dry.',
  'Verified reports: fall armyworm or Tuta absoluta, verified by an officer, in the last 14 days. AI-assessed reports do not count.',
]

export interface RainOutlook {
  // Total forecast rain over the next 14 days, mm.
  rainMm: number
  days: number
}

export interface CampScenario {
  camp: string
  district: string
  districtSlug: string
  band: Band
  dry: boolean | null
  rainMm: number | null
  concern: Concern
  stageRow: StageRow | null
  stageUnknown: boolean
  crops: Crop[]
  verified: { issue: (typeof DRY_FAVOURED)[number]; count: number }[]
  reports: number
  sim: boolean
}

export function stageRowFor(crop: Crop, daysAfterPlanting: number) {
  return STAGE_TABLE.find(
    r =>
      r.crop === crop && daysAfterPlanting >= r.from && (r.to === null || daysAfterPlanting <= r.to)
  )
}

function stageOf(report: DashObservation, now: number): { row: StageRow | null; unknown: boolean } {
  if (report.plantingDate) {
    const days = Math.floor(
      (now + STAGE_AT_DAYS_AHEAD * DAY - Date.parse(report.plantingDate)) / DAY
    )
    if (days >= 0) return { row: stageRowFor(report.crop, days) ?? null, unknown: false }
  }
  const rows = STAGE_TABLE.filter(r => r.crop === report.crop)
  if (rows.length === 1) return { row: rows[0], unknown: false }
  // Unknown stage: the crop's row at moderate, if it has one, else its lowest.
  const capped =
    rows.find(r => r.concern === 'moderate') ??
    [...rows].sort((a, b) => CONCERN_ORDER.indexOf(a.concern) - CONCERN_ORDER.indexOf(b.concern))[0]
  return { row: capped ?? null, unknown: true }
}

const higher = (a: Concern, b: Concern) =>
  CONCERN_ORDER.indexOf(a) >= CONCERN_ORDER.indexOf(b) ? a : b

export const campOf = (r: { camp: string | null; district: string }) =>
  r.camp ?? `${r.district} (camp not recorded)`

export function bandFor({
  dry,
  concern,
  verified,
}: {
  dry: boolean | null
  concern: Concern
  verified: number
}): Band {
  if (!dry) return 'routine'
  if ((concern === 'high' && verified >= 1) || verified >= 2) return 'closer'
  if (concern === 'high' || concern === 'moderate' || verified >= 1) return 'watch'
  return 'routine'
}

// Ranks every camp with a report in the window. `rain` is keyed by district slug; a missing
// entry means the forecast could not be fetched (the dry spell still runs without it).
export function campScenarios({
  observations,
  rain,
  mode,
  now,
}: {
  observations: DashObservation[]
  rain: Map<string, RainOutlook>
  mode: ScenarioMode
  now: number
}): CampScenario[] {
  const since = now - SCENARIO_WINDOW_DAYS * DAY
  const camps = new Map<string, DashObservation[]>()
  for (const r of observations) {
    if (Date.parse(r.createdAt) <= since) continue
    const key = `${r.districtSlug}|${campOf(r)}`
    camps.set(key, [...(camps.get(key) ?? []), r])
  }

  const rows: CampScenario[] = []
  for (const reports of camps.values()) {
    const first = reports[0]
    let concern: Concern = 'none'
    let stageRow: StageRow | null = null
    let stageUnknown = false
    for (const r of reports) {
      const { row, unknown } = stageOf(r, now)
      if (row && (stageRow === null || higher(row.concern, concern) !== concern)) {
        concern = row.concern
        stageRow = row
        stageUnknown = unknown
      }
    }
    const verified = DRY_FAVOURED.map(issue => ({
      issue,
      count: reports.filter(r => r.issue === issue && VERIFIED.has(r.verification)).length,
    })).filter(v => v.count > 0)
    const outlook = rain.get(first.districtSlug)
    const dry = mode === 'dry_spell' ? true : outlook ? outlook.rainMm < DRY_THRESHOLD_MM : null
    rows.push({
      camp: campOf(first),
      district: first.district,
      districtSlug: first.districtSlug,
      band: bandFor({ dry, concern, verified: verified.reduce((n, v) => n + v.count, 0) }),
      dry,
      rainMm: outlook ? outlook.rainMm : null,
      concern,
      stageRow,
      stageUnknown,
      crops: [...new Set(reports.map(r => r.crop))],
      verified,
      reports: reports.length,
      sim: reports.some(r => r.sim),
    })
  }

  const BAND_ORDER: Band[] = ['closer', 'watch', 'routine']
  const verifiedCount = (c: CampScenario) => c.verified.reduce((n, v) => n + v.count, 0)
  return rows.sort(
    (a, b) =>
      BAND_ORDER.indexOf(a.band) - BAND_ORDER.indexOf(b.band) ||
      verifiedCount(b) - verifiedCount(a) ||
      CONCERN_ORDER.indexOf(b.concern) - CONCERN_ORDER.indexOf(a.concern) ||
      a.camp.localeCompare(b.camp)
  )
}

export const verifiedText = (v: CampScenario['verified'][number]) =>
  `${v.count} verified ${ISSUE_LABELS[v.issue].replace(/ \(.*\)$/, '')}`
