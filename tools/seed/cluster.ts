import { distanceKm, type GeoPoint, type Issue } from '@repo/shared'

// technicaldoc §9 Risk Model v0 cluster rule, in JS so the seed can prove its storylines: five or
// more same-issue observations with verification weight ≥ 0.5, within 10 km of each other,
// within 72 h. D6 implements the same rule in BigQuery.
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

export function qualifying(points: ClusterPoint[], now: string) {
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

// A point anchors a cluster when it has ≥ 5 qualifying same-issue points (itself included)
// within 10 km; anchors sharing members merge into one cluster.
export function clusters(points: ClusterPoint[], now: string): Cluster[] {
  const live = qualifying(points, now)
  const groups: { issue: Issue; members: Set<string> }[] = []
  for (const anchor of live) {
    const near = live.filter(
      p => p.issue === anchor.issue && distanceKm(p.location, anchor.location) <= CLUSTER_RADIUS_KM
    )
    if (near.length < CLUSTER_MIN_REPORTS) continue
    const ids = near.map(p => p.id)
    const overlapping = groups.filter(
      g => g.issue === anchor.issue && ids.some(id => g.members.has(id))
    )
    const merged = { issue: anchor.issue as Issue, members: new Set(ids) }
    for (const group of overlapping) {
      group.members.forEach(id => merged.members.add(id))
      groups.splice(groups.indexOf(group), 1)
    }
    groups.push(merged)
  }
  return groups.map(g => ({ issue: g.issue, members: [...g.members].sort() }))
}
