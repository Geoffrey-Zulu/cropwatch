// CEIH demo season (docs/ceih-overnight-plan.md, Phase 1): DEMO OUTGROWER CO.'s 120 soya
// contracts in three Monze camps, their weekly satellite curves, ground checks, advances, ledger,
// June deliveries and a demo rainfall series. Every row is sim: true and fictional. Dates are on
// the demo's season calendar (January for the advance); ceih_demo/{org} maps it to the real clock.
//
// The storylines (plan §4): Given Mweemba is one ground check short of eligible (one clear pass in
// 21 days, two clouded out); his neighbour Joseph Hamoonga never planted; two advances wait for
// approval; Hamangaba is armed for the drought trigger (dry from mid-February, its curves falling
// into March); a few Keemba farms deliver far short in June with no shock and no verified problem.
import {
  ADVANCE_FEE_PCT,
  CAP_PCT_DEFAULT,
  CEIH_SEASON,
  daysBetween,
  deriveStatuses,
  evaluateEligibility,
  feeFor,
  ringCentroid,
  ringPolygon,
  fieldRadiusM,
  findDistrict,
  geohash,
  HARD_CEILING_ZMW,
  median,
  offsetForPhase,
  priceDelivery,
  SATELLITE_COLLECTION,
  seasonNow,
  severityBand,
  simPhotoPath,
  visiblePasses,
  zmw,
  AdvanceSchema,
  CeihDemoStateSchema,
  ContractSchema,
  DeliverySchema,
  DiagnosisInternalSchema,
  FarmerSchema,
  LedgerEntrySchema,
  ObservationSchema,
  RainfallSeriesSchema,
  SatelliteMetricsSchema,
  UserProfileSchema,
  addDays,
  type Advance,
  type CeihDemoState,
  type Contract,
  type CreditConfig,
  type Delivery,
  type DiagnosisInternal,
  type Eligibility,
  type Farmer,
  type GeoPoint,
  type Grade,
  type LedgerEntry,
  type Observation,
  type RainfallSeries,
  type Recommendation,
  type SatelliteMetrics,
  type UserProfile,
} from '@repo/shared'
import { DEMO_ORG_ID, SIM_STAMP } from './generate'
import { personName } from './names'
import { createRandom, offset } from './random'
import { cannedRecommendation } from './recommendations'

export const CEIH_SEED = 20261031
const DISTRICT = findDistrict('Monze')!
// Contract price for soya, a tonne. PLACEHOLDER until the agribusiness sets it.
const PRICE_ZMW_T = 8000
// Input package on loan, a hectare (seed, inoculant, fertiliser). PLACEHOLDER.
const INPUTS_ZMW_HA = 3900

export const CREDIT: CreditConfig = {
  cap_pct: CAP_PCT_DEFAULT,
  hard_ceiling_zmw: HARD_CEILING_ZMW,
  advance_fee_pct: ADVANCE_FEE_PCT,
}

export const BANDA = 'sim-officer-ceih-banda'
const MOONO = 'sim-officer-ceih-moono'
export const CREDIT_APPROVER = 'sim-credit-ceih-lungu'

interface Camp {
  name: string
  // On smallholder farmland in the Esri World Imagery (looked at 31 Oct): the Fields map draws
  // the camp's fields over the real ground there.
  center: GeoPoint
  // The grain of the field strips around it, degrees from east.
  grain: number
  officer: string
  drought: boolean
}
export const CAMPS: Camp[] = [
  {
    name: 'Chikuni',
    center: { latitude: -16.171, longitude: 27.374 },
    grain: 12,
    officer: BANDA,
    drought: false,
  },
  {
    name: 'Keemba',
    center: { latitude: -16.384, longitude: 27.5475 },
    grain: -28,
    officer: MOONO,
    drought: false,
  },
  {
    name: 'Hamangaba',
    center: { latitude: -16.2137, longitude: 27.6635 },
    grain: 32,
    officer: MOONO,
    drought: true,
  },
]

type Archetype =
  | 'given'
  | 'neighbour'
  | 'disbursed'
  | 'awaiting'
  | 'eligible'
  | 'officer'
  | 'cloud_gap'
  | 'not_planted'
  | 'stress_open'
  | 'stress_treated'
  | 'no_consent'
  | 'momo'
  | 'defaulted'

