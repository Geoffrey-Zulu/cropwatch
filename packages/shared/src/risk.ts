import type { Issue } from './constants/issues'
import { distanceKm } from './geo'
import type { GeoPoint } from './schemas/common'
import type { RiskLevel } from './schemas/alert'

// Risk Model v0 (technicaldoc §9): a transparent, rule-based PROTOTYPE signal. Pure functions,
// shared by the seed (which proves its storylines with them) and the API (which runs them on
// live data that BigQuery has filtered). Levels are qualitative and always travel with their
// contributing factors; nothing here is a probability (CLAUDE.md invariant 2).

// Cluster rule: five or more same-issue observations with verification weight ≥ 0.5, within
// 10 km of each other, within 72 h.
export const CLUSTER_MIN_REPORTS = 5
export const CLUSTER_RADIUS_KM = 10
export const CLUSTER_WINDOW_HOURS = 72
export const CLUSTER_MIN_WEIGHT = 0.5

export interface ClusterPoint {
  id: string
  issue: Issue | null
  location: GeoPoint
  created_at: string
  weight: number
}

export interface Cluster {
  issue: Issue
  members: string[]
}

export function qualifying<P extends ClusterPoint>(points: P[], now: string): P[] {
  const since = Date.parse(now) - CLUSTER_WINDOW_HOURS * 3_600_000
  return points.filter(
    p =>
      p.issue !== null &&
      p.issue !== 'unknown' &&
      p.weight >= CLUSTER_MIN_WEIGHT &&
      Date.parse(p.created_at) > since &&
      Date.parse(p.created_at) <= Date.parse(now)
  )
}

// An anchor is a point with ≥ 5 qualifying same-issue points (itself included) within 10 km;
// anchors sharing members merge into one cluster.
export function mergeAnchors(anchors: Cluster[]): Cluster[] {
  const groups: { issue: Issue; members: Set<string> }[] = []
  for (const anchor of anchors) {
    const overlapping = groups.filter(
      g => g.issue === anchor.issue && anchor.members.some(id => g.members.has(id))
    )
    const merged = { issue: anchor.issue, members: new Set(anchor.members) }
    for (const group of overlapping) {
      group.members.forEach(id => merged.members.add(id))
      groups.splice(groups.indexOf(group), 1)
    }
    groups.push(merged)
  }
  return groups.map(g => ({ issue: g.issue, members: [...g.members].sort() }))
}

// The whole rule in JS, for the seed and for tests. The API does the spatial filtering in
// BigQuery (ST_DWITHIN) and then calls mergeAnchors.
export function clusters(points: ClusterPoint[], now: string): Cluster[] {
  const live = qualifying(points, now)
  const anchors: Cluster[] = []
  for (const anchor of live) {
    const near = live.filter(
      p => p.issue === anchor.issue && distanceKm(p.location, anchor.location) <= CLUSTER_RADIUS_KM
    )
    if (near.length >= CLUSTER_MIN_REPORTS) {
      anchors.push({ issue: anchor.issue as Issue, members: near.map(p => p.id) })
    }
  }
  return mergeAnchors(anchors)
}

// The cluster's centre: the mean of its members (fine at district scale), never a farm.
export function centroid(points: GeoPoint[]): GeoPoint {
  const n = points.length
  return {
    latitude: Math.round((points.reduce((s, p) => s + p.latitude, 0) / n) * 1e4) / 1e4,
    longitude: Math.round((points.reduce((s, p) => s + p.longitude, 0) / n) * 1e4) / 1e4,
  }
}

export interface DistrictActivity {
  district: string
  // All reports from the district, any issue (latest state of each).
  reportsThisWeek: number
  reportsLastWeek: number
  // Active clusters whose centre lies in the district.
  clusters: { issueLabel: string; size: number; newLast24h: number }[]
}

export interface RiskSignal {
  level: RiskLevel
  // Always at least one; shown with the level, never without it.
  factors: string[]
}

const HIGH_CLUSTER_SIZE = 8
const SURGE = 0.5
const SURGE_MIN_REPORTS = 5

export const percentChange = (now: number, before: number) =>
  before === 0 ? null : Math.round(((now - before) / before) * 100)

// Risk v0 for a district.
//   HIGH: a cluster of 8 or more, two or more clusters, or a cluster still growing while reports
//         surge (≥ +50% on last week).
//   ELEVATED: any cluster, or a surge of at least 5 reports and ≥ +50% on last week.
//   LOW: otherwise.
// Weather and crop-calendar inputs (technicaldoc §9) join when their data does (Earth Engine is a
// cut line); until then the factors say only what the reports show.
export function riskV0(activity: DistrictActivity): RiskSignal {
  const { reportsThisWeek: now, reportsLastWeek: before } = activity
  const change = percentChange(now, before)
  const surge = now >= SURGE_MIN_REPORTS && (before === 0 || (now - before) / before >= SURGE)
  const growing = activity.clusters.some(c => c.newLast24h > 0)
  const biggest = Math.max(0, ...activity.clusters.map(c => c.size))

  const factors: string[] = []
  for (const c of [...activity.clusters].sort((a, b) => b.size - a.size)) {
    factors.push(
      `Cluster of ${c.size} ${c.issueLabel} reports within ${CLUSTER_RADIUS_KM} km${c.newLast24h ? ` (${c.newLast24h} new in 24 h)` : ''}`
    )
  }
  factors.push(
    change === null
      ? `${now} report${now === 1 ? '' : 's'} this week (none the week before)`
      : `${now} report${now === 1 ? '' : 's'} this week (${change >= 0 ? '+' : ''}${change}% on last week)`
  )
  if (activity.clusters.length === 0)
    factors.push(`No cluster in the last ${CLUSTER_WINDOW_HOURS} hours`)

  const level: RiskLevel =
    biggest >= HIGH_CLUSTER_SIZE || activity.clusters.length >= 2 || (growing && surge)
      ? 'HIGH'
      : activity.clusters.length > 0 || surge
        ? 'ELEVATED'
        : 'LOW'
  return { level, factors }
}

export const RISK_ORDER: RiskLevel[] = ['LOW', 'ELEVATED', 'HIGH']
export const riskRose = (from: RiskLevel | null, to: RiskLevel) =>
  RISK_ORDER.indexOf(to) > RISK_ORDER.indexOf(from ?? 'LOW')
