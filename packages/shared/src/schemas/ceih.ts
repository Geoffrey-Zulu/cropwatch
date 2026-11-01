import { z } from '../zod'
import {
  AdvanceChannelSchema,
  AdvanceStateSchema,
  ContractStatusSchema,
  DisbursementStatusSchema,
  GradeSchema,
  LedgerEntryTypeSchema,
  MomoProviderSchema,
  RecordSourceSchema,
  SatelliteStatusSchema,
  SeasonPhaseSchema,
  ShockTypeSchema,
} from '../constants/ceih'
import { CropSchema } from '../constants/crops'
import { ProvinceSchema } from '../constants/provinces'
import { DateSchema, GeoPointSchema, TimestampSchema } from './common'
import { PhotoPathSchema } from './observation'

// CEIH Firestore documents (docs/ceih-workflows-mvp.md §3.1). Server-only: infra/firestore.rules
// matches none of these collections, so no client reads them; the dashboard goes through the
// API. Every seeded row carries sim: true (invariant 5). Times are ISO strings on the wire and
// season-calendar times in the demo (season.ts).

const Zmw = z.number().int()
// +260 and nine digits.
export const MsisdnSchema = z.string().regex(/^\+260\d{9}$/)

// farmers/{farmerId}
export const FarmerSchema = z.object({
  name: z.string().min(1).max(80),
  phone_msisdn: MsisdnSchema,
  momo_provider: MomoProviderSchema,
  // The mobile-money number answered a test before any advance can go to it.
  momo_verified: z.boolean(),
  org_id: z.string().min(1),
  camp: z.string().min(1),
  district: z.string().min(1),
  province: ProvinceSchema,
  consent: z
    .object({
      given_at: TimestampSchema,
      scope: z.literal('org_contract'),
      officer_id: z.string().min(1),
    })
    .nullable(),
  // Precise. Only the farmer's own org, and only server-side: no dashboard view carries it
  // (invariant 6, amended).
  field_pin: GeoPointSchema,
  // A walked boundary (GeoJSON text); null until walked. Post-MVP.
  field_polygon: z.string().nullable(),
  claimed_ha: z.number().positive().max(500),
  history: z.object({
    seasons: z.number().int().min(0),
    defaults: z.number().int().min(0),
    last_recovery_pct: z.number().min(0).max(100).nullable(),
  }),
  sim: z.boolean(),
})
export type Farmer = z.infer<typeof FarmerSchema>

export const ShockFlagSchema = z.object({
  type: ShockTypeSchema,
  camp: z.string(),
  triggered_at: TimestampSchema,
  evidence_ref: z.string(),
})
export type ShockFlag = z.infer<typeof ShockFlagSchema>

// contracts/{contractId}
export const ContractSchema = z.object({
  farmer_id: z.string().min(1),
  org_id: z.string().min(1),
  season: z.string(),
  crop: CropSchema,
  camp: z.string().min(1),
  district: z.string().min(1),
  planting_date: DateSchema,
  contracted_ha: z.number().positive(),
  projected_yield_t_ha: z.number().positive(),
  contract_price_zmw_t: Zmw.positive(),
  // contracted_ha × projected_yield_t_ha × contract_price_zmw_t, whole kwacha.
  projected_value_zmw: Zmw.min(0),
  input_loan_zmw: Zmw.min(0),
  inputs_delivered: z
    .object({
      at: TimestampSchema,
      photo_path: z.string().nullable(),
      otp_confirmed: z.boolean(),
    })
    .nullable(),
  // GeoJSON Polygon as text (Firestore cannot hold nested arrays): MVP rule, a circle around the
  // pin of the claimed area (geofence.ts). Never sent to a dashboard view.
  field_polygon: z.string().min(1),
  status: ContractStatusSchema,
  shock_flag: ShockFlagSchema.nullable(),
  side_sell_suspected: z.boolean(),
  // Traced and enrolled live on the Fields map (Add farm): its card shows real rainfall.
  added_live: z.boolean().optional(),
  sim: z.boolean(),
})
export type Contract = z.infer<typeof ContractSchema>

