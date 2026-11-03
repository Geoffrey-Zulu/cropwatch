import { z } from '../zod'
import type { Crop } from './crops'

// CEIH (docs/ceih-workflows-mvp.md, sequenced by docs/ceih-overnight-plan.md): Crop
// verification, Eligibility, Instant disbursement, Harvest reconciliation. Every agronomic and
// credit number is a named constant here, shown on the screens that use it.
//
// PLACEHOLDER: every threshold, window, percentage and amount below is a placeholder until an
// agronomist and an agribusiness credit team set it (spec §8, "Validation").

export const CEIH_SEASON = '2026/27'

// ---------------------------------------------------------------- Satellite (invariant 12)

// Sentinel-2 surface reflectance, the collection every pass names.
export const SATELLITE_COLLECTION = 'S2_SR_HARMONIZED'

// NDVI a field must reach to count as established. PLACEHOLDER until an agronomist sets it.
export const ESTABLISHMENT_NDVI: Partial<Record<Crop, number>> = { soybean: 0.35 }
export const DEFAULT_ESTABLISHMENT_NDVI = 0.35 // PLACEHOLDER until an agronomist sets it
// How far below the camp median a field may sit and still count as on track. PLACEHOLDER.
export const CAMP_MEDIAN_TOLERANCE = 0.08
// Below this NDVI past the expected emergence date, a field reads "not planted". PLACEHOLDER.
export const NOT_PLANTED_NDVI = 0.25
// Days from planting to the first green signal from space. PLACEHOLDER until an agronomist sets it.
export const EMERGENCE_DAYS = 21
// A fall of at least this much between clear passes counts as a drop. PLACEHOLDER.
export const NDVI_DROP = 0.04

// ---------------------------------------------------------------- Eligibility (spec W3)

// Evidence must fall inside this many days before today. PLACEHOLDER until the credit team sets it.
export const VERIFICATION_WINDOW_DAYS = 21
// Clear passes the satellite route needs inside the window. PLACEHOLDER.
export const MIN_CLEAN_PASSES = 2
// An open issue at or above this visual severity, with no intervention recorded, pauses the
// advance. PLACEHOLDER until an agronomist sets it.
export const SEVERITY_PAUSE_PCT = 40
// The ground route needs an officer-recorded stage at or past this (soya V3). PLACEHOLDER.
export const MIN_GROUND_STAGE = 3
// Observations count only inside the field polygon plus this margin, in metres. PLACEHOLDER.
export const GEOFENCE_GRACE_M = 150

// The cap: min(cap_pct × projected harvest value, hard ceiling). Set per agribusiness.
export const CAP_PCT_DEFAULT = 0.15 // PLACEHOLDER until the credit team sets it
export const CAP_PCT_MIN = 0.1 // PLACEHOLDER
export const CAP_PCT_MAX = 0.2 // PLACEHOLDER
export const HARD_CEILING_ZMW = 2500 // PLACEHOLDER until the credit team sets it
// Fee on the advance, shown to the farmer before they confirm. PLACEHOLDER.
export const ADVANCE_FEE_PCT = 0.05

// ---------------------------------------------------------------- Advances (invariant 11)

// The farmer's code is good for this long after the request.
export const OTP_TTL_MINUTES = 30
export const OTP_LENGTH = 6

export const ADVANCE_STATES = [
  'requested',
  'farmer_confirmed',
  'approved',
  'disbursed',
  'declined',
  'failed',
] as const
export const AdvanceStateSchema = z.enum(ADVANCE_STATES)
export type AdvanceState = z.infer<typeof AdvanceStateSchema>

export const ADVANCE_CHANNELS = ['ussd', 'app', 'officer'] as const
export const AdvanceChannelSchema = z.enum(ADVANCE_CHANNELS)

export const MOMO_PROVIDERS = ['airtel', 'mtn'] as const
export const MomoProviderSchema = z.enum(MOMO_PROVIDERS)
export type MomoProvider = z.infer<typeof MomoProviderSchema>
export const MOMO_LABELS: Record<MomoProvider, string> = {
  airtel: 'Airtel Money',
  mtn: 'MTN MoMo',
}

export const DISBURSEMENT_STATUSES = ['pending', 'sent', 'failed', 'simulated'] as const
export const DisbursementStatusSchema = z.enum(DISBURSEMENT_STATUSES)

// ---------------------------------------------------------------- Ledger

