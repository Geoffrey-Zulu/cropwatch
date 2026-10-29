import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// Public client config for crop-watch01 (CLAUDE.md Environment); safe to commit. No Analytics.
export const firebaseConfig = {
  apiKey: 'AIzaSyB6brxOl9sgWsf7X059B1rZvLiWXCPDTqU',
  authDomain: 'crop-watch01.firebaseapp.com',
  projectId: 'crop-watch01',
  storageBucket: 'crop-watch01.firebasestorage.app',
  messagingSenderId: '24960589333',
  appId: '1:24960589333:web:cbe577be90032352c4f81c',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
