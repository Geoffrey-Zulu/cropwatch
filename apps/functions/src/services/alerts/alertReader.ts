import type { Firestore } from 'firebase-admin/firestore'
import {
  AlertSchema,
  alertClassOf,
  AlertViewSchema,
  ISSUE_LABELS,
  type AlertView,
} from '@repo/shared'
import { fromFirestore } from '../../lib/firestoreData'

export type ListAlerts = (districtSlug: string) => Promise<AlertView[]>

// GET /alerts?district= (frozen contract): the district's alerts, newest first. A single-field
// filter, sorted here: a district has few alerts, and no composite index is needed.
export function firestoreAlerts(db: Firestore, limit = 20): ListAlerts {
  return async districtSlug => {
    const snap = await db
      .collection('alerts')
      .where('district_slug', '==', districtSlug)
      .limit(200)
      .get()
    const alerts: AlertView[] = []
    for (const doc of snap.docs) {
      const parsed = AlertSchema.safeParse(fromFirestore(doc.data()))
      if (!parsed.success) continue
      const a = parsed.data
      alerts.push(
        AlertViewSchema.parse({
          alert_id: doc.id,
          type: a.type,
          issue: a.issue,
          issue_label: ISSUE_LABELS[a.issue],
          district: a.district,
          district_slug: a.district_slug,
          level: a.level,
          contributing_factors: a.contributing_factors,
          geo_center: a.geo_center,
          radius_km: a.radius_km,
          created_at: a.created_at,
          sim: a.sim,
          alert_class: alertClassOf(a),
          reports: a.observation_ids.length,
          ...(a.verified_reports != null && { verified_reports: a.verified_reports }),
        })
      )
    }
    return alerts.sort((x, y) => y.created_at.localeCompare(x.created_at)).slice(0, limit)
  }
}
