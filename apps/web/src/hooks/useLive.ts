import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type Query,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import type {
  AlertClass,
  ConfidenceBand,
  Crop,
  ExpertReviewReason,
  GeoPoint,
  Issue,
  ObservationStatus,
  Recommendation,
  RiskLevel,
  SeverityBand,
  VerificationState,
} from '@repo/shared'
import { db } from '../lib/firebase'
import { plain } from '../lib/firestoreData'

// Live Firestore reads for the Command Center (infra/firestore.rules allows them for
// extension_officer, agronomist and admin). Each converts at the boundary into the shape the
// dashboard renders; model numbers are never read (they live in internal docs no client sees).

export interface DashObservation {
  id: string
  createdAt: string
  crop: Crop
  district: string
  districtSlug: string
  province: string
  camp: string | null
  location: GeoPoint
  status: ObservationStatus
  verification: VerificationState
  verifiedIssue: Issue | null
  suspectedIssue: Issue | null
  // The issue as it stands: the officer's, else the AI's.
  issue: Issue | null
  band: ConfidenceBand | null
  severity: SeverityBand | null
  needsReview: boolean
  reviewReason: ExpertReviewReason | null
  symptoms: string[]
  modelId: string | null
  promptVersion: string | null
  photoPaths: string[]
  reporterRole: string
  orgId: string | null
  recommendationId: string | null
  description: string | null
  plantingDate: string | null
  growthStage: string | null
  sim: boolean
}

export interface DashCluster {
  id: string
  issue: Issue
  district: string
  districtSlug: string
  center: GeoPoint
  radiusKm: number
  members: string[]
  size: number
  newLast24h: number
  verifiedMembers: number
  active: boolean
  firstDetectedAt: string
  updatedAt: string
  alertId: string | null
  sim: boolean
}

export interface DashRisk {
  district: string
  districtSlug: string
  level: RiskLevel
  factors: string[]
  computedAt: string
  sim: boolean
}

export interface DashAlert {
  id: string
  type: string
  alertClass: AlertClass
  issue: Issue
  district: string
  districtSlug: string
  level: RiskLevel
  factors: string[]
  observationIds: string[]
  verifiedReports: number | null
  channels: string[]
  createdAt: string
  clusterId: string | null
  sim: boolean
}

type Doc = Record<string, unknown>

const str = (v: unknown) => (typeof v === 'string' ? v : null)
const num = (v: unknown) => (typeof v === 'number' ? v : 0)

export function toObservation(id: string, data: DocumentData): DashObservation {
  const o = plain(data) as Doc
  const d = (o.diagnosis ?? null) as Doc | null
  const suspected = (str(d?.suspected_issue) as Issue | null) ?? null
  const verified = (str(o.verified_issue) as Issue | null) ?? null
  return {
    id,
    createdAt: String(o.created_at),
    crop: o.crop as Crop,
    district: String(o.district),
    districtSlug: String(o.district_slug),
    province: String(o.province),
    camp: str(o.camp),
    location: (o.location as GeoPoint) ?? { latitude: 0, longitude: 0 },
    status: o.status as ObservationStatus,
    verification: o.verification_state as VerificationState,
    verifiedIssue: verified,
    suspectedIssue: suspected,
    issue: verified ?? suspected,
    band: (str(d?.confidence_band) as ConfidenceBand | null) ?? null,
    severity: (str(d?.severity_band) as SeverityBand | null) ?? null,
    needsReview: d?.needs_expert_review === true,
    reviewReason: (str(d?.expert_review_reason) as ExpertReviewReason | null) ?? null,
    symptoms: Array.isArray(d?.visible_symptoms) ? (d.visible_symptoms as string[]) : [],
    modelId: str(d?.model_id),
    promptVersion: str(d?.prompt_version),
    photoPaths: Array.isArray(o.photo_paths) ? (o.photo_paths as string[]) : [],
    reporterRole: String(o.reporter_role),
    orgId: str(o.org_id),
    recommendationId: str(o.recommendation_id),
    description: str(o.farmer_description),
    plantingDate: str(o.planting_date),
    growthStage: str(o.growth_stage),
    sim: o.sim === true,
  }
}