// 118 besides Given and his neighbour.
const MIX: [Archetype, number][] = [
  ['disbursed', 10],
  ['awaiting', 2],
  ['eligible', 32],
  ['officer', 8],
  ['cloud_gap', 45],
  ['not_planted', 5],
  ['stress_open', 3],
  ['stress_treated', 3],
  ['no_consent', 3],
  ['momo', 3],
  ['defaulted', 4],
]

// Weekly passes over the season; three fall in Given's 21 days (26 Dec, 2 Jan, 9 Jan).
export const PASS_DATES: string[] = (() => {
  const dates: string[] = []
  for (let d = '2026-10-03'; d <= '2027-06-30'; d = addDays(d, 7)) dates.push(d)
  return dates
})()
const WINDOW = ['2026-12-26', '2027-01-02', '2027-01-09']

export interface CeihOptions {
  // Real "now" of the arming: January's demo day maps onto it.
  realNow: string
  // Given's field: the venue for the live capture-app beat; Chikuni otherwise.
  givenPin?: GeoPoint | null
  // The demo phone: Given's number, and the only number real SMS may go to.
  demoPhone?: string | null
}

export interface CeihSeed {
  realNow: string
  today: string
  state: { id: string; data: CeihDemoState }
  credit: CreditConfig
  users: { id: string; profile: UserProfile }[]
  farmers: { id: string; data: Farmer; archetype: Archetype }[]
  contracts: { id: string; data: Contract }[]
  metrics: { id: string; data: SatelliteMetrics }[]
  advances: { id: string; data: Advance }[]
  ledger: { id: string; data: LedgerEntry }[]
  deliveries: { id: string; data: Delivery }[]
  rainfall: { id: string; data: RainfallSeries }[]
  observations: {
    id: string
    observation: Observation
    internal: DiagnosisInternal | null
    recommendation: { id: string; data: Recommendation } | null
  }[]
}

const pad = (n: number) => String(n).padStart(3, '0')
const at = (date: string, hour: number, minute = 0) =>
  `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`

