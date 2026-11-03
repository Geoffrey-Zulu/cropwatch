import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { getStorage } from 'firebase-admin/storage'
import type { Env } from './env'

// Admin SDK on Application Default Credentials: the cropwatch-api service account on Cloud Run.
// It bypasses security rules, so every write path goes through the shared schemas.
export function firebase(env: Pick<Env, 'projectId' | 'storageBucket'>) {
  const app =
    getApps()[0] ?? initializeApp({ projectId: env.projectId, storageBucket: env.storageBucket })
  const storage = getStorage(app)
  return {
    auth: getAuth(app),
    db: getFirestore(app),
    bucket: storage.bucket(),
    storage,
    messaging: getMessaging(app),
  }
}
