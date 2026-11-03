import {
  centroid,
  CLUSTER_MIN_REPORTS,
  CLUSTER_MIN_WEIGHT,
  CLUSTER_RADIUS_KM,
  CLUSTER_WINDOW_HOURS,
  mergeAnchors,
  VERIFICATION_WEIGHTS,
  type GeoPoint,
  type KnownIssue,
} from '@repo/shared'
import type { BigQuery } from '../analytics/bigquery'

export interface ClusterRow {
  obs_id: string
  latitude: number
  longitude: number
  created_at: string
  district: string
  district_slug: string
  sim: boolean
  verification_weight: number
  neighbours: string[]
}

export interface DetectedCluster {
  issue: KnownIssue
  members: string[]
  center: GeoPoint
  // The district most members are in.
  district: string
  district_slug: string
  // Any simulated member makes the cluster simulated (CLAUDE.md invariant 5).
  sim: boolean
  newLast24h: number
  // Members an officer verified (field or expert): what makes it a verified cluster alert.
  verified: number
}

// technicaldoc §9 in BigQuery GIS: the latest state of each report (observations_latest), the
// qualifying ones for this issue, and each one's same-issue neighbours within 10 km. The anchors
// (≥ 5 including itself) merge in mergeAnchors, the same code the seed uses.
export const clusterSql = (dataset: string) => `
WITH q AS (
  SELECT obs_id, geo, created_at, district, district_slug, sim, verification_weight
  FROM \`${dataset}.observations_latest\`
  WHERE issue = @issue
    AND verification_weight >= ${CLUSTER_MIN_WEIGHT}
    AND created_at > TIMESTAMP_SUB(@now, INTERVAL ${CLUSTER_WINDOW_HOURS} HOUR)
    AND created_at <= @now
)
SELECT
  a.obs_id,
  ST_Y(ANY_VALUE(a.geo)) AS latitude,
  ST_X(ANY_VALUE(a.geo)) AS longitude,
  ANY_VALUE(a.created_at) AS created_at,
  ANY_VALUE(a.district) AS district,
  ANY_VALUE(a.district_slug) AS district_slug,
  ANY_VALUE(a.sim) AS sim,
  ANY_VALUE(a.verification_weight) AS verification_weight,
  ARRAY_AGG(b.obs_id) AS neighbours
FROM q AS a
JOIN q AS b ON ST_DWITHIN(a.geo, b.geo, ${CLUSTER_RADIUS_KM * 1000})
GROUP BY a.obs_id`

export function clustersFromRows(
  issue: KnownIssue,
  rows: ClusterRow[],
  now: string
): DetectedCluster[] {
  const byId = new Map(rows.map(row => [row.obs_id, row]))
  const anchors = rows
    .filter(row => row.neighbours.length >= CLUSTER_MIN_REPORTS)
    .map(row => ({ issue, members: row.neighbours }))
  const dayAgo = Date.parse(now) - 24 * 3_600_000

  return mergeAnchors(anchors).map(cluster => {
    const members = cluster.members.map(id => byId.get(id)!).filter(Boolean)
    const counts = new Map<string, { district: string; n: number }>()
    for (const m of members) {
      const entry = counts.get(m.district_slug) ?? { district: m.district, n: 0 }
      entry.n++
      counts.set(m.district_slug, entry)
    }
    const [slug, top] = [...counts].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))[0]
    return {
      issue,
      members: cluster.members,
      center: centroid(members.map(m => ({ latitude: m.latitude, longitude: m.longitude }))),
      district: top.district,
      district_slug: slug,
      sim: members.some(m => m.sim),
      newLast24h: members.filter(m => Date.parse(m.created_at) > dayAgo).length,
      verified: members.filter(m => m.verification_weight >= VERIFICATION_WEIGHTS.FIELD_VERIFIED)
        .length,
    }
  })
}

export function clusterDetector(bigquery: BigQuery, dataset: string) {
  return async (issue: KnownIssue, now: string) =>
    clustersFromRows(
      issue,
      await bigquery.query<ClusterRow>(clusterSql(dataset), { issue, now: { timestamp: now } }),
      now
    )
}