export function generateCeih(options: CeihOptions): CeihSeed {
  const r = createRandom(CEIH_SEED)
  const offsetDays = offsetForPhase('january', options.realNow)
  const today = seasonNow(options.realNow, offsetDays)
  // A season time back on the real clock (observations keep real created_at).
  const toReal = (season: string) => seasonNow(season, -offsetDays)

  // Archetypes: Given and Joseph first (Chikuni), the rest shuffled across the camps.
  const tokens: Archetype[] = MIX.flatMap(([a, n]) => Array<Archetype>(n).fill(a))
  for (let i = tokens.length - 1; i > 0; i--) {
    const j = Math.floor(r.next() * (i + 1))
    ;[tokens[i], tokens[j]] = [tokens[j], tokens[i]]
  }
  // Chikuni has exactly two fields never planted, Joseph's and one more: the Fields map's two
  // grey holes among the green.
  const chikuniBare = () => tokens.slice(0, 38).filter(t => t === 'not_planted').length
  while (chikuniBare() > 1) {
    const from = tokens.slice(0, 38).lastIndexOf('not_planted')
    const to = tokens.findIndex((t, k) => k >= 38 && t === 'cloud_gap')
    ;[tokens[from], tokens[to]] = [tokens[to], tokens[from]]
  }
  if (chikuniBare() === 0) {
    const from = tokens.findIndex((t, k) => k >= 38 && t === 'not_planted')
    const to = tokens.slice(0, 38).lastIndexOf('cloud_gap')
    ;[tokens[from], tokens[to]] = [tokens[to], tokens[from]]
  }
  const roster: { archetype: Archetype; camp: Camp }[] = [
    { archetype: 'given', camp: CAMPS[0] },
    { archetype: 'neighbour', camp: CAMPS[0] },
    ...tokens.map((archetype, i) => ({
      archetype,
      camp: i < 38 ? CAMPS[0] : i < 78 ? CAMPS[1] : CAMPS[2],
    })),
  ]
  // Side-sellers: two Keemba farms that will deliver far short in June.
  const keemba = roster
    .map((x, i) => ({ ...x, i }))
    .filter(x => x.camp.name === 'Keemba' && ['eligible', 'cloud_gap'].includes(x.archetype))
  const sideSellers = new Set([keemba[3].i, keemba[11].i])

  // Hectares, then the fields themselves: strips in rows over each camp's farmland.
  const sizes = createRandom(CEIH_SEED + 1)
  const hectares = roster.map(({ archetype }) =>
    archetype === 'given'
      ? 0.5
      : archetype === 'neighbour'
        ? 1.5
        : Math.round(sizes.between(0.5, 3) * 4) / 4
  )
  const layout = layoutFields(roster, hectares, createRandom(CEIH_SEED + 2), options.givenPin)

  const farmers: CeihSeed['farmers'] = []
  const contracts: CeihSeed['contracts'] = []
  const truths: { curve: (date: string) => number; clouds: Map<string, boolean> }[] = []
  const usedNames = new Set<string>()

  roster.forEach(({ archetype, camp }, i) => {
    const id = pad(i + 1)
    const farmerId = `sim-ceih-farmer-${id}`
    const contractId = `sim-ceih-contract-${id}`
    let name =
      archetype === 'given'
        ? 'Given Mweemba'
        : archetype === 'neighbour'
          ? 'Joseph Hamoonga'
          : personName(r, 'Southern')
    while (usedNames.has(name)) name = personName(r, 'Southern')
    usedNames.add(name)

    const ha = hectares[i]
    const yieldTHa = archetype === 'given' ? 1.4 : Math.round(r.between(1.2, 1.8) * 10) / 10
    const { pin, polygon } = layout[i]
    // Early planters reach the establishment line inside the window; late ones may not.
    const early = [
      'given',
      'disbursed',
      'awaiting',
      'eligible',
      'no_consent',
      'momo',
      'defaulted',
    ].includes(archetype)
    const planting =
      archetype === 'given'
        ? '2026-11-18'
        : addDays(early ? '2026-11-06' : '2026-11-08', r.int(0, early ? 8 : 16))
    const consentAt = at(addDays('2026-10-06', r.int(0, 12)), r.int(7, 15), r.int(0, 59))
    const inputsAt = at(addDays('2026-10-16', r.int(0, 14)), r.int(7, 15), r.int(0, 59))

    farmers.push({
      id: farmerId,
      archetype,
      data: FarmerSchema.parse({
        name,
        phone_msisdn:
          archetype === 'given' && options.demoPhone
            ? options.demoPhone
            : `+260971${String(100000 + i).slice(-6)}`,
        momo_provider: archetype === 'given' || r.chance(0.65) ? 'airtel' : 'mtn',
        momo_verified: archetype !== 'momo',
        org_id: DEMO_ORG_ID,
        camp: camp.name,
        district: DISTRICT.name,
        province: DISTRICT.province,
        consent:
          archetype === 'no_consent'
            ? null
            : { given_at: consentAt, scope: 'org_contract', officer_id: camp.officer },
        field_pin: pin,
        // The walked boundary: it replaces the circle rule for this farm.
        field_polygon: polygon,
        claimed_ha: ha,
        history:
          archetype === 'defaulted'
            ? { seasons: r.int(1, 3), defaults: 1, last_recovery_pct: r.int(40, 70) }
            : archetype === 'given'
              ? { seasons: 2, defaults: 0, last_recovery_pct: 100 }
              : { seasons: r.int(0, 4), defaults: 0, last_recovery_pct: null },
        sim: true,
      }),
    })
    const projected = Math.round(ha * yieldTHa * PRICE_ZMW_T)
    contracts.push({
      id: contractId,
      data: ContractSchema.parse({
        farmer_id: farmerId,
        org_id: DEMO_ORG_ID,
        season: CEIH_SEASON,
        crop: 'soybean',
        camp: camp.name,
        district: DISTRICT.name,
        planting_date: planting,
        contracted_ha: ha,
        projected_yield_t_ha: yieldTHa,
        contract_price_zmw_t: PRICE_ZMW_T,
        projected_value_zmw: projected,
        input_loan_zmw: archetype === 'given' ? 1950 : Math.round((ha * INPUTS_ZMW_HA) / 10) * 10,
        inputs_delivered: { at: inputsAt, photo_path: null, otp_confirmed: true },
        field_polygon: polygon,
        status: 'active',
        shock_flag: null,
        side_sell_suspected: false,
        sim: true,
      }),
    })

    // The field's true greenness on a date.
    const peak = r.between(0.68, 0.8)
    const mid = r.between(44, 50)
    const stressFrom = '2027-01-05'
    const curve = (date: string) => {
      const noise = (r.next() - 0.5) * 0.03
      if (archetype === 'neighbour' || archetype === 'not_planted') return 0.145 + noise / 2
      const d = daysBetween(planting, date)
      if (d < 0) return 0.15 + noise / 2
      let v = 0.15 + (peak - 0.15) / (1 + Math.exp(-(d - mid) / 8.5))
      if (d > 128) v -= 0.0065 * (d - 128)
      if (archetype.startsWith('stress') && date >= stressFrom)
        v -= Math.min(0.13, 0.13 * (daysBetween(stressFrom, date) / 4 + 0.6))
      if (camp.drought && date >= '2027-02-10')
        v -= Math.min(0.32, 0.0068 * daysBetween('2027-02-10', date))
      return Math.max(0.1, v + noise)
    }
    // Clouds: the season's odds, then each storyline's three passes in the window.
    const clouds = new Map<string, boolean>()
    for (const date of PASS_DATES) {
      const month = Number(date.slice(5, 7))
      const odds =
        camp.drought && date >= '2027-02-10' && date <= '2027-03-31'
          ? 0.08
          : ((
              { 10: 0.08, 11: 0.2, 12: 0.45, 1: 0.5, 2: 0.4, 3: 0.25, 4: 0.1 } as Record<
                number,
                number
              >
            )[month] ?? 0.05)
      clouds.set(date, r.chance(odds))
    }
    const pattern: boolean[] =
      archetype === 'given'
        ? [true, true, false]
        : ['officer', 'cloud_gap'].includes(archetype)
          ? r.pick([
              [true, true, false],
              [false, true, true],
              [true, false, true],
              [true, true, true],
            ])
          : ['neighbour', 'not_planted'].includes(archetype)
            ? // Clear on the last two passes, so the flat curve reads as not planted.
              [true, false, false]
            : r.pick([
                [false, false, false],
                [true, false, false],
              ])
    WINDOW.forEach((date, k) => clouds.set(date, pattern[k]))
    // Given's curve tells the story plainly: clear skies through his crop's rise, then the two
    // clouded passes the ground check makes up for.
    if (archetype === 'given')
      for (const date of PASS_DATES)
        if (date >= '2026-10-24' && date < WINDOW[0]) clouds.set(date, false)
    truths.push({ curve, clouds })
  })

  // Passes with camp medians across the clear fields of each camp, then statuses.
  const computedAt = at('2027-01-10', 6)
  const raw = truths.map(({ curve, clouds }) =>
    PASS_DATES.map(date => {
      const clouded = clouds.get(date)!
      const value = curve(date)
      return {
        date,
        ndvi: clouded ? null : Math.round(value * 100) / 100,
        cloud_pct: clouded ? r.int(68, 100) : r.int(0, 14),
        usable: !clouded,
      }
    })
  )
  const medians = new Map<string, number | null>()
  for (const camp of CAMPS) {
    const members = contracts.map((c, i) => ({ c, i })).filter(x => x.c.data.camp === camp.name)
    PASS_DATES.forEach((date, k) => {
      const values = members.flatMap(({ i }) => (raw[i][k].ndvi === null ? [] : [raw[i][k].ndvi!]))
      medians.set(`${camp.name}|${date}`, values.length >= 3 ? median(values) : null)
    })
  }
  const metrics = contracts.map((c, i) => ({
    id: c.id,
    data: SatelliteMetricsSchema.parse({
      contract_id: c.id,
      org_id: DEMO_ORG_ID,
      camp: c.data.camp,
      source: 'seeded',
      passes: deriveStatuses(
        raw[i].map(p => ({
          ...p,
          ndvi_camp_median: medians.get(`${c.data.camp}|${p.date}`) ?? null,
          collection: SATELLITE_COLLECTION,
          computed_at: computedAt,
          status_derived: 'no_data' as const,
          sim: true,
        })),
        c.data.planting_date,
        'soybean'
      ),
      sim: true,
    }),
  }))

  // Ground checks and issues, on the season calendar (season_at) with real created_at.
  const observations: CeihSeed['observations'] = []
  const groundCheck = (i: number, when: string, issue: 'fall_armyworm' | null, treated = false) => {
    const f = farmers[i]
    const c = contracts[i]
    const camp = CAMPS.find(x => x.name === c.data.camp)!
    const id = `sim-ceih-obs-${pad(i + 1)}-${observations.filter(o => o.id.includes(`-${pad(i + 1)}-`)).length + 1}`
    const location = offset(
      f.data.field_pin,
      r.between(0, fieldRadiusM(f.data.claimed_ha) / 1000) * 0.3,
      r.between(0, 2 * Math.PI)
    )
    const severityPct = issue ? r.int(45, 65) : null
    const recommendation = issue ? cannedRecommendation(id, issue, toReal(when)) : null
    const createdAt = toReal(when)
    const observation = ObservationSchema.parse({
      reporter_id: camp.officer,
      reporter_role: 'field_officer',
      org_id: DEMO_ORG_ID,
      created_at: createdAt,
      location,
      geohash: geohash(location.latitude, location.longitude),
      district: DISTRICT.name,
      district_slug: DISTRICT.slug,
      province: DISTRICT.province,
      camp: c.data.camp,
      crop: 'soybean',
      planting_date: c.data.planting_date,
      growth_stage: r.pick(['V3', 'V4', 'V4', 'V5']),
      photo_paths: [
        simPhotoPath(
          issue
            ? r.pick([
                'library-fall_armyworm-01',
                'library-fall_armyworm-02',
                'library-fall_armyworm-03',
              ])
            : 'library-unknown-03'
        ),
      ],
      farmer_description: issue
        ? 'Ground check: windows in the leaves and frass in the whorls across a third of the field.'
        : r.pick([
            'Ground check: even stand, good colour, no pest seen.',
            'Ground check: crop established, rows closing, weeds under control.',
            'Ground check: stand thinner on the low side after the December rains, otherwise healthy.',
          ]),
      status: 'complete',
      diagnosis: issue
        ? {
            suspected_issue: issue,
            confidence_band: 'high',
            severity_band: severityBand(severityPct!),
            visible_symptoms: ['Windowing on young leaves', 'Frass in the whorl'],
            needs_expert_review: false,
            expert_review_reason: null,
            ...SIM_STAMP,
            diagnosed_at: createdAt,
          }
        : null,
      verification_state: 'FIELD_VERIFIED',
      verified_by: camp.officer,
      verified_issue: issue,
      recommendation_id: recommendation ? `${id}-rec` : null,
      intervention: treated
        ? {
            applied_at: toReal(addDays(when.slice(0, 10), 2) + 'T09:00:00.000Z'),
            type: 'cultural',
            products: [],
            notes: 'Larvae and egg masses removed by hand; field re-checked after 7 days.',
          }
        : null,
      outcome: null,
      farmer_id: f.id,
      geofence_ok: true,
      source: issue ? 'satellite_task' : 'officer',
      season_at: when,
      sim: true,
    })
    observations.push({
      id,
      observation,
      internal: issue
        ? DiagnosisInternalSchema.parse({
            model_confidence: 0.86,
            severity_pct: severityPct,
            reasoning_summary: 'Simulated diagnosis (seed data); no model was called.',
            model_crop: 'soybean',
            model_growth_stage: observation.growth_stage,
            invalid_output: null,
            attempts: 1,
            ...SIM_STAMP,
            created_at: createdAt,
          })
        : null,
      recommendation: recommendation && { id: `${id}-rec`, data: recommendation },
    })
  }
  farmers.forEach((f, i) => {
    if (f.archetype === 'officer')
      groundCheck(i, at(addDays('2027-01-03', r.int(0, 7)), r.int(8, 15), r.int(0, 59)), null)
    if (f.archetype === 'stress_open')
      groundCheck(
        i,
        at(addDays('2027-01-07', r.int(0, 3)), r.int(8, 15), r.int(0, 59)),
        'fall_armyworm'
      )
    if (f.archetype === 'stress_treated')
      groundCheck(
        i,
        at(addDays('2027-01-02', r.int(0, 3)), r.int(8, 15), r.int(0, 59)),
        'fall_armyworm',
        true
      )
  })

  // The ledger: inputs on loan for every contract.
  const ledger: CeihSeed['ledger'] = []
  const entry = (
    i: number,
    type: LedgerEntry['type'],
    when: string,
    amount: number,
    ref: string,
    note: string,
    simulated = false
  ) => {
    ledger.push({
      id: `sim-ceih-ledger-${pad(i + 1)}-${type}`,
      data: LedgerEntrySchema.parse({
        contract_id: contracts[i].id,
        farmer_id: farmers[i].id,
        org_id: DEMO_ORG_ID,
        at: when,
        type,
        amount_zmw: amount,
        ref,
        note,
        simulated,
        sim: true,
      }),
    })
  }
  contracts.forEach((c, i) =>
    entry(
      i,
      'input_loan',
      c.data.inputs_delivered!.at,
      c.data.input_loan_zmw,
      `INP-${pad(i + 1)}`,
      "Seed, inoculant and fertiliser, acknowledged with the farmer's SMS code"
    )
  )

  // Advances: ten sent in early January, two waiting for approval.
  const officerOf = (i: number) => CAMPS.find(x => x.name === contracts[i].data.camp)!.officer
  const recordFor = (i: number, now: string) =>
    observations
      .filter(
        o => o.observation.farmer_id === farmers[i].id && (o.observation.season_at ?? '') <= now
      )
      .map(o => ({
        id: o.id,
        at: o.observation.season_at!,
        verification_state: o.observation.verification_state,
        verified_by: o.observation.verified_by,
        growth_stage: o.observation.growth_stage,
        geofence_ok: o.observation.geofence_ok,
        issue: o.observation.verified_issue ?? o.observation.diagnosis?.suspected_issue ?? null,
        severity_pct: o.internal?.severity_pct ?? null,
        severity_band: o.observation.diagnosis?.severity_band ?? null,
        intervention: o.observation.intervention !== null,
        resolved: o.observation.outcome?.resolved ?? false,
      }))
  const eligibilityAt = (i: number, now: string): Eligibility =>
    evaluateEligibility({
      now,
      contract: contracts[i].data,
      farmer: farmers[i].data,
      passes: visiblePasses(metrics[i].data.passes, now),
      observations: recordFor(i, now),
      credit: CREDIT,
      openAdvance: null,
      officerLabel: officerLabel,
    })
  const advances: CeihSeed['advances'] = []
  farmers.forEach((f, i) => {
    if (f.archetype !== 'disbursed' && f.archetype !== 'awaiting') return
    const requested =
      f.archetype === 'disbursed'
        ? at(addDays('2027-01-04', r.int(0, 4)), r.int(8, 14), r.int(0, 59))
        : at(addDays('2027-01-11', r.int(0, 1)), r.int(8, 11), r.int(0, 59))
    let snapshot = eligibilityAt(i, requested)
    if (!snapshot.eligible) {
      // Clouds hid the curve: an officer checked the field the day before.
      groundCheck(i, at(addDays(requested.slice(0, 10), -1), 10, r.int(0, 59)), null)
      snapshot = eligibilityAt(i, requested)
    }
    const amount = Math.max(500, Math.floor((snapshot.cap_zmw * r.between(0.8, 1)) / 50) * 50)
    const fee = feeFor(amount, CREDIT)
    const confirmed = addMinutes(requested, r.int(3, 20))
    const id = `sim-ceih-advance-${pad(i + 1)}`
    const disbursed = f.archetype === 'disbursed'
    const approvedAt = addMinutes(confirmed, r.int(30, 300))
    const txRef = `SIM-${(1000 + i).toString(36).toUpperCase()}${pad(i + 1)}`
    advances.push({
      id,
      data: AdvanceSchema.parse({
        contract_id: contracts[i].id,
        farmer_id: f.id,
        org_id: DEMO_ORG_ID,
        season: CEIH_SEASON,
        state: disbursed ? 'disbursed' : 'farmer_confirmed',
        requested_at: requested,
        requested_via: 'officer',
        requested_by: officerOf(i),
        eligibility_snapshot: snapshot,
        amount_zmw: amount,
        fee_zmw: fee,
        otp_sha256: null,
        otp_expires_at: null,
        farmer_confirmed: { at: confirmed, otp_ok: true },
        approval: disbursed ? { approver_id: CREDIT_APPROVER, at: approvedAt } : null,
        decline: null,
        disbursement: disbursed
          ? {
              provider: 'simulated',
              tx_ref: txRef,
              at: addMinutes(approvedAt, 1),
              status: 'simulated',
            }
          : null,
        sim: true,
      }),
    })
    if (disbursed) {
      entry(
        i,
        'advance',
        addMinutes(approvedAt, 1),
        amount,
        txRef,
        'Cash advance to mobile money (simulated transfer)',
        true
      )
      entry(
        i,
        'advance_fee',
        addMinutes(approvedAt, 1),
        fee,
        txRef,
        'Advance fee, shown before the farmer confirmed',
        true
      )
    }
  })

  // June: deliveries for every planted field but Given's (his is entered live).
  const deliveries: CeihSeed['deliveries'] = []
  farmers.forEach((f, i) => {
    if (['given', 'neighbour', 'not_planted'].includes(f.archetype)) return
    const c = contracts[i].data
    const projectedT = c.contracted_ha * c.projected_yield_t_ha
    const share = sideSellers.has(i)
      ? r.between(0.22, 0.32)
      : CAMPS.find(x => x.name === c.camp)!.drought
        ? r.between(0.42, 0.6)
        : f.archetype.startsWith('stress')
          ? r.between(0.72, 0.9)
          : r.between(0.86, 1.1)
    const weight = Math.round(projectedT * share * 1000)
    const grade: Grade = r.weighted([
      ['A', 6],
      ['B', 3],
      ['C', 1],
    ] as const)
    const { price_zmw_t, value_zmw } = priceDelivery(c.contract_price_zmw_t, grade, weight)
    const when = at(addDays('2027-05-26', r.int(0, 13)), r.int(7, 15), r.int(0, 59))
    const id = `sim-ceih-delivery-${pad(i + 1)}`
    deliveries.push({
      id,
      data: DeliverySchema.parse({
        contract_id: contracts[i].id,
        farmer_id: f.id,
        org_id: DEMO_ORG_ID,
        at: when,
        weight_kg: weight,
        moisture_pct: Math.round(r.between(10, 13) * 10) / 10,
        grade,
        price_zmw_t,
        value_zmw,
        clerk_id: 'sim-clerk-ceih-01',
        sim: true,
      }),
    })
    entry(
      i,
      'delivery',
      when,
      -value_zmw,
      id,
      `${(weight / 1000).toFixed(2)} t grade ${grade} at ${zmw(price_zmw_t)} a tonne`
    )
    // No payout row: paying the net moves money, so it waits for approval (invariant 11).
  })

  // Rain: a wet season, with Hamangaba dry from mid-February into March.
  const rainfall = CAMPS.map(camp => {
    const days: { date: string; rain_mm: number }[] = []
    for (let d = '2026-10-01'; d <= '2027-06-30'; d = addDays(d, 1)) {
      const dry = camp.drought && d >= '2027-02-12' && d <= '2027-03-22'
      const wet = d >= '2026-11-10' && d <= '2027-03-31'
      const odds = dry ? 0.07 : wet ? 0.42 : d < '2026-11-10' && d >= '2026-10-20' ? 0.1 : 0.02
      days.push({
        date: d,
        rain_mm: r.chance(odds)
          ? Math.round((dry ? r.between(1, 6) : r.between(3, 32)) * 10) / 10
          : 0,
      })
    }
    return {
      id: `${DEMO_ORG_ID}__${camp.name}`,
      data: RainfallSeriesSchema.parse({
        org_id: DEMO_ORG_ID,
        camp: camp.name,
        source: 'Seeded rainfall series',
        days,
        sim: true,
      }),
    }
  })

  const users: CeihSeed['users'] = [
    {
      id: BANDA,
      profile: UserProfileSchema.parse({
        role: 'field_officer',
        org_id: DEMO_ORG_ID,
        district: 'Monze',
        province: 'Southern',
        channel: 'app',
        display_name: 'Mutale Banda',
        sim: true,
      }),
    },
    {
      id: MOONO,
      profile: UserProfileSchema.parse({
        role: 'field_officer',
        org_id: DEMO_ORG_ID,
        district: 'Monze',
        province: 'Southern',
        channel: 'app',
        display_name: 'Nchimunya Moono',
        sim: true,
      }),
    },
    {
      id: CREDIT_APPROVER,
      profile: UserProfileSchema.parse({
        role: 'credit',
        org_id: DEMO_ORG_ID,
        district: 'Monze',
        province: 'Southern',
        channel: 'app',
        display_name: 'Chipo Lungu',
        sim: true,
      }),
    },
  ]

  return {
    realNow: options.realNow,
    today,
    state: {
      id: DEMO_ORG_ID,
      data: CeihDemoStateSchema.parse({
        phase: 'january',
        offset_days: offsetDays,
        sms_allow: options.demoPhone ? [options.demoPhone] : [],
        hero_farmer_id: farmers[0].id,
        neighbour_farmer_id: farmers[1].id,
        ground_officer_id: BANDA,
        armed_at: options.realNow,
        sim: true,
      }),
    },
    credit: CREDIT,
    users,
    farmers,
    contracts,
    metrics,
    advances,
    ledger,
    deliveries,
    rainfall,
    observations,
  }
}

