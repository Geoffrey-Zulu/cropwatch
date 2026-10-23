import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { auth } from '../lib/firebase'

export interface AuthState {
  user: User | null
  error: string | null
}

// Demo farmers are anonymous (frozen contract: Auth). The uid persists on the device, so "my
// reports" survive closing the app.
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: auth.currentUser, error: null })

  useEffect(
    () =>
      onAuthStateChanged(auth, user => {
        if (user) {
          setState({ user, error: null })
          return
        }
        signInAnonymously(auth).catch((error: Error) =>
          setState({ user: null, error: error.message })
        )
      }),
    []
  )

  return state
}
