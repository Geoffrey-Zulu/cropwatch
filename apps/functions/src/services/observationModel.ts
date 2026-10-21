import {
  districtSlug,
  findDistrict,
  ISSUE_LABELS,
  ObservationSchema,
  ObservationViewSchema,
  RecommendationViewSchema,
  type CreateObservationRequest,
  type Observation,
  type ObservationView,
  type Recommendation,
  type RecommendationView,
  type Role,
} from '@repo/shared'
import { geohash } from '../lib/geohash'

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