function toCluster(id: string, data: DocumentData): DashCluster {
  const c = plain(data) as Doc
  return {
    id,
    issue: c.issue as Issue,
    district: String(c.district),
    districtSlug: String(c.district_slug),
    center: c.center as GeoPoint,
    radiusKm: num(c.radius_km) || 10,
    members: (c.members as string[]) ?? [],
    size: num(c.size),
    newLast24h: num(c.new_last_24h),
    verifiedMembers: num(c.verified_members),
    active: c.active === true,
    firstDetectedAt: String(c.first_detected_at ?? c.updated_at),
    updatedAt: String(c.updated_at),
    alertId: str(c.alert_id),
    sim: c.sim === true,
  }
}

function toRisk(id: string, data: DocumentData): DashRisk {
  const r = plain(data) as Doc
  return {
    district: String(r.district ?? id),
    districtSlug: id,
    level: (r.level as RiskLevel) ?? 'LOW',
    factors: (r.contributing_factors as string[]) ?? [],
    computedAt: String(r.computed_at),
    sim: r.sim === true,
  }
}

export function toAlert(id: string, data: DocumentData): DashAlert {
  const a = plain(data) as Doc
  return {
    id,
    type: String(a.type),
    alertClass: (str(a.alert_class) as AlertClass | null) ?? 'model_risk_signal',
    issue: a.issue as Issue,
    district: String(a.district),
    districtSlug: String(a.district_slug),
    level: a.level as RiskLevel,
    factors: (a.contributing_factors as string[]) ?? [],
    observationIds: (a.observation_ids as string[]) ?? [],
    verifiedReports: typeof a.verified_reports === 'number' ? a.verified_reports : null,
    channels: (a.channels_sent as string[]) ?? [],
    createdAt: String(a.created_at),
    clusterId: str(a.cluster_id),
    sim: a.sim === true,
  }
}

// A live query: null while loading, then the mapped rows. An error (rules, offline) ends the
// load with what there is and is reported once.
function useLiveList<T>(
  key: string | null,
  build: () => Query<DocumentData>,
  map: (id: string, data: DocumentData) => T
) {
  const [rows, setRows] = useState<T[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!key) return
    return onSnapshot(
      build(),
      snap => setRows(snap.docs.map(d => map(d.id, d.data()))),
      e => {
        setError(e.message)
        setRows(current => current ?? [])
      }
    )
    // `key` names the query; build and map are stable per key.
  }, [key])
  return { rows, error }
}

export const useObservations = (enabled: boolean) =>
  useLiveList(enabled ? 'observations' : null, () => collection(db, 'observations'), toObservation)

export const useClusters = (enabled: boolean) =>
  useLiveList(
    enabled ? 'clusters:active' : null,
    () => query(collection(db, 'clusters'), where('active', '==', true)),
    toCluster
  )

export const useRisk = (enabled: boolean) =>
  useLiveList(enabled ? 'risk' : null, () => collection(db, 'risk'), toRisk)

export const useAlerts = (enabled: boolean, count = 60) =>
  useLiveList(
    enabled ? `alerts:${count}` : null,
    () => query(collection(db, 'alerts'), orderBy('created_at', 'desc'), limit(count)),
    toAlert
  )

// One document, live: undefined while loading, null when it does not exist.
export function useLiveDoc<T>(path: string | null, map: (id: string, data: DocumentData) => T) {
  const [value, setValue] = useState<T | null | undefined>(undefined)
  useEffect(() => {
    if (!path) return
    setValue(undefined)
    return onSnapshot(
      doc(db, path),
      snap => setValue(snap.exists() ? map(snap.id, snap.data()) : null),
      () => setValue(null)
    )
  }, [path])
  return value
}

export const useObservationDoc = (id: string | null) =>
  useLiveDoc(id ? `observations/${id}` : null, toObservation)
export const useClusterDoc = (id: string | null) =>
  useLiveDoc(id ? `clusters/${id}` : null, toCluster)
export const useAlertDoc = (id: string | null) => useLiveDoc(id ? `alerts/${id}` : null, toAlert)
export const useRiskDoc = (slug: string | null) => useLiveDoc(slug ? `risk/${slug}` : null, toRisk)
export const useRecommendationDoc = (id: string | null) =>
  useLiveDoc(id ? `recommendations/${id}` : null, (_, data) => plain(data) as Recommendation)

// What the App shares with every Command Center page.
export interface LiveData {
  observations: DashObservation[] | null
  clusters: DashCluster[] | null
  risk: DashRisk[] | null
  alerts: DashAlert[] | null
}
