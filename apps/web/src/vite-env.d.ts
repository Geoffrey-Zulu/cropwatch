/// <reference types="vite/client" />

interface ImportMetaEnv {
  // The API base (no path); infra/deploy.sh sets it to the deployed Cloud Run service.
  readonly VITE_API_BASE?: string
  // "true" shows the dry-spell scenario (lib/features.ts).
  readonly VITE_FEATURE_SCENARIO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
