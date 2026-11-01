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

  useEffect(() => {
    let active = true
    let signInRequested = false
    const timeoutId = window.setTimeout(() => {
      if (active) {
        setState(current => current.user
          ? current
          : {
              user: null,
              error: signInRequested
                ? 'Anonymous sign-in request timed out after 15 seconds.'
                : 'Firebase session initialization timed out after 15 seconds, before a sign-in request could start.',
            })
      }
    }, 15_000)

    const unsubscribe = onAuthStateChanged(
      auth,
      user => {
        if (!active) return
        if (user) {
          window.clearTimeout(timeoutId)
          setState({ user, error: null })
          return
        }
        if (signInRequested) return
        signInRequested = true
        signInAnonymously(auth).then(
          ({ user: signedInUser }) => {
            if (!active) return
            window.clearTimeout(timeoutId)
            setState({ user: signedInUser, error: null })
          },
          (reason: unknown) => {
            if (!active) return
            window.clearTimeout(timeoutId)
            setState({
              user: null,
              error: reason instanceof Error ? reason.message : String(reason),
            })
          },
        )
      },
      reason => {
        if (!active) return
        window.clearTimeout(timeoutId)
        setState({
          user: null,
          error: reason instanceof Error ? reason.message : String(reason),
        })
      },
    )

    return () => {
      active = false
      window.clearTimeout(timeoutId)
      unsubscribe()
    }
  }, [])

  return state
}
