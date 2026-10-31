import {
  CAMP_MEDIAN_TOLERANCE,
  CEIH_SEASON,
  MIN_CLEAN_PASSES,
  MIN_GROUND_STAGE,
  MOMO_LABELS,
  SEVERITY_PAUSE_PCT,
  VERIFICATION_WINDOW_DAYS,
} from '../constants/ceih'
import { ISSUE_LABELS, type Issue } from '../constants/issues'
import type { SeverityBand } from '../constants/severity'
import type { VerificationState } from '../constants/verification'
import type {
  Contract,
  CreditConfig,
  Eligibility,
  EligibilityFactor,
  Farmer,
  SatellitePass,
} from '../schemas/ceih'
import { capFor } from './advance'
import { ndviText, percent, shortDate, stageRank, zmw } from './format'
import { establishmentNdvi } from './ndvi'
import { daysBetween } from './season'

// The eligibility rule engine (spec W3): deterministic, every rule a stored and displayed factor,
// never a score (invariants 2 and 12). Pure: the API, the seed's dry run and the tests all call it.

// An observation on the farmer's record, as eligibility reads it.
export interface RecordObservation {
  id: string
  // On the season calendar.
  at: string
  verification_state: VerificationState
  verified_by: string | null
  growth_stage: string | null
  geofence_ok: boolean | null | undefined
  // The issue as it stands (the officer's, else the AI's); null when none was found.
  issue: Issue | null
  severity_pct: number | null
  severity_band: SeverityBand | null
  intervention: boolean
  resolved: boolean
}

export interface EligibilityInput {
  // Season-calendar now.
  now: string
  contract: Pick<
    Contract,
    | 'status'
    | 'crop'
    | 'projected_value_zmw'
    | 'contracted_ha'
    | 'projected_yield_t_ha'
    | 'contract_price_zmw_t'
    | 'shock_flag'
    | 'season'
    | 'camp'
  >
  farmer: Pick<Farmer, 'consent' | 'momo_verified' | 'momo_provider' | 'history'>
  // Passes the system had by `now` (visiblePasses).
  passes: Pick<SatellitePass, 'date' | 'ndvi' | 'ndvi_camp_median' | 'usable' | 'status_derived'>[]
  observations: RecordObservation[]
  credit: CreditConfig
  // An advance this season that was not declined or failed.
  openAdvance: { amount_zmw: number; state: string } | null
  // Display name for an officer uid ("Officer M. Banda").
  officerLabel: (uid: string) => string
}

const GROUND_STATES: VerificationState[] = ['FIELD_VERIFIED', 'EXPERT_CONFIRMED']

const factor = (
  code: EligibilityFactor['code'],
  met: boolean,
  text: string,
  source: EligibilityFactor['source'] = null
): EligibilityFactor => ({ code, met, text, source })