function addMinutes(iso: string, minutes: number) {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString()
}

// "Officer M. Banda" from the seeded profiles.
export function officerLabel(uid: string) {
  if (uid === BANDA) return 'Officer M. Banda'
  if (uid === MOONO) return 'Officer N. Moono'
  if (uid === CREDIT_APPROVER) return 'C. Lungu (credit)'
  return 'an officer'
}

// The demo fields: strips laid in rows, as Monze smallholdings lie, each as long as its contract's
// hectares need at the row's depth, corners off-true by a few metres, the block turned to the
// camp's grain and set on its farmland. Given and Joseph share a boundary in Chikuni's first row.
function layoutFields(
  roster: { archetype: Archetype; camp: Camp }[],
  hectares: number[],
  r: ReturnType<typeof createRandom>,
  givenPin: GeoPoint | null | undefined
): { pin: GeoPoint; polygon: string }[] {
  const out: { pin: GeoPoint; polygon: string }[] = []
  const DEPTH = 120
  const ROW = 760
  const GAP_X = 7
  const GAP_Y = 14
  for (const camp of CAMPS) {
    const members = roster.map((x, i) => i).filter(i => roster[i].camp === camp)
    const placed: { i: number; corners: [number, number][] }[] = []
    let x = 0
    let row = 0
    for (const i of members) {
      const width = (hectares[i] * 10_000) / DEPTH
      if (x + width > ROW && x > 0) {
        row++
        x = 0
      }
      const top = -row * (DEPTH + GAP_Y)
      const jitter = () => r.between(-5, 5)
      placed.push({
        i,
        corners: [
          [x + jitter(), top + jitter()],
          [x + width + jitter(), top + jitter()],
          [x + width + jitter(), top - DEPTH + jitter()],
          [x + jitter(), top - DEPTH + jitter()],
        ],
      })
      x += width + GAP_X
    }
    const height = (row + 1) * (DEPTH + GAP_Y)
    const angle = (camp.grain * Math.PI) / 180
    const mPerDegLng = 111_320 * Math.cos((camp.center.latitude * Math.PI) / 180)
    for (const { i, corners } of placed) {
      const ring = corners.map(([cx, cy]) => {
        const [ex, ny] = [cx - ROW / 2, cy + height / 2]
        const east = ex * Math.cos(angle) - ny * Math.sin(angle)
        const north = ex * Math.sin(angle) + ny * Math.cos(angle)
        return [
          Math.round((camp.center.longitude + east / mPerDegLng) * 1e7) / 1e7,
          Math.round((camp.center.latitude + north / 110_574) * 1e7) / 1e7,
        ] as [number, number]
      })
      out[i] = { pin: ringCentroid(ring), polygon: ringPolygon(ring) }
    }
  }
  // The live capture-app beat: Given's field where the photo is taken.
  if (givenPin) {
    const side = Math.sqrt(hectares[0] * 10_000)
    const dLat = side / 2 / 110_574
    const dLng = side / 2 / (111_320 * Math.cos((givenPin.latitude * Math.PI) / 180))
    const ring: [number, number][] = [
      [givenPin.longitude - dLng, givenPin.latitude + dLat],
      [givenPin.longitude + dLng, givenPin.latitude + dLat],
      [givenPin.longitude + dLng, givenPin.latitude - dLat],
      [givenPin.longitude - dLng, givenPin.latitude - dLat],
    ]
    out[0] = { pin: givenPin, polygon: ringPolygon(ring) }
  }
  return out
}
