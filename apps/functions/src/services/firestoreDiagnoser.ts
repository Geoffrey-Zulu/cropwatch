import { Timestamp, type Firestore } from 'firebase-admin/firestore'
import type { getStorage } from 'firebase-admin/storage'
import type { Observation } from '@repo/shared'
import { fromFirestore, toTimestamp } from '../lib/firestoreData'
import { log } from '../lib/log'
import {
  buildModelRequest,
  diagnosisRecords,
  runDiagnosis,
  type GenerateFn,
  type Photo,
} from './diagnosisModel'
import type { Prompt } from './prompt'

export type DiagnoseOutcome =
  'diagnosed' | 'missing' | 'not_diagnosing' | 'in_progress' | 'waiting_for_photos'

export type Diagnose = (obsId: string) => Promise<DiagnoseOutcome>

type Bucket = ReturnType<ReturnType<typeof getStorage>['bucket']>

// A crashed run's claim expires, so a later trigger can take over.
const LEASE_MS = 120_000
// Inline image data must stay well under Gemini's 20 MB request limit.
const MAX_PHOTO_BYTES = 15 * 1024 * 1024

async function loadPhotos(bucket: Bucket, paths: string[]): Promise<Photo[] | null> {
  const photos: Photo[] = []
  let total = 0
  for (const path of paths) {
    const file = bucket.file(path)
    const [exists] = await file.exists()
    if (!exists) return null
    const [bytes] = await file.download()
    if (total + bytes.length > MAX_PHOTO_BYTES) break
    total += bytes.length
    photos.push({ mimeType: 'image/jpeg', data: bytes.toString('base64') })
  }
  return photos
}

// Both POST /observations and the Storage-finalize event call this; it is idempotent. It runs
// only once the document exists, is still diagnosing and has all its photos, and a lease in
// observations/{id}/internal/diagnosis_lock keeps concurrent triggers from double-running it.
export function firestoreDiagnoser({
  db,
  bucket,
  generate,
  prompt,
  modelId,
}: {
  db: Firestore
  bucket: Bucket
  generate: GenerateFn
  prompt: Prompt
  modelId: string
}): Diagnose {
  return async obsId => {
    const ref = db.collection('observations').doc(obsId)
    const internal = ref.collection('internal')
    const lease = internal.doc('diagnosis_lock')

    const claim = await db.runTransaction(async tx => {
      const [snap, lock] = await tx.getAll(ref, lease)
      if (!snap.exists) return 'missing' as const
      if (snap.get('status') !== 'diagnosing') return 'not_diagnosing' as const
      const claimedAt = lock.exists ? (lock.get('claimed_at') as Timestamp) : null
      if (claimedAt && Date.now() - claimedAt.toMillis() < LEASE_MS) return 'in_progress' as const
      tx.set(lease, { claimed_at: Timestamp.now() })
      return 'claimed' as const
    })
    if (claim !== 'claimed') return claim

    try {
      const observation = fromFirestore((await ref.get()).data()) as Observation
      const photos = await loadPhotos(bucket, observation.photo_paths)
      if (!photos) {
        await lease.delete()
        return 'waiting_for_photos'
      }

      const started = Date.now()
      const run = await runDiagnosis(generate, buildModelRequest(prompt, observation, photos), {
        modelId,
      })
      const records = diagnosisRecords(run, prompt.version, new Date().toISOString())

      const batch = db.batch()
      batch.update(ref, {
        diagnosis: {
          ...records.diagnosis,
          diagnosed_at: toTimestamp(records.diagnosis.diagnosed_at),
        },
        status: records.status,
        verification_state: records.verificationState,
      })
      batch.set(internal.doc('diagnosis'), {
        ...records.internal,
        created_at: toTimestamp(records.internal.created_at),
      })
      batch.delete(lease)
      await batch.commit()

      log('INFO', 'diagnosed', {
        obs_id: obsId,
        issue: records.diagnosis.suspected_issue,
        band: records.diagnosis.confidence_band,
        routed: records.diagnosis.expert_review_reason,
        attempts: run.attempts,
        model_ms: Date.now() - started,
      })
      return 'diagnosed'
    } catch (error) {
      await lease.delete().catch(() => {})
      throw error
    }
  }
}
