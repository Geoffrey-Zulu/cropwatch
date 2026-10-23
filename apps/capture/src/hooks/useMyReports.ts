import { collection, limit, onSnapshot, query, Timestamp, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import type { ConfidenceBand, Crop, Issue } from '@repo/shared'
import { db } from '../lib/firebase'

export interface ReportSummary {
  id: string
  crop: Crop
  district: string
  districtSlug: string
  status: string
  createdAt: string
  issue: Issue | null
  band: ConfidenceBand | null
  sim: boolean
}

const iso = (value: unknown) =>
  value instanceof Timestamp ? value.toDate().toISOString() : new Date().toISOString()

// The farmer's own reports, live (security rules let a reporter read their own). A single-field
// filter needs no composite index; a farmer has few reports, so they are sorted here.
export function useMyReports(uid: string | undefined) {
  const [reports, setReports] = useState<ReportSummary[] | null>(null)

  useEffect(() => {
    if (!uid) return
    return onSnapshot(
      query(collection(db, 'observations'), where('reporter_id', '==', uid), limit(50)),
      snap =>
        setReports(
          snap.docs
            .map(d => {
              const data = d.data()
              return {
                id: d.id,
                crop: data.crop as Crop,
                district: String(data.district),
                districtSlug: String(data.district_slug),
                status: String(data.status),
                createdAt: iso(data.created_at),
                issue: (data.verified_issue ??
                  data.diagnosis?.suspected_issue ??
                  null) as Issue | null,
                band: (data.diagnosis?.confidence_band ?? null) as ConfidenceBand | null,
                sim: data.sim === true,
              }
            })
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        ),
      () => setReports([])
    )
  }, [uid])

  return reports
}
