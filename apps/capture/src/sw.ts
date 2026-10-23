/// <reference lib="webworker" />
// The capture app's one service worker: precaches the app shell (so it opens with no signal),
// serves it for every navigation, and shows area-alert pushes in the background. No offline
// triage and no API caching: diagnosis needs the server.
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'
import { clientsClaim } from 'workbox-core'
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { firebaseConfig } from './lib/firebaseConfig'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

self.skipWaiting()
clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// Alerts are FCM data messages (AlertPushData in the frozen contract): title and body are in
// the data, so this worker shows them. Simulated alerts are labelled (invariant 5).
const messaging = getMessaging(initializeApp(firebaseConfig))
onBackgroundMessage(messaging, payload => {
  const data = payload.data ?? {}
  const demo = data.sim === 'true' ? 'DEMO · ' : ''
  void self.registration.showNotification(`${demo}${data.title ?? 'Crop alert'}`, {
    body: data.body ?? '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.alert_id ?? 'cropwatch-alert',
    data: { url: '/#/' },
  })
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      const open = windows.find(w => new URL(w.url).origin === self.location.origin)
      return open ? open.focus() : self.clients.openWindow('/#/')
    })
  )
})