// One satellite pass over one field (spec: satellite_metrics/{contractId}/passes/{date}). Stored
// as the `passes` array of satellite_metrics/{contractId}: one read a field, every pass kept.
export const SatellitePassSchema = z.object({
  date: DateSchema,
  // null when the pass was clouded out.
  ndvi: z.number().min(-1).max(1).nullable(),
  ndvi_camp_median: z.number().min(-1).max(1).nullable(),
  cloud_pct: z.number().min(0).max(100),
  usable: z.boolean(),
  collection: z.string(),
  computed_at: TimestampSchema,
  status_derived: SatelliteStatusSchema,
  sim: z.boolean(),
})
export type SatellitePass = z.infer<typeof SatellitePassSchema>

export const SatelliteMetricsSchema = z.object({
  contract_id: z.string().min(1),
  org_id: z.string().min(1),
  camp: z.string(),
  // seeded: demo curves (sim). earth_engine or stac: a live Sentinel-2 pull.
  source: z.enum(['seeded', 'earth_engine', 'stac']),
  passes: z.array(SatellitePassSchema),
  sim: z.boolean(),
})
export type SatelliteMetrics = z.infer<typeof SatelliteMetricsSchema>

// ---------------------------------------------------------------- Eligibility

export const ELIGIBILITY_FACTORS = [
  'contract',
  'consent',
  'momo',
  'established',
  'open_issue',
  'history',
  'shock',
  'one_advance',
  'cap',
] as const
export const EligibilityFactorCodeSchema = z.enum(ELIGIBILITY_FACTORS)

// A rule and whether it held, in words the credit team reads. Never a score.
export const EligibilityFactorSchema = z.object({
  code: EligibilityFactorCodeSchema,
  met: z.boolean(),
  text: z.string().min(1),
  source: RecordSourceSchema.nullable(),
})
export type EligibilityFactor = z.infer<typeof EligibilityFactorSchema>

export const EligibilitySchema = z.object({
  eligible: z.boolean(),
  cap_zmw: Zmw.min(0),
  factors: z.array(EligibilityFactorSchema).min(1),
  // Which route satisfied the establishment rule, if one did.
  established_by: z.enum(['satellite', 'officer']).nullable(),
  // The officers whose verification the decision rests on: none of them may approve (invariant 11).
  verifier_ids: z.array(z.string()),
  evaluated_at: TimestampSchema,
})
export type Eligibility = z.infer<typeof EligibilitySchema>

// ---------------------------------------------------------------- Advances

// advances/{advanceId}
export const AdvanceSchema = z.object({
  contract_id: z.string().min(1),
  farmer_id: z.string().min(1),
  org_id: z.string().min(1),
  season: z.string(),
  state: AdvanceStateSchema,
  requested_at: TimestampSchema,
  requested_via: AdvanceChannelSchema,
  requested_by: z.string().min(1),
  // Frozen at request.
  eligibility_snapshot: EligibilitySchema,
  amount_zmw: Zmw.positive(),
  fee_zmw: Zmw.min(0),
  // SHA-256 of the farmer's code; cleared once used. Never in any view.
  otp_sha256: z.string().nullable(),
  otp_expires_at: TimestampSchema.nullable(),
  farmer_confirmed: z.object({ at: TimestampSchema, otp_ok: z.boolean() }).nullable(),
  approval: z.object({ approver_id: z.string().min(1), at: TimestampSchema }).nullable(),
  decline: z
    .object({ by: z.string().min(1), at: TimestampSchema, reason: z.string().min(1).max(300) })
    .nullable(),
  disbursement: z
    .object({
      provider: z.string(),
      tx_ref: z.string().nullable(),
      at: TimestampSchema,
      status: DisbursementStatusSchema,
    })
    .nullable(),
  sim: z.boolean(),
})
export type Advance = z.infer<typeof AdvanceSchema>

