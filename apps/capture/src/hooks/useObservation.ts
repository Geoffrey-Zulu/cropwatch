import type { User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import type { ObservationView } from '@repo/shared'
import { getObservation } from '../lib/api'
import { db } from '../lib/firebase'

export interface ObservationState {
  // The frozen contract's view (labels, bands, recommendation), fetched whenever the document
  // changes.
  view: ObservationView | null
  // From the live document, which may run ahead of the view by a moment.
  status: string | null
  error: string | null
}

// Progressive result, as the mobile plan describes: listen to the Firestore document (the
// reporter may read their own), and on each change read the contract view from GET
// /observations/{id}. Diagnosis lands first, then the recommendation.
export function useObservation(user: User | null, obsId: string): ObservationState {
  const [state, setState] = useState<ObservationState>({ view: null, status: null, error: null })

  useEffect(() => {
    if (!user) return
    let cancelled = false
    let latest = 0
    const refresh = async () => {
      const call = ++latest
      try {
        const view = await getObservation(await user.getIdToken(), obsId)
        if (!cancelled && call === latest) setState(s => ({ ...s, view, error: null }))
      } catch (error) {
        if (!cancelled) setState(s => ({ ...s, error: (error as Error).message }))
      }
    }
    const stop = onSnapshot(
      doc(db, 'observations', obsId),
      snap => {
        if (!snap.exists()) return
        setState(s => ({ ...s, status: String(snap.get('status')) }))
        void refresh()
      },
      error => setState(s => ({ ...s, error: error.message }))
    )
    return () => {
      cancelled = true
      stop()
    }
  }, [user, obsId])

  return state
}
