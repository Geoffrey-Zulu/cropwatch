import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { useCallback, useEffect, useState } from 'react'
import { app, db } from '../lib/firebase'
import { webPushPublicKey } from '../lib/firebaseConfig'

// Messaging loads only where push can work, so other browsers never download it.
const messagingModule = () => import('firebase/messaging')

// FCM web push for area alerts (Android Chrome). Anywhere it is unavailable (iOS outside a
// home-screen app, a browser without push) it reports "unsupported" and the UI simply leaves
// it out. VITE_FCM_VAPID_KEY overrides the key (another project); empty turns push off.
const VAPID_KEY: string | undefined = import.meta.env.VITE_FCM_VAPID_KEY ?? webPushPublicKey

export type PushState = 'checking' | 'unsupported' | 'off' | 'on' | 'blocked' | 'error'

export interface ForegroundAlert {
  title: string
  body: string
  sim: boolean
}

async function tokenId(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest).slice(0, 16), b => b.toString(16).padStart(2, '0')).join(
    ''
  )
}

// Web clients cannot subscribe themselves to FCM topics, so the token is kept under the user
// (users/{uid}/push_tokens, owner-only rules) with the district; the alert dispatcher (D6)
// subscribes it to alerts-{district_slug} or sends to it directly.
async function register(uid: string, districtSlug: string | null) {
  const { getMessaging, getToken } = await messagingModule()
  const messaging = getMessaging(app)
  const registration = await navigator.serviceWorker.ready
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  })
  await setDoc(doc(db, 'users', uid, 'push_tokens', await tokenId(token)), {
    token,
    district_slug: districtSlug,
    platform: 'web',
    updated_at: serverTimestamp(),
  })
}

export function usePush(uid: string | undefined, districtSlug: string | null) {
  const [state, setState] = useState<PushState>('checking')
  const [alert, setAlert] = useState<ForegroundAlert | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const supported =
        !!VAPID_KEY &&
        'Notification' in window &&
        'serviceWorker' in navigator &&
        (await (await messagingModule()).isSupported())
      if (cancelled) return
      if (!supported) return setState('unsupported')
      if (Notification.permission === 'denied') return setState('blocked')
      if (Notification.permission === 'default') return setState('off')
      // Already granted: refresh the token quietly (it can rotate) and keep the district current.
      if (uid) {
        try {
          await register(uid, districtSlug)
          if (!cancelled) setState('on')
        } catch {
          if (!cancelled) setState('error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [uid, districtSlug])

  useEffect(() => {
    if (state !== 'on') return
    let stop: (() => void) | undefined
    let cancelled = false
    void messagingModule().then(({ getMessaging, onMessage }) => {
      if (cancelled) return
      stop = onMessage(getMessaging(app), payload => {
        const data = payload.data ?? {}
        setAlert({
          title: data.title ?? 'Crop alert',
          body: data.body ?? '',
          sim: data.sim === 'true',
        })
      })
    })
    return () => {
      cancelled = true
      stop?.()
    }
  }, [state])

  // Permission is only ever asked for from a tap, never on load.
  const enable = useCallback(async () => {
    if (!uid) return
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return setState(permission === 'denied' ? 'blocked' : 'off')
    try {
      await register(uid, districtSlug)
      setState('on')
    } catch {
      setState('error')
    }
  }, [uid, districtSlug])

  return { state, enable, alert, dismissAlert: () => setAlert(null) }
}
