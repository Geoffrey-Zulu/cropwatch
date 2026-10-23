import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore'
import { firebaseConfig } from './firebaseConfig'

// No Analytics (CLAUDE.md). Firestore keeps a local cache, so "my reports" opens at once and
// survives a dropped connection.
export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = initializeFirestore(app, { localCache: persistentLocalCache() })
