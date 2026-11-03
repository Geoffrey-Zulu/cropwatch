import { initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
} from 'firebase/auth'
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore'
import { firebaseConfig } from './firebaseConfig'

// No Analytics (CLAUDE.md). Firestore keeps a local cache, so "my reports" opens at once and
// survives a dropped connection.
export const app = initializeApp(firebaseConfig)
// Anonymous sign-in needs no popup/redirect resolver. Its eager iframe initialization on
// iOS can hold up the initial auth-state notification inside the Capacitor WebView.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
})
export const db = initializeFirestore(app, { localCache: persistentLocalCache() })