// ledger_entries/{entryId}. Signed from the farmer's account: positive is owed by the farmer
// (inputs, advance, fee, a payout made), negative is credited (crop delivered, insurance). The
// balance is always the sum of the rows, never stored (spec §6.3).
export const LedgerEntrySchema = z.object({
  contract_id: z.string().min(1),
  farmer_id: z.string().min(1),
  org_id: z.string().min(1),
  at: TimestampSchema,
  type: LedgerEntryTypeSchema,
  amount_zmw: Zmw,
  ref: z.string(),
  note: z.string(),
  // A SimulatedProvider movement: labelled "simulated" wherever it shows.
  simulated: z.boolean(),
  sim: z.boolean(),
})
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>

// deliveries/{deliveryId}
export const DeliverySchema = z.object({
  contract_id: z.string().min(1),
  farmer_id: z.string().min(1),
  org_id: z.string().min(1),
  at: TimestampSchema,
  weight_kg: z.number().positive().max(200_000),
  moisture_pct: z.number().min(0).max(40),
  grade: GradeSchema,
  price_zmw_t: Zmw.positive(),
  value_zmw: Zmw.min(0),
  clerk_id: z.string().min(1),
  sim: z.boolean(),
})
export type Delivery = z.infer<typeof DeliverySchema>

// weather_triggers/{triggerId}: one evaluation of the shock rule for one camp, with the data
// behind it (two independent sources must agree).
export const WeatherTriggerSchema = z.object({
  org_id: z.string().min(1),
  camp: z.string().min(1),
  window_start: DateSchema,
  window_end: DateSchema,
  metric: z.literal('rain_mm_30d'),
  value: z.number().min(0),
  threshold: z.number().min(0),
  ndvi: z.object({
    median_start: z.number().nullable(),
    median_end: z.number().nullable(),
    fields_falling: z.number().int().min(0),
    fields_total: z.number().int().min(0),
  }),
  fired: z.boolean(),
  source: z.string(),
  evaluated_at: TimestampSchema,
  sim: z.boolean(),
})
export type WeatherTrigger = z.infer<typeof WeatherTriggerSchema>

// rainfall_series/{orgId}__{camp}: the demo rainfall series (named honestly in the UI).
export const RainfallSeriesSchema = z.object({
  org_id: z.string().min(1),
  camp: z.string().min(1),
  source: z.string(),
  days: z.array(z.object({ date: DateSchema, rain_mm: z.number().min(0) })),
  sim: z.boolean(),
})
export type RainfallSeries = z.infer<typeof RainfallSeriesSchema>

// ceih_demo/{orgId}: the demo's season calendar and its phone allow-list. Real SMS go only to
// numbers listed here (and to real, non-sim farmers); every other message is logged only.
export const CeihDemoStateSchema = z.object({
  phase: SeasonPhaseSchema,
  // Whole days added to the real date: January's demo day lands on SEASON_PHASE_DATES.january.
  offset_days: z.number().int(),
  sms_allow: z.array(MsisdnSchema),
  hero_farmer_id: z.string().nullable(),
  neighbour_farmer_id: z.string().nullable(),
  ground_officer_id: z.string().nullable(),
  // Real time of the last arming. A real (non-sim) report linked to a farmer before it is from an
  // earlier rehearsal and does not count, so re-arming never has to touch real data.
  armed_at: TimestampSchema,
  sim: z.boolean(),
})
export type CeihDemoState = z.infer<typeof CeihDemoStateSchema>

// The org's credit settings (orgs/{orgId}.credit), shown on the approval screen.
export const CreditConfigSchema = z.object({
  cap_pct: z.number().min(0.1).max(0.2),
  hard_ceiling_zmw: Zmw.positive(),
  advance_fee_pct: z.number().min(0).max(0.2),
})
export type CreditConfig = z.infer<typeof CreditConfigSchema>

// sms_log/{id}: every message the CEIH flows send or would send, for the dashboard's SMS log.
export const SmsLogSchema = z.object({
  org_id: z.string().min(1),
  farmer_id: z.string().nullable(),
  to: MsisdnSchema,
  message: z.string().min(1),
  purpose: z.enum(['otp', 'disbursement', 'statement', 'decline', 'other']),
  // sent: the gateway accepted it. logged: no gateway, or a demo number not on the allow-list.
  status: z.enum(['sent', 'logged', 'failed']),
  gateway: z.string(),
  at: TimestampSchema,
  season_at: TimestampSchema,
  sim: z.boolean(),
})
export type SmsLog = z.infer<typeof SmsLogSchema>

