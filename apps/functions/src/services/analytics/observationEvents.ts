import type { Firestore } from 'firebase-admin/firestore'
import {
  toObservationRow,
  type DiagnosisInternal,
  type Observation,
  type ObservationRow,
} from '@repo/shared'
import { fromFirestore } from '../../lib/firestoreData'
import type { BigQuery } from './bigquery'

export const OBSERVATION_EVENTS = 'observation_events'

// Appends the observation's current state to BigQuery observation_events (frozen contract
// condition 4: the internal diagnosis numbers go to BigQuery, never to the UI). Each change is a
// new snapshot; observations_latest keeps the newest per obs_id.
export function observationRecorder({
  db,
  bigquery,
  now = () => new Date().toISOString(),
}: {
  db: Firestore
  bigquery: BigQuery
  now?: () => string
}) {
  return async (obsId: string): Promise<ObservationRow | null> => {
    const ref = db.collection('observations').doc(obsId)
    const [snap, internal] = await Promise.all([
      ref.get(),
      ref.collection('internal').doc('diagnosis').get(),
    ])
    if (!snap.exists) return null
    const recordedAt = now()
    const row = toObservationRow(
      obsId,
      fromFirestore(snap.data()) as Observation,
      internal.exists ? (fromFirestore(internal.data()) as DiagnosisInternal) : null,
      recordedAt
    )
    await bigquery.insert(OBSERVATION_EVENTS, [{ insertId: `${obsId}:${recordedAt}`, json: row }])
    return row
  }
}
