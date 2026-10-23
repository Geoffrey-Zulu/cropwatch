/// <reference types="vite/client" />

interface ImportMetaEnv {
  // The REST v1 base URL; infra/deploy.sh sets it to the deployed API.
  readonly VITE_API_URL?: string
  // Public web-push (VAPID) key from the Firebase console. Unset: alert push stays off.
  readonly VITE_FCM_VAPID_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
