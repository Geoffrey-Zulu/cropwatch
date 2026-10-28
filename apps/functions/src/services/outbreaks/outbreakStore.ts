import { GeoPoint, Timestamp, type Firestore } from 'firebase-admin/firestore'
import {
  findDistrict,
  ISSUE_LABELS,
  riskV0,
  CLUSTER_RADIUS_KM,
  weatherConditions,
  weatherFactor,
  type Alert,
  type AlertClass,
  type GeoPoint as Point,
  type Issue,
  type KnownIssue,
  type RiskLevel,
  type RiskSignal,
  type WeatherCondition,
} from '@repo/shared'
import { errorFields, log } from '../../lib/log'
import type { BigQuery } from '../analytics/bigquery'
import type { FetchWeather } from '../weather/openMeteo'
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
  // Favourable forecast conditions for issues reported in the district (weather advisories).
  weather: WeatherCondition[]
}

export interface NewAlert {
  // A fixed id makes raising idempotent (one weather advisory per district, issue and day).
  id?: string
  type: Alert['type']
  alert_class: AlertClass
  issue: Issue
  district: string
  district_slug: string
  center: Point
  radius_km: number
  level: RiskLevel
  factors: string[]
  observation_ids: string[]
  verified_reports: number | null
  sim: boolean
  cluster_id: string | null
  // Live reports dispatch; backfills (seed, recompute) and advisories never send anything.
  dispatch: boolean
}

export interface OutbreakStore {
  upsertClusters(
    issue: KnownIssue,
    detected: DetectedCluster[],
    now: string
  ): Promise<ClusterChange[]>
  updateRisk(districtSlug: string, now: string): Promise<RiskUpdate>
  // Returns the alert id, or null when an alert with the given fixed id already exists.
  raiseAlert(alert: NewAlert, now: string): Promise<string | null>
}

const overlap = (a: string[], b: string[]) => {
  const set = new Set(a)
  return b.some(id => set.has(id))
}

const clusterClass = (verified: number): AlertClass =>
  verified > 0 ? 'verified_cluster' : 'model_risk_signal'

