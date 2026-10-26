import {
  centroid,
  CLUSTER_MIN_REPORTS,
  clusters,
  ISSUE_LABELS,
  riskV0,
  type GeoPoint,
  type Issue,
  type RiskLevel,
} from '@repo/shared'
import { clusterPoints, type SeedData } from './generate'

// The outbreak state the seed implies at its anchor, written the way the API writes it
// (apps/functions/src/services/outbreaks): clusters/{id}, risk/{district_slug}, alerts/{id}.
// Seeded alerts are history: their dispatch record is "skipped" and nothing is ever sent.

export interface SeedCluster {
  id: string
  issue: Issue
  district: string
  district_slug: string
  center: GeoPoint
  members: string[]
  new_last_24h: number
  // When the fifth member arrived.
  first_detected_at: string
  alert_id: string
}

export interface SeedRisk {
  district: string
  district_slug: string
  level: RiskLevel
  contributing_factors: string[]
}

export interface SeedAlert {
  id: string
  issue: Issue
  district: string
  district_slug: string
  center: GeoPoint
  level: RiskLevel
  contributing_factors: string[]
  observation_ids: string[]
  created_at: string
  cluster_id: string
}

const DAY = 86_400_000

export function seedOutbreaks(data: Pick<SeedData, 'anchor' | 'observations'>) {
  const { anchor, observations } = data
  const at = Date.parse(anchor)
  const byId = new Map(observations.map(o => [o.id, o.observation]))

  const found: SeedCluster[] = clusters(clusterPoints(data), anchor).map((cluster, i) => {
    const members = cluster.members.map(id => byId.get(id)!)
    // The district most members are in (as the API's detector names it).
    const counts = new Map<string, { district: string; n: number }>()
    for (const m of members) {
      const entry = counts.get(m.district_slug) ?? { district: m.district, n: 0 }
      entry.n++
      counts.set(m.district_slug, entry)
    }
    const [slug, top] = [...counts].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))[0]
    const times = members.map(m => m.created_at).sort()
    const id = `sim-cluster-${i + 1}`
    return {
      id,
      issue: cluster.issue,
      district: top.district,
      district_slug: slug,
      center: centroid(members.map(m => m.location)),
      members: cluster.members,
      new_last_24h: members.filter(m => Date.parse(m.created_at) > at - DAY).length,
      first_detected_at: times[CLUSTER_MIN_REPORTS - 1],
      alert_id: `sim-alert-${i + 1}`,
    }
  })

  // Risk v0 for every district with seeded reports, counted as the API counts them.
  const districts = new Map(observations.map(o => [o.observation.district_slug, o.observation]))
  const risk = new Map<string, SeedRisk>()
  for (const [slug, { district }] of districts) {
    const ages = observations
      .filter(o => o.observation.district_slug === slug)
      .map(o => at - Date.parse(o.observation.created_at))
      .filter(age => age >= 0)
    const signal = riskV0({
      district,
      reportsThisWeek: ages.filter(age => age < 7 * DAY).length,
      reportsLastWeek: ages.filter(age => age >= 7 * DAY && age < 14 * DAY).length,
      clusters: found
        .filter(c => c.district_slug === slug)
        .map(c => ({
          issueLabel: ISSUE_LABELS[c.issue],
          size: c.members.length,
          newLast24h: c.new_last_24h,
        })),
    })
    risk.set(slug, {
      district,
      district_slug: slug,
      level: signal.level,
      contributing_factors: signal.factors,
    })
  }

  const alerts: SeedAlert[] = found.map(c => {
    const r = risk.get(c.district_slug)!
    return {
      id: c.alert_id,
      issue: c.issue,
      district: c.district,
      district_slug: c.district_slug,
      center: c.center,
      level: r.level,
      contributing_factors: r.contributing_factors,
      observation_ids: c.members,
      created_at: c.first_detected_at,
      cluster_id: c.id,
    }
  })

  return { clusters: found, risk: [...risk.values()], alerts }
}