// ---------------------------------------------------------------- Dashboard views (tRPC)
// Parsed on the server before they leave, so what they leave out cannot leak: no view has a
// field for a pin, a polygon, a phone number in full or an OTP.

export const CurvePointSchema = z.object({
  date: DateSchema,
  ndvi: z.number().nullable(),
  camp_median: z.number().nullable(),
  usable: z.boolean(),
  cloud_pct: z.number(),
  status: SatelliteStatusSchema,
})
export type CurvePoint = z.infer<typeof CurvePointSchema>

export const VERIFIED_STATES = [
  'satellite',
  'officer',
  'cloud_gap',
  'not_planted',
  'field_stress',
  'shared_stress',
  'too_early',
] as const
export const VerifiedStateSchema = z.enum(VERIFIED_STATES)
export type VerifiedState = z.infer<typeof VerifiedStateSchema>

export const AdvanceSummarySchema = z.object({
  advance_id: z.string(),
  state: AdvanceStateSchema,
  amount_zmw: Zmw,
  fee_zmw: Zmw,
  requested_at: TimestampSchema,
  simulated: z.boolean(),
})
export type AdvanceSummary = z.infer<typeof AdvanceSummarySchema>

export const SeasonRowSchema = z.object({
  contract_id: z.string(),
  farmer_id: z.string(),
  farmer_name: z.string(),
  camp: z.string(),
  district: z.string(),
  crop: CropSchema,
  contracted_ha: z.number(),
  verified: z.object({
    state: VerifiedStateSchema,
    label: z.string(),
    date: DateSchema.nullable(),
  }),
  eligible: z.boolean(),
  // The chip: "Eligible · cap ZMW 840", "Not eligible: cloud gap, ground check required".
  eligibility_label: z.string(),
  cap_zmw: Zmw,
  advance: AdvanceSummarySchema.nullable(),
  // What the farmer owes on the ledger now (the sum of its rows).
  exposure_zmw: Zmw,
  shock: z.boolean(),
  // The sparkline: the field's NDVI at each pass, null where clouded out.
  spark: z.array(z.number().nullable()),
  sim: z.boolean(),
})
export type SeasonRow = z.infer<typeof SeasonRowSchema>

export const PortfolioSchema = z.object({
  org_id: z.string(),
  name: z.string(),
  season: z.string(),
  // The demo's season calendar.
  today: TimestampSchema,
  phase: SeasonPhaseSchema,
  contracts: z.number().int(),
  projected_value_zmw: Zmw,
  input_loans_zmw: Zmw,
  advances_out_zmw: Zmw,
  recovered_zmw: Zmw,
  shock_camps: z.array(z.string()),
  verified: z.number().int(),
  eligible: z.number().int(),
  awaiting_approval: z.number().int(),
  credit: CreditConfigSchema,
  camps: z.array(z.string()),
  rows: z.array(SeasonRowSchema),
  // The demo's storyline farmer (null outside a simulated season).
  hero_contract_id: z.string().nullable(),
  neighbour_contract_id: z.string().nullable(),
  sim: z.boolean(),
})
export type Portfolio = z.infer<typeof PortfolioSchema>

export const GroundCheckSchema = z.object({
  obs_id: z.string(),
  at: TimestampSchema,
  stage: z.string().nullable(),
  verification: z.string(),
  verified_by: z.string().nullable(),
  verified_by_label: z.string().nullable(),
  geofence_ok: z.boolean().nullable(),
  issue_label: z.string().nullable(),
  photo_paths: z.array(PhotoPathSchema),
  sim: z.boolean(),
})
export type GroundCheck = z.infer<typeof GroundCheckSchema>

