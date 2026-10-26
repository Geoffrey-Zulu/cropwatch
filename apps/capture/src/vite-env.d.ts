/// <reference types="vite/client" />

interface ImportMetaEnv {
  // The REST v1 base URL; infra/deploy.sh sets it to the deployed API.
  readonly VITE_API_URL?: string
  // Overrides the web-push (VAPID) public key in lib/firebaseConfig.ts; empty turns push off.
  readonly VITE_FCM_VAPID_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
