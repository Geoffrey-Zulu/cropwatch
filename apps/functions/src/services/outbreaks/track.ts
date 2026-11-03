import {
  CLUSTER_MIN_WEIGHT,
  CLUSTER_RADIUS_KM,
  findDistrict,
  riskRose,
  weatherFactor,
  type KnownIssue,
  type ObservationRow,
} from '@repo/shared'
import { log } from '../../lib/log'
import type { DetectedCluster } from './detect'
import type { OutbreakStore, RiskUpdate } from './outbreakStore'

export interface TrackOutcome {
  recorded: boolean
  clusters: { id: string; kind: string; size: number }[]
  risk: { district_slug: string; level: string }[]
  alerts: string[]
}

export type Track = (obsId: string) => Promise<TrackOutcome>

// After a report changes (diagnosed, verified), and alongside its recommendation: record the
// snapshot in BigQuery, re-run the cluster rule for its issue, refresh district risk, and raise
// alerts. A new cluster is a verified cluster alert if an officer verified any report in it,
// otherwise a model risk signal; a district that has just turned HIGH without one raises a
// model risk signal; favourable forecast conditions raise a weather advisory (once a day per
// district and issue). Live cluster and risk alerts dispatch (push + SMS); advisories do not.
export function tracker({
  record,
  detect,
  store,
  now = () => new Date().toISOString(),
}: {
  record: (obsId: string) => Promise<ObservationRow | null>
  detect: (issue: KnownIssue, now: string) => Promise<DetectedCluster[]>
  store: OutbreakStore
  now?: () => string
}): Track {
  return async obsId => {
    const outcome: TrackOutcome = { recorded: false, clusters: [], risk: [], alerts: [] }
    const row = await record(obsId)
    if (!row) return outcome
    outcome.recorded = true
    const at = now()
    const raised = (id: string | null) => id && outcome.alerts.push(id)

    const districts = new Set([row.district_slug])
    let created: { id: string; cluster: DetectedCluster }[] = []
    if (row.issue && row.issue !== 'unknown' && row.verification_weight >= CLUSTER_MIN_WEIGHT) {
      const changes = await store.upsertClusters(row.issue, await detect(row.issue, at), at)
      outcome.clusters = changes.map(c => ({
        id: c.id,
        kind: c.kind,
        size: c.cluster.members.length,
      }))
      changes.forEach(c => districts.add(c.cluster.district_slug))
      created = changes.filter(c => c.kind === 'created')
    }

    const risks = new Map<string, RiskUpdate>()
    for (const slug of districts) risks.set(slug, await store.updateRisk(slug, at))
    outcome.risk = [...risks.values()].map(r => ({
      district_slug: r.district_slug,
      level: r.signal.level,
    }))

    const alerted = new Set<string>()
    for (const { id, cluster } of created) {
      const risk = risks.get(cluster.district_slug)!
      raised(
        await store.raiseAlert(
          {
            type: 'cluster',
            alert_class: cluster.verified > 0 ? 'verified_cluster' : 'model_risk_signal',
            issue: cluster.issue,
            district: cluster.district,
            district_slug: cluster.district_slug,
            center: cluster.center,
            radius_km: CLUSTER_RADIUS_KM,
            level: risk.signal.level,
            factors: risk.signal.factors,
            observation_ids: cluster.members,
            verified_reports: cluster.verified,
            sim: cluster.sim,
            cluster_id: id,
            dispatch: true,
          },
          at
        )
      )
      alerted.add(cluster.district_slug)
    }
    for (const risk of risks.values()) {
      if (alerted.has(risk.district_slug) || risk.signal.level !== 'HIGH') continue
      if (!riskRose(risk.previous, risk.signal.level)) continue
      const center = findDistrict(risk.district_slug)?.center
      if (!center) continue
      raised(
        await store.raiseAlert(
          {
            type: 'risk_change',
            alert_class: 'model_risk_signal',
            issue: row.district_slug === risk.district_slug && row.issue ? row.issue : 'unknown',
            district: risk.district,
            district_slug: risk.district_slug,
            center,
            radius_km: 25,
            level: risk.signal.level,
            factors: risk.signal.factors,
            observation_ids: [obsId],
            verified_reports: null,
            sim: risk.sim,
            cluster_id: null,
            dispatch: true,
          },
          at
        )
      )
    }

    // Weather advisories: forecast conditions only, never sent by SMS or push. "Watch" is the
    // most an advisory says; the district's own level stays with its report-based factors.
    for (const risk of risks.values()) {
      const center = findDistrict(risk.district_slug)?.center
      if (!center) continue
      for (const condition of risk.weather) {
        raised(
          await store.raiseAlert(
            {
              id: `weather-${risk.district_slug}-${condition.issue}-${at.slice(0, 10)}`,
              type: 'risk_change',
              alert_class: 'weather_advisory',
              issue: condition.issue,
              district: risk.district,
              district_slug: risk.district_slug,
              center,
              radius_km: 25,
              level: 'ELEVATED',
              factors: [weatherFactor(condition)],
              observation_ids: [],
              verified_reports: null,
              sim: risk.sim,
              cluster_id: null,
              dispatch: false,
            },
            at
          )
        )
      }
    }

    log('INFO', 'tracked', { obs_id: obsId, ...outcome })
    return outcome
  }
}
