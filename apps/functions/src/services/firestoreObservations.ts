import type { Firestore } from 'firebase-admin/firestore'
import type {
  CreateObservationRequest,
  Observation,
  ObservationStatus,
  Recommendation,
} from '@repo/shared'
import { fromFirestore, toGeoPoint, toTimestamp } from '../lib/firestoreData'
import {
  newObservation,
  toObservationView,
  toRecommendationView,
  type Caller,
  type ObservationRecord,
} from './observationModel'

export type CreateResult =
  { kind: 'created' | 'exists'; status: ObservationStatus } | { kind: 'forbidden' }

export interface ObservationStore {
  create(caller: Caller, request: CreateObservationRequest, now: string): Promise<CreateResult>
  get(obsId: string): Promise<ObservationRecord | null>
}

export function firestoreObservations(db: Firestore): ObservationStore {
  const observations = db.collection('observations')

  return {
    // First writer wins on obs_id: the same reporter gets the current status back (a safe
    // retry); anyone else is refused.
    create(caller, request, now) {
      const ref = observations.doc(request.obs_id)
      return db.runTransaction(async tx => {
        const snap = await tx.get(ref)
        if (snap.exists) {
          return snap.get('reporter_id') === caller.uid
            ? { kind: 'exists', status: snap.get('status') as ObservationStatus }
            : { kind: 'forbidden' }
        }
        const observation = newObservation(caller, request, now)
        tx.create(ref, {
          ...observation,
          created_at: toTimestamp(observation.created_at),
          location: toGeoPoint(observation.location),
        })
        return { kind: 'created', status: observation.status }
      })
    },

    async get(obsId) {
      const snap = await observations.doc(obsId).get()
      if (!snap.exists) return null
      const observation = fromFirestore(snap.data()) as Observation
      let recommendation = null
      if (observation.recommendation_id) {
        const rec = await db.collection('recommendations').doc(observation.recommendation_id).get()
        if (rec.exists)
          recommendation = toRecommendationView(fromFirestore(rec.data()) as Recommendation)
      }
      return {
        view: toObservationView(obsId, observation, recommendation),
        reporterId: observation.reporter_id,
        orgId: observation.org_id,
      }
    },
  }
}