export function evaluateEligibility(input: EligibilityInput): Eligibility {
  const { now, contract, farmer, passes, credit } = input
  const inWindow = (date: string) => {
    const age = daysBetween(date, now)
    return age >= 0 && age <= VERIFICATION_WINDOW_DAYS
  }

  // Crop established, by satellite or on the ground (either is enough).
  const threshold = establishmentNdvi(contract.crop)
  const windowPasses = passes.filter(p => inWindow(p.date))
  const clear = windowPasses.filter(p => p.usable && p.ndvi !== null)
  const clouded = windowPasses.length - clear.length
  const qualifying = clear.filter(
    p =>
      p.ndvi! >= threshold &&
      (p.ndvi_camp_median === null || p.ndvi! >= p.ndvi_camp_median - CAMP_MEDIAN_TOLERANCE)
  )
  const satelliteOk = qualifying.length >= MIN_CLEAN_PASSES
  const latest = clear[clear.length - 1]
  const campLatest = latest?.ndvi_camp_median

  // Observations that fell outside the field never count, either way (spec §6.5).
  const onField = input.observations.filter(o => o.geofence_ok === true)
  const ground = onField
    .filter(
      o =>
        inWindow(o.at) &&
        GROUND_STATES.includes(o.verification_state) &&
        o.verified_by !== null &&
        (stageRank(o.growth_stage) ?? -1) >= MIN_GROUND_STAGE
    )
    .sort((a, b) => b.at.localeCompare(a.at))
  const groundOk = ground.length > 0

  const established = satelliteOk || groundOk
  const factors: EligibilityFactor[] = []

  // The satellite line.
  let satelliteText: string
  if (satelliteOk) {
    satelliteText = `Satellite: ${qualifying.length} clear passes, NDVI ${ndviText(latest.ndvi!)}${campLatest != null ? ` vs camp ${ndviText(campLatest)}` : ''}, on calendar`
  } else if (latest?.status_derived === 'not_planted') {
    satelliteText = `Satellite: flat near bare soil, NDVI ${ndviText(latest.ndvi!)}${campLatest != null ? ` vs camp ${ndviText(campLatest)}` : ''}: not planted`
  } else if (clear.length > 0 && latest.ndvi! < threshold) {
    satelliteText = `Satellite: NDVI ${ndviText(latest.ndvi!)}${campLatest != null ? ` vs camp ${ndviText(campLatest)}` : ''}, below the establishment line of ${ndviText(threshold)}`
  } else if (
    clear.length > 0 &&
    campLatest != null &&
    latest.ndvi! < campLatest - CAMP_MEDIAN_TOLERANCE
  ) {
    satelliteText = `Satellite: NDVI ${ndviText(latest.ndvi!)} vs camp ${ndviText(campLatest)}, more than ${ndviText(CAMP_MEDIAN_TOLERANCE)} behind the camp`
  } else {
    const passWord = clear.length === 1 ? 'pass' : 'passes'
    satelliteText = `Satellite: ${clear.length} clear ${passWord} in ${VERIFICATION_WINDOW_DAYS} days${clouded ? ` (${clouded} clouded out)` : ''}, ${MIN_CLEAN_PASSES} needed`
  }
  if (!satelliteOk && groundOk) satelliteText += '; the ground check covers it'
  // A line "met" does not block: either route establishes the crop.
  factors.push(factor('established', established, satelliteText, 'satellite'))

  // The ground line.
  if (groundOk) {
    const check = ground[0]
    factors.push(
      factor(
        'established',
        true,
        `Field verified ${shortDate(check.at)} by ${input.officerLabel(check.verified_by!)}, stage ${check.growth_stage}`,
        'officer'
      )
    )
  } else if (!satelliteOk) {
    const pending = onField.find(
      o => inWindow(o.at) && !GROUND_STATES.includes(o.verification_state)
    )
    const outside = input.observations.find(o => inWindow(o.at) && o.geofence_ok === false)
    const text = pending
      ? `Ground photo ${shortDate(pending.at)} received, waiting for an officer to verify it`
      : outside
        ? `Ground check required: the last photo fell outside the field, so it does not count`
        : `Ground check required: no field verification in ${VERIFICATION_WINDOW_DAYS} days`
    factors.push(factor('established', false, text, 'officer'))
  }

  // No open severe issue without a recorded intervention.
  const open = onField.find(
    o =>
      o.issue !== null &&
      o.issue !== 'unknown' &&
      !o.intervention &&
      !o.resolved &&
      (o.severity_pct !== null
        ? o.severity_pct >= SEVERITY_PAUSE_PCT
        : o.severity_band === 'severe')
  )
  factors.push(
    open
      ? factor(
          'open_issue',
          false,
          `Open issue: ${ISSUE_LABELS[open.issue!]}, severe, ${shortDate(open.at)}, no treatment recorded. Paused until the officer records one`,
          GROUND_STATES.includes(open.verification_state) ? 'officer' : 'ai'
        )
      : factor('open_issue', true, 'No open severe issues')
  )

  // The cap.
  // The cap, with where the projected crop value comes from, so the farmer gate can be answered.
  const cap = capFor(contract.projected_value_zmw, credit)
  const raw = Math.floor(contract.projected_value_zmw * credit.cap_pct)
  const value = `the projected crop value ${zmw(contract.projected_value_zmw)} (${contract.contracted_ha} ha × ${contract.projected_yield_t_ha} t/ha × ${zmw(contract.contract_price_zmw_t)}/t)`
  factors.push(
    factor(
      'cap',
      true,
      raw > credit.hard_ceiling_zmw
        ? `Cap ${percent(credit.cap_pct)} of ${value} = ${zmw(raw)}, held at the ${zmw(credit.hard_ceiling_zmw)} ceiling`
        : `Cap ${percent(credit.cap_pct)} of ${value} = ${zmw(cap)}, under the ${zmw(credit.hard_ceiling_zmw)} ceiling`
    )
  )

  // The contract and the farmer record.
  factors.push(
    contract.status === 'active'
      ? factor('contract', true, `Contract active, season ${contract.season || CEIH_SEASON}`)
      : factor('contract', false, `Contract ${contract.status}`)
  )
  factors.push(
    farmer.consent?.scope === 'org_contract'
      ? factor(
          'consent',
          true,
          `Consent recorded ${shortDate(farmer.consent.given_at)} by ${input.officerLabel(farmer.consent.officer_id)}`,
          'officer'
        )
      : factor('consent', false, 'No contract consent recorded')
  )
  factors.push(
    farmer.momo_verified
      ? factor('momo', true, `${MOMO_LABELS[farmer.momo_provider]} number verified`)
      : factor('momo', false, `${MOMO_LABELS[farmer.momo_provider]} number not verified yet`)
  )
  factors.push(
    farmer.history.defaults === 0
      ? factor(
          'history',
          true,
          farmer.history.seasons === 0
            ? 'First season with this agribusiness'
            : `No default in ${farmer.history.seasons} earlier ${farmer.history.seasons === 1 ? 'season' : 'seasons'}`
        )
      : factor('history', false, 'Defaulted in an earlier season')
  )
  factors.push(
    contract.shock_flag
      ? factor(
          'shock',
          false,
          `Drought flag on ${contract.shock_flag.camp} since ${shortDate(contract.shock_flag.triggered_at)}: advances paused in this camp`,
          'satellite'
        )
      : factor('shock', true, 'No shock flag on the camp')
  )
  factors.push(
    input.openAdvance
      ? factor(
          'one_advance',
          false,
          `One advance a season: ${zmw(input.openAdvance.amount_zmw)} already ${input.openAdvance.state === 'disbursed' ? 'sent' : 'requested'}`
        )
      : factor('one_advance', true, 'No advance yet this season')
  )

  return {
    eligible: factors.every(f => f.met),
    cap_zmw: cap,
    factors,
    established_by: satelliteOk ? 'satellite' : groundOk ? 'officer' : null,
    // Conservative: whoever verified a ground check in the window may not approve, even when the
    // satellite alone would have been enough.
    verifier_ids: [...new Set(ground.map(o => o.verified_by!))],
    evaluated_at: now,
  }
}

