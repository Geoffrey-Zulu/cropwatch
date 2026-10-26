import { GeoPoint, Timestamp, type Firestore } from 'firebase-admin/firestore'
import {
  findDistrict,
  ISSUE_LABELS,
  riskV0,
  CLUSTER_RADIUS_KM,
  type Alert,
  type GeoPoint as Point,
  type Issue,
  type KnownIssue,
  type RiskLevel,
  type RiskSignal,
} from '@repo/shared'
import type { BigQuery } from '../analytics/bigquery'
import type { DetectedCluster } from './detect'

export interface ClusterChange {
  id: string
  kind: 'created' | 'grown' | 'unchanged'
  cluster: DetectedCluster
}

export interface RiskUpdate {
  district: string
  district_slug: string
  previous: RiskLevel | null
  signal: RiskSignal
  sim: boolean
}

export interface NewAlert {
  type: Alert['type']
  issue: Issue
  district: string
  district_slug: string
  center: Point
  radius_km: number
  level: RiskLevel
  factors: string[]
  observation_ids: string[]
  sim: boolean
  cluster_id: string | null
  // Live reports dispatch; backfills (seed, recompute) never send anything.
  dispatch: boolean
}

export interface OutbreakStore {
  upsertClusters(
    issue: KnownIssue,
    detected: DetectedCluster[],
    now: string
  ): Promise<ClusterChange[]>
  updateRisk(districtSlug: string, now: string): Promise<RiskUpdate>
  raiseAlert(alert: NewAlert, now: string): Promise<string>
}

const overlap = (a: string[], b: string[]) => {
  const set = new Set(a)
  return b.some(id => set.has(id))
}

export const riskCountsSql = (dataset: string) => `
SELECT
  COUNTIF(created_at > TIMESTAMP_SUB(@now, INTERVAL 7 DAY)) AS this_week,
  COUNTIF(created_at <= TIMESTAMP_SUB(@now, INTERVAL 7 DAY)) AS last_week,
  IFNULL(LOGICAL_OR(sim), FALSE) AS sim
FROM \`${dataset}.observations_latest\`
WHERE district_slug = @district
  AND created_at > TIMESTAMP_SUB(@now, INTERVAL 14 DAY)
  AND created_at <= @now`

// Firestore: clusters/{id}, risk/{district_slug}, alerts/{id} (+ internal/dispatch). Every write
// goes through the API; clients only read (infra/firestore.rules).
export function firestoreOutbreaks({
  db,
  bigquery,
  dataset,
  publish,
}: {
  db: Firestore
  bigquery: BigQuery
  dataset: string
  publish: (alertId: string) => Promise<void>
}): OutbreakStore {
  const clusters = db.collection('clusters')

  return {
    // One transaction per issue: concurrent reports cannot create the same cluster twice. A
    // detected cluster continues the stored one it shares members with; stored clusters that no
    // longer qualify (members aged out) close.
    async upsertClusters(issue, detected, now) {
      return db.runTransaction(async tx => {
        const open = await tx.get(clusters.where('issue', '==', issue).where('active', '==', true))
        const stored = open.docs.map(doc => ({
          id: doc.id,
          members: doc.get('members') as string[],
        }))
        const used = new Set<string>()
        const changes: ClusterChange[] = []
        for (const cluster of detected) {
          const match = stored.find(s => !used.has(s.id) && overlap(s.members, cluster.members))
          const fields = {
            issue,
            district: cluster.district,
            district_slug: cluster.district_slug,
            center: new GeoPoint(cluster.center.latitude, cluster.center.longitude),
            radius_km: CLUSTER_RADIUS_KM,
            members: cluster.members,
            size: cluster.members.length,
            new_last_24h: cluster.newLast24h,
            sim: cluster.sim,
            active: true,
            updated_at: Timestamp.fromDate(new Date(now)),
          }
          if (match) {
            used.add(match.id)
            tx.update(clusters.doc(match.id), fields)
            const grew = cluster.members.some(id => !match.members.includes(id))
            changes.push({ id: match.id, kind: grew ? 'grown' : 'unchanged', cluster })
          } else {
            const ref = clusters.doc()
            tx.set(ref, { ...fields, first_detected_at: fields.updated_at, alert_id: null })
            changes.push({ id: ref.id, kind: 'created', cluster })
          }
        }
        for (const s of stored) {
          if (!used.has(s.id)) {
            tx.update(clusters.doc(s.id), {
              active: false,
              closed_at: Timestamp.fromDate(new Date(now)),
            })
          }
        }
        return changes
      })
    },

    async updateRisk(districtSlug, now) {
      const [counts] = await bigquery.query<{ this_week: number; last_week: number; sim: boolean }>(
        riskCountsSql(dataset),
        { district: districtSlug, now: { timestamp: now } }
      )
      const active = await clusters
        .where('district_slug', '==', districtSlug)
        .where('active', '==', true)
        .get()
      const ref = db.collection('risk').doc(districtSlug)
      const previous = ((await ref.get()).get('level') as RiskLevel | undefined) ?? null
      const district = findDistrict(districtSlug)?.name ?? districtSlug
      const clusterSim = active.docs.some(d => d.get('sim') === true)
      const signal = riskV0({
        district,
        reportsThisWeek: counts?.this_week ?? 0,
        reportsLastWeek: counts?.last_week ?? 0,
        clusters: active.docs.map(d => ({
          issueLabel: ISSUE_LABELS[d.get('issue') as Issue],
          size: d.get('size') as number,
          newLast24h: (d.get('new_last_24h') as number) ?? 0,
        })),
      })
      const sim = (counts?.sim ?? false) || clusterSim
      const computedAt = Timestamp.fromDate(new Date(now))
      await ref.set({
        district,
        district_slug: districtSlug,
        level: signal.level,
        contributing_factors: signal.factors,
        computed_at: computedAt,
        sim,
      })
      await bigquery
        .insert('risk_scores', [
          {
            insertId: `${districtSlug}:${now}`,
            json: {
              district_slug: districtSlug,
              district,
              level: signal.level,
              contributing_factors: signal.factors,
              computed_at: now,
              sim,
            },
          },
        ])
        .catch(() => {})
      return { district, district_slug: districtSlug, previous, signal, sim }
    },

    async raiseAlert(alert, now) {
      const ref = db.collection('alerts').doc()
      const batch = db.batch()
      batch.set(ref, {
        type: alert.type,
        issue: alert.issue,
        district: alert.district,
        district_slug: alert.district_slug,
        geo_center: new GeoPoint(alert.center.latitude, alert.center.longitude),
        radius_km: alert.radius_km,
        level: alert.level,
        contributing_factors: alert.factors,
        observation_ids: alert.observation_ids.slice(0, 100),
        channels_sent: [],
        created_at: Timestamp.fromDate(new Date(now)),
        sim: alert.sim,
        cluster_id: alert.cluster_id,
      })
      batch.set(ref.collection('internal').doc('dispatch'), {
        state: alert.dispatch ? 'pending' : 'skipped',
        updated_at: Timestamp.fromDate(new Date(now)),
      })
      if (alert.cluster_id)
        batch.update(db.collection('clusters').doc(alert.cluster_id), { alert_id: ref.id })
      await batch.commit()
      if (alert.dispatch) await publish(ref.id)
      return ref.id
    },
  }
}
