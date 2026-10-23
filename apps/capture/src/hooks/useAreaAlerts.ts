import { collection, limit, onSnapshot, query, Timestamp, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { AlertSchema, type Alert } from '@repo/shared'
import { db } from '../lib/firebase'

export type AreaAlert = Alert & { id: string }

// District-level cluster alerts (no farm locations), live. Rows that do not match the schema
// are skipped rather than shown half-formed.
export function useAreaAlerts(districtSlug: string | null) {
  const [alerts, setAlerts] = useState<AreaAlert[] | null>(null)

  useEffect(() => {
    if (!districtSlug) {
      setAlerts([])
      return
    }
    return onSnapshot(
      query(collection(db, 'alerts'), where('district_slug', '==', districtSlug), limit(20)),
      snap => {
        const parsed: AreaAlert[] = []
        for (const d of snap.docs) {
          const data = d.data()
          const result = AlertSchema.safeParse({
            ...data,
            created_at:
              data.created_at instanceof Timestamp
                ? data.created_at.toDate().toISOString()
                : data.created_at,
            geo_center: data.geo_center && {
              latitude: data.geo_center.latitude,
              longitude: data.geo_center.longitude,
            },
          })
          if (result.success) parsed.push({ ...result.data, id: d.id })
        }
        setAlerts(parsed.sort((a, b) => b.created_at.localeCompare(a.created_at)))
      },
      () => setAlerts([])
    )
  }, [districtSlug])

  return alerts
}