export const TimelineEntrySchema = z.object({
  at: TimestampSchema,
  kind: z.enum([
    'inputs',
    'planted',
    'satellite',
    'ground_check',
    'issue',
    'intervention',
    'advance',
    'delivery',
    'shock',
  ]),
  source: RecordSourceSchema,
  text: z.string(),
})
export type TimelineEntry = z.infer<typeof TimelineEntrySchema>

// A traced field as [longitude, latitude] pairs (the Fields map, the card's imagery thumbnail).
const RingSchema = z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))

export const FieldCardSchema = z.object({
  contract_id: z.string(),
  farmer_id: z.string(),
  farmer_name: z.string(),
  camp: z.string(),
  district: z.string(),
  crop: CropSchema,
  planting_date: DateSchema,
  today: TimestampSchema,
  contracted_ha: z.number(),
  // The cap's arithmetic (the loan check counts it up): hectares × yield × price.
  projected_yield_t_ha: z.number().optional(),
  contract_price_zmw_t: Zmw.optional(),
  projected_value_zmw: Zmw,
  input_loan_zmw: Zmw,
  // The traced field, only for a caller who may see field outlines (invariant 6, canSeeFields).
  ring: RingSchema.optional(),
  // Enrolled live through Add farm: the card fetches its real rainfall (liveRain.ts).
  added_live: z.boolean().optional(),
  status: SatelliteStatusSchema,
  status_label: z.string(),
  curve: z.array(CurvePointSchema),
  curve_source: z.enum(['seeded', 'earth_engine', 'stac']),
  timeline: z.array(TimelineEntrySchema),
  eligibility: EligibilitySchema,
  ground_checks: z.array(GroundCheckSchema),
  advance: AdvanceSummarySchema.nullable(),
  momo_label: z.string(),
  phone_masked: z.string(),
  credit: CreditConfigSchema,
  shock: ShockFlagSchema.nullable(),
  // The demo's contrast (plan §4 beat 3): beside the hero, the neighbour who never planted.
  neighbour: z
    .object({
      farmer_name: z.string(),
      contracted_ha: z.number(),
      status_label: z.string(),
      eligibility_label: z.string(),
      curve: z.array(CurvePointSchema),
    })
    .nullable()
    .optional(),
  sim: z.boolean(),
})
export type FieldCard = z.infer<typeof FieldCardSchema>

export const ApprovalSchema = z.object({
  advance_id: z.string(),
  contract_id: z.string(),
  state: AdvanceStateSchema,
  requested_at: TimestampSchema,
  requested_via: AdvanceChannelSchema,
  amount_zmw: Zmw,
  fee_zmw: Zmw,
  otp_ok: z.boolean(),
  eligibility_snapshot: EligibilitySchema,
  verifier_labels: z.array(z.string()),
  // The signed-in user verified evidence this advance rests on: they cannot approve it.
  caller_is_verifier: z.boolean(),
  // The rules re-run today (checkStillEligible): the reason this advance cannot be approved now,
  // or null. A request is never approved on its snapshot alone.
  blocked_today: z.string().nullable().optional(),
  card: FieldCardSchema,
  sim: z.boolean(),
})
export type Approval = z.infer<typeof ApprovalSchema>

export const StatementLineSchema = z.object({
  at: TimestampSchema,
  type: LedgerEntryTypeSchema,
  label: z.string(),
  amount_zmw: Zmw,
  ref: z.string(),
  note: z.string(),
  simulated: z.boolean(),
})

export const VARIANCE_KINDS = ['none', 'shock', 'verified_issue', 'unexplained'] as const
export const VarianceKindSchema = z.enum(VARIANCE_KINDS)
export type VarianceKind = z.infer<typeof VarianceKindSchema>

export const StatementSchema = z.object({
  contract_id: z.string(),
  farmer_name: z.string(),
  camp: z.string(),
  lines: z.array(StatementLineSchema),
  // Sum of the lines: positive, the farmer owes; negative, owed to the farmer.
  balance_zmw: Zmw,
  delivered_t: z.number().nullable(),
  projected_t: z.number(),
  contract_price_zmw_t: Zmw,
  variance: z.object({ kind: VarianceKindSchema, text: z.string() }),
  settled: z.boolean(),
  sim: z.boolean(),
})
export type Statement = z.infer<typeof StatementSchema>

