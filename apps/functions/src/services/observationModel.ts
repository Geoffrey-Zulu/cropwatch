import {
  districtSlug,
  findDistrict,
  geohash,
  ISSUE_LABELS,
  ObservationSchema,
  ObservationViewSchema,
  RecommendationViewSchema,
  VERIFICATION_STATES,
  type CreateObservationRequest,
  type Observation,
  type ObservationView,
  type Recommendation,
  type RecommendationView,
  type Role,
  type VerificationState,
  type VerifyRequest,
} from '@repo/shared'

export interface Caller {
  uid: string
  role: Role
  orgId: string | null
}

// What a read needs beyond the view: who may see it.
export interface ObservationRecord {
  view: ObservationView
  reporterId: string
  orgId: string | null
}

const COMMAND_CENTER: Role[] = ['extension_officer', 'agronomist', 'admin']

// Reporter, Command Center roles, or a field officer of the same org (contract: GET
// /observations/{id}). The view never carries the precise location.
export function canReadObservation(
  caller: Caller,
  record: Pick<ObservationRecord, 'reporterId' | 'orgId'>
) {
  if (caller.uid === record.reporterId || COMMAND_CENTER.includes(caller.role)) return true
  return caller.role === 'field_officer' && caller.orgId !== null && caller.orgId === record.orgId
}

// Officers verify (contract: POST /observations/{id}/verify): field officers only within their
// own org, Command Center roles anywhere. Farmers never.
export function canVerifyObservation(caller: Caller, record: Pick<ObservationRecord, 'orgId'>) {
  if (COMMAND_CENTER.includes(caller.role)) return true
  return caller.role === 'field_officer' && caller.orgId !== null && caller.orgId === record.orgId
}

const EXPERT_ROLES: Role[] = ['agronomist', 'admin']

export interface Verification {
  observation: Observation
  // The observation (now recommending) needs a recommendation for the verified issue.
  recommend: boolean
}

// What a verify does. The state only moves up the ladder. An observation awaiting review is
// released for a recommendation; a complete one whose issue changes is re-recommended (its old
// advice was for the wrong issue, so it is withdrawn meanwhile). Confirming "unknown" sends it
// (back) to the officer queue with no advice.
export function applyVerification(
  caller: Caller,
  observation: Observation,
  request: VerifyRequest
): Verification {
  const target: VerificationState = EXPERT_ROLES.includes(caller.role)
    ? 'EXPERT_CONFIRMED'
    : 'FIELD_VERIFIED'
  const ladder = VERIFICATION_STATES as readonly VerificationState[]
  const verification_state =
    ladder.indexOf(target) > ladder.indexOf(observation.verification_state)
      ? target
      : observation.verification_state
  const before = observation.verified_issue ?? observation.diagnosis?.suspected_issue ?? 'unknown'
  const issue = request.verified_issue

  let { status, recommendation_id } = observation
  if (issue === 'unknown') {
    if (status !== 'diagnosing') status = 'awaiting_expert_review'
    recommendation_id = null
  } else if (status === 'awaiting_expert_review') {
    status = 'recommending'
  } else if (status === 'complete' && issue !== before) {
    status = 'recommending'
    recommendation_id = null
  }

  return {
    observation: ObservationSchema.parse({
      ...observation,
      verification_state,
      verified_by: caller.uid,
      verified_issue: issue,
      status,
      recommendation_id,
    }),
    recommend: status === 'recommending',
  }
}

// A new observation from a validated request. The server owns everything not reported:
// identity, timestamps, normalisation, status, and sim (always false for a real report).
export function newObservation(
  caller: Caller,
  request: CreateObservationRequest,
  now: string
): Observation {
  const district = request.district.trim()
  return ObservationSchema.parse({
    reporter_id: caller.uid,
    reporter_role: caller.role,
    org_id: caller.orgId,
    created_at: now,
    location: request.location,
    geohash: geohash(request.location.latitude, request.location.longitude),
    district,
    district_slug: findDistrict(district)?.slug ?? districtSlug(district),
    province: request.province,
    camp: request.camp ?? null,
    crop: request.crop,
    planting_date: request.planting_date ?? null,
    growth_stage: request.growth_stage ?? null,
    photo_paths: request.photo_paths,
    farmer_description: request.farmer_description ?? null,
    status: 'diagnosing',
    diagnosis: null,
    verification_state: 'UNVERIFIED',
    verified_by: null,
    verified_issue: null,
    recommendation_id: null,
    intervention: null,
    outcome: null,
    sim: false,
  })
}

export function toRecommendationView(recommendation: Recommendation): RecommendationView {
  return RecommendationViewSchema.parse({
    ipm_steps: recommendation.ipm_steps,
    chemical_options: recommendation.chemical_options,
    officer_referral: recommendation.chemical_options.length === 0,
    sources: recommendation.rag_sources,
  })
}

// The contract shape: no location, reporter or internal fields, plus display labels.
export function toObservationView(
  obsId: string,
  observation: Observation,
  recommendation: RecommendationView | null
): ObservationView {
  const { diagnosis } = observation
  return ObservationViewSchema.parse({
    ...observation,
    obs_id: obsId,
    diagnosis: diagnosis && {
      ...diagnosis,
      suspected_issue_label: ISSUE_LABELS[diagnosis.suspected_issue],
    },
    recommendation,
  })
}