// The chip on a ledger row.
export function eligibilityLabel(e: Eligibility): string {
  if (e.eligible) return `Eligible · cap ${zmw(e.cap_zmw)}`
  // The most decisive rule first: a paused camp, an advance already out, an open issue, then
  // the crop, then the farmer record.
  const order: EligibilityFactor['code'][] = [
    'shock',
    'one_advance',
    'open_issue',
    'established',
    'consent',
    'momo',
    'history',
    'contract',
  ]
  const blocking = order.map(code => e.factors.find(f => f.code === code && !f.met)).find(Boolean)!
  const establishing = e.factors
    .filter(f => f.code === 'established' && !f.met)
    .map(f => f.text)
    .join(' ')
  switch (blocking.code) {
    case 'established':
      if (establishing.includes('not planted')) return 'Not eligible: no crop seen'
      if (establishing.includes('waiting for an officer'))
        return 'Not eligible: waiting for verification'
      if (establishing.includes('below the establishment line'))
        return 'Not eligible: not established yet'
      if (establishing.includes('behind the camp')) return 'Not eligible: behind the camp'
      return 'Not eligible: cloud gap, ground check required'
    case 'open_issue':
      return 'Paused: severe issue open'
    case 'shock':
      return 'Paused: drought flag on the camp'
    case 'one_advance':
      return blocking.text.includes('sent') ? 'Advance sent' : 'Advance requested'
    case 'consent':
      return 'Not eligible: no consent'
    case 'momo':
      return 'Not eligible: mobile money not verified'
    case 'history':
      return 'Not eligible: earlier default'
    default:
      return 'Not eligible'
  }
}