export const SmsLogViewSchema = z.object({
  id: z.string(),
  to_masked: z.string(),
  farmer_name: z.string().nullable(),
  message: z.string(),
  purpose: SmsLogSchema.shape.purpose,
  status: SmsLogSchema.shape.status,
  at: TimestampSchema,
  season_at: TimestampSchema,
  sim: z.boolean(),
})
export type SmsLogView = z.infer<typeof SmsLogViewSchema>

export const ClaimPackSchema = z.object({
  trigger_id: z.string(),
  camp: z.string(),
  trigger: WeatherTriggerSchema,
  contracts: z.array(
    z.object({ contract_id: z.string(), farmer_name: z.string(), contracted_ha: z.number() })
  ),
  rainfall_source: z.string(),
  sim: z.boolean(),
})
export type ClaimPack = z.infer<typeof ClaimPackSchema>

export const ReconciliationSchema = z.object({
  rows: z.array(
    z.object({
      contract_id: z.string(),
      farmer_name: z.string(),
      camp: z.string(),
      delivered_t: z.number(),
      projected_t: z.number(),
      variance: z.object({ kind: VarianceKindSchema, text: z.string() }),
      net_zmw: Zmw,
      sim: z.boolean(),
    })
  ),
  claim_packs: z.array(ClaimPackSchema),
})
export type Reconciliation = z.infer<typeof ReconciliationSchema>

export const DeliveryInputSchema = z.object({
  contract_id: z.string().min(1).max(128),
  weight_kg: z.number().positive().max(200_000),
  moisture_pct: z.number().min(0).max(40),
  grade: GradeSchema,
})
export type DeliveryInput = z.infer<typeof DeliveryInputSchema>

// ---------------------------------------------------------------- Fields map

// How a field shows on the imagery: green established, grey not planted, amber hatch for stress,
// brick for a drought-flagged camp, an outline only while clouds hide it.
export const FIELD_STATES = ['established', 'not_planted', 'stress', 'shock', 'cloud_gap'] as const
export const FieldStateSchema = z.enum(FIELD_STATES)
export type FieldState = z.infer<typeof FieldStateSchema>

export const FieldsMapSchema = z.object({
  org_id: z.string(),
  today: TimestampSchema,
  // Field outlines are this org's own (invariant 6, amended): false means camp totals only.
  precise: z.boolean(),
  camps: z.array(
    z.object({
      camp: z.string(),
      center: GeoPointSchema,
      // [west, south, east, north], padded: a camp's extent, not a field's.
      bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]),
      contracts: z.number().int(),
      established: z.number().int(),
      not_planted: z.number().int(),
      stress: z.number().int(),
      cloud_gap: z.number().int(),
      shock: z.boolean(),
    })
  ),
  fields: z.array(
    z.object({
      contract_id: z.string(),
      farmer_name: z.string(),
      camp: z.string(),
      state: FieldStateSchema,
      ring: RingSchema,
      contracted_ha: z.number(),
      eligibility_label: z.string(),
      sim: z.boolean(),
    })
  ),
  hero_contract_id: z.string().nullable(),
  sim: z.boolean(),
})
export type FieldsMap = z.infer<typeof FieldsMapSchema>

// Draw-to-enrol: the boundary traced on the imagery, and the contract terms.
export const EnrolFieldInputSchema = z.object({
  camp: z.string().min(1).max(80),
  ring: RingSchema.min(3).max(200),
  name: z.string().trim().min(1).max(80),
  phone_msisdn: MsisdnSchema,
  momo_provider: MomoProviderSchema,
  projected_yield_t_ha: z.number().positive().max(20),
  contract_price_zmw_t: z.number().int().positive().max(100_000),
  // The officer read the consent text to the farmer and they agreed.
  consent: z.literal(true),
})
export type EnrolFieldInput = z.infer<typeof EnrolFieldInputSchema>
