import type { Firestore } from 'firebase-admin/firestore'
import type {
  CreateObservationRequest,
  Observation,
  ObservationStatus,
  Recommendation,
  VerifyRequest,
} from '@repo/shared'
import { fromFirestore, toGeoPoint, toTimestamp } from '../lib/firestoreData'
import {
  applyVerification,
  canVerifyObservation,
  newObservation,
  toObservationView,
  toRecommendationView,
  type Caller,
  type ObservationRecord,
} from './observationModel'

export type CreateResult =
  { kind: 'created' | 'exists'; status: ObservationStatus } | { kind: 'forbidden' }

export type VerifyResult =
  | { kind: 'verified'; record: ObservationRecord; recommend: boolean }
  | { kind: 'not_found' | 'forbidden' }

export interface ObservationStore {
  create(caller: Caller, request: CreateObservationRequest, now: string): Promise<CreateResult>
  get(obsId: string): Promise<ObservationRecord | null>
  verify(caller: Caller, obsId: string, request: VerifyRequest, now: string): Promise<VerifyResult>
}

export function firestoreObservations(db: Firestore): ObservationStore {
  const observations = db.collection('observations')

  async function record(obsId: string, observation: Observation): Promise<ObservationRecord> {
    let recommendation = null
    if (observation.recommendation_id) {
      const rec = await db.collection('recommendations').doc(observation.recommendation_id).get()
      if (rec.exists) {
        recommendation = toRecommendationView(fromFirestore(rec.data()) as Recommendation)
      }
    }
    return {
      view: toObservationView(obsId, observation, recommendation),
      reporterId: observation.reporter_id,
      orgId: observation.org_id,
    }
  }

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
      return record(obsId, fromFirestore(snap.data()) as Observation)
    },

    async verify(caller, obsId, request, now) {
      const ref = observations.doc(obsId)
      const result = await db.runTransaction(async tx => {
        const snap = await tx.get(ref)
        if (!snap.exists) return { kind: 'not_found' as const }
        const observation = fromFirestore(snap.data()) as Observation
        if (!canVerifyObservation(caller, { orgId: observation.org_id })) {
          return { kind: 'forbidden' as const }
        }
        const verified = applyVerification(caller, observation, request)
        const { verification_state, verified_by, verified_issue, status, recommendation_id } =
          verified.observation
        tx.update(ref, {
          verification_state,
          verified_by,
          verified_issue,
          status,
          recommendation_id,
        })
        // Who verified what, and why: internal, never in the contract view.
        tx.set(ref.collection('internal').doc('verification'), {
          verified_by: caller.uid,
          role: caller.role,
          verified_issue,
          previous_issue:
            observation.verified_issue ?? observation.diagnosis?.suspected_issue ?? null,
          notes: request.notes ?? null,
          verified_at: toTimestamp(now),
        })
        return { kind: 'verified' as const, verified }
      })
      if (result.kind !== 'verified') return result
      return {
        kind: 'verified',
        record: await record(obsId, result.verified.observation),
        recommend: result.verified.recommend,
      }
    },
  }
}