export const LEDGER_ENTRY_TYPES = [
  'input_loan',
  'advance',
  'advance_fee',
  'delivery',
  'insurance_payout',
  'payout',
] as const
export const LedgerEntryTypeSchema = z.enum(LEDGER_ENTRY_TYPES)
export type LedgerEntryType = z.infer<typeof LedgerEntryTypeSchema>
export const LEDGER_LABELS: Record<LedgerEntryType, string> = {
  input_loan: 'Inputs on loan',
  advance: 'Cash advance',
  advance_fee: 'Advance fee',
  delivery: 'Crop delivered',
  insurance_payout: 'Insurance payout',
  payout: 'Paid to farmer',
}

// ---------------------------------------------------------------- Harvest (spec W6)

export const GRADES = ['A', 'B', 'C'] as const
export const GradeSchema = z.enum(GRADES)
export type Grade = z.infer<typeof GradeSchema>
// Share of the contract price paid for each grade. PLACEHOLDER until the credit team sets it.
export const GRADE_PRICE_FACTOR: Record<Grade, number> = { A: 1, B: 0.92, C: 0.8 }
// Delivered below this share of the projected harvest (adjusted for a shock) is a variance the
// credit team sees. PLACEHOLDER.
export const VARIANCE_SHARE = 0.7
// A drought-flagged contract's projection is cut to this share before the variance check.
// PLACEHOLDER until an agronomist sets it.
export const SHOCK_YIELD_SHARE = 0.5

// ---------------------------------------------------------------- Shock trigger (spec W5)

// Two independent sources must agree: rain over 30 days below this, and the camp median NDVI
// falling across most fields. PLACEHOLDER until an agronomist sets them.
export const SHOCK_RAIN_30D_MM = 60
export const SHOCK_FALLING_SHARE = 0.6
export const SHOCK_LOOKBACK_DAYS = 30
// The rule watches the growing season only, from establishment to before the crop matures: a dry
// harvest month with every field senescing is the season ending, not a shock. Days after the
// camp's median planting date. PLACEHOLDER until an agronomist sets them.
export const SHOCK_SEASON_FROM_DAYS = 30
export const SHOCK_SEASON_TO_DAYS = 125

// ---------------------------------------------------------------- Sources and states

// Where an entry in the Verified Season Record came from.
export const RECORD_SOURCES = ['satellite', 'officer', 'farmer', 'ai'] as const
export const RecordSourceSchema = z.enum(RECORD_SOURCES)
export type RecordSource = z.infer<typeof RecordSourceSchema>

// Why an observation exists.
export const OBSERVATION_SOURCES = ['officer', 'farmer', 'satellite_task'] as const
export const ObservationSourceSchema = z.enum(OBSERVATION_SOURCES).openapi('ObservationSource', {
  description:
    'Why an observation exists: an officer visit, a farmer report, or a visit the satellite curve asked for.',
})
export type ObservationSource = z.infer<typeof ObservationSourceSchema>

// What a field's curve says at a pass (spec W2.3).
export const SATELLITE_STATUSES = [
  'not_planted',
  'established',
  'field_stress',
  'shared_stress',
  'no_data',
] as const
export const SatelliteStatusSchema = z.enum(SATELLITE_STATUSES)
export type SatelliteStatus = z.infer<typeof SatelliteStatusSchema>
export const SATELLITE_STATUS_LABELS: Record<SatelliteStatus, string> = {
  // From space it is only "no crop seen": "not planted" is for an officer who has visited.
  not_planted: 'No crop seen from space',
  established: 'Established, on track',
  field_stress: 'Stress on this field only',
  shared_stress: 'Stress across the camp',
  no_data: 'No clear pass',
}

export const CONTRACT_STATUSES = ['active', 'settled', 'defaulted'] as const
export const ContractStatusSchema = z.enum(CONTRACT_STATUSES)

export const SHOCK_TYPES = ['drought'] as const
export const ShockTypeSchema = z.enum(SHOCK_TYPES)

// The demo's season calendar (docs/ceih-overnight-plan.md §4): January for the advance, March
// for the drought trigger, June for the harvest.
export const SEASON_PHASES = ['january', 'march', 'june'] as const
export const SeasonPhaseSchema = z.enum(SEASON_PHASES)
export type SeasonPhase = z.infer<typeof SeasonPhaseSchema>
export const SEASON_PHASE_DATES: Record<SeasonPhase, string> = {
  january: '2027-01-12',
  march: '2027-03-16',
  june: '2027-06-10',
}