export const riskCountsSql = (dataset: string) => `
SELECT
  COUNTIF(created_at > TIMESTAMP_SUB(@now, INTERVAL 7 DAY)) AS this_week,
  COUNTIF(created_at <= TIMESTAMP_SUB(@now, INTERVAL 7 DAY)) AS last_week,
  IFNULL(LOGICAL_OR(sim), FALSE) AS sim,
  ARRAY_AGG(DISTINCT issue IGNORE NULLS) AS issues
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
  weather,
}: {
  db: Firestore
  bigquery: BigQuery
  dataset: string
  publish: (alertId: string) => Promise<void>
  weather?: FetchWeather
}): OutbreakStore {
  const clusters = db.collection('clusters')

  return {
    // One transaction per issue: concurrent reports cannot create the same cluster twice. A
    // detected cluster continues the stored one it shares members with; stored clusters that no
    // longer qualify (members aged out) close. When officers verify members, the cluster's alert
    // follows: its class becomes "verified cluster alert" and its counts stay current.
    async upsertClusters(issue, detected, now) {
      return db.runTransaction(async tx => {
        const open = await tx.get(clusters.where('issue', '==', issue).where('active', '==', true))
        const stored = open.docs.map(doc => ({
          id: doc.id,
          members: doc.get('members') as string[],
          verified: (doc.get('verified_members') as number | undefined) ?? 0,
          alertId: (doc.get('alert_id') as string | null | undefined) ?? null,
        }))
        const used = new Set<string>()
        const changes: ClusterChange[] = []
        const at = Timestamp.fromDate(new Date(now))
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
            verified_members: cluster.verified,
            sim: cluster.sim,
            active: true,
            updated_at: at,
          }
          if (match) {
            used.add(match.id)
            tx.update(clusters.doc(match.id), fields)
            const grew = cluster.members.some(id => !match.members.includes(id))
            const sameMembers = !grew && match.members.length === cluster.members.length
            if (match.alertId && (match.verified !== cluster.verified || !sameMembers)) {
              tx.update(db.collection('alerts').doc(match.alertId), {
                alert_class: clusterClass(cluster.verified),
                verified_reports: cluster.verified,
                observation_ids: cluster.members.slice(0, 100),
              })
            }
            changes.push({ id: match.id, kind: grew ? 'grown' : 'unchanged', cluster })
          } else {
            const ref = clusters.doc()
            tx.set(ref, { ...fields, first_detected_at: at, alert_id: null })
            changes.push({ id: ref.id, kind: 'created', cluster })
          }
        }
        for (const s of stored) {
          if (!used.has(s.id)) tx.update(clusters.doc(s.id), { active: false, closed_at: at })
        }
        return changes
      })
    },

    async updateRisk(districtSlug, now) {
      const [counts] = await bigquery.query<{
        this_week: number
        last_week: number
        sim: boolean
        issues: string[] | null
      }>(riskCountsSql(dataset), { district: districtSlug, now: { timestamp: now } })
      const active = await clusters
        .where('district_slug', '==', districtSlug)
        .where('active', '==', true)
        .get()
      const ref = db.collection('risk').doc(districtSlug)
      const previous = ((await ref.get()).get('level') as RiskLevel | undefined) ?? null
      const place = findDistrict(districtSlug)
      const district = place?.name ?? districtSlug

      // Weather is context: favourable conditions for issues reported here in the last 14 days
      // join the factors; they never set the level (v0). A failed forecast leaves them out.
      let favourable: WeatherCondition[] = []
      if (weather && place) {
        try {
          const reported = new Set(counts?.issues ?? [])
          favourable = weatherConditions(await weather(place.center)).filter(
            c => c.favourable && reported.has(c.issue)
          )
        } catch (error) {
          log('WARNING', 'weather unavailable', { district: districtSlug, ...errorFields(error) })
        }
      }

      const clusterSim = active.docs.some(d => d.get('sim') === true)
      const base = riskV0({
        district,
        reportsThisWeek: counts?.this_week ?? 0,
        reportsLastWeek: counts?.last_week ?? 0,
        clusters: active.docs.map(d => ({
          issueLabel: ISSUE_LABELS[d.get('issue') as Issue],
          size: d.get('size') as number,
          newLast24h: (d.get('new_last_24h') as number) ?? 0,
        })),
      })
      const signal: RiskSignal = {
        level: base.level,
        factors: [...base.factors, ...favourable.map(weatherFactor)],
      }
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
      return {
        district,
        district_slug: districtSlug,
        previous,
        signal,
        sim,
        weather: favourable,
      }
    },

    async raiseAlert(alert, now) {
      const ref = alert.id ? db.collection('alerts').doc(alert.id) : db.collection('alerts').doc()
      const batch = db.batch()
      const data = {
        type: alert.type,
        alert_class: alert.alert_class,
        issue: alert.issue,
        district: alert.district,
        district_slug: alert.district_slug,
        geo_center: new GeoPoint(alert.center.latitude, alert.center.longitude),
        radius_km: alert.radius_km,
        level: alert.level,
        contributing_factors: alert.factors,
        observation_ids: alert.observation_ids.slice(0, 100),
        verified_reports: alert.verified_reports,
        channels_sent: [],
        created_at: Timestamp.fromDate(new Date(now)),
        sim: alert.sim,
        cluster_id: alert.cluster_id,
      }
      // A fixed id is created once; a second raise for it is a no-op.
      if (alert.id) batch.create(ref, data)
      else batch.set(ref, data)
      batch.set(ref.collection('internal').doc('dispatch'), {
        state: alert.dispatch ? 'pending' : 'skipped',
        updated_at: Timestamp.fromDate(new Date(now)),
      })
      if (alert.cluster_id)
        batch.update(db.collection('clusters').doc(alert.cluster_id), { alert_id: ref.id })
      try {
        await batch.commit()
      } catch (error) {
        // gRPC 6: ALREADY_EXISTS.
        if (alert.id && (error as { code?: number }).code === 6) return null
        throw error
      }
      if (alert.dispatch) await publish(ref.id)
      return ref.id
    },
  }
}
