/// <reference types="vite/client" />

interface ImportMetaEnv {
  // The API base (no path); infra/deploy.sh sets it to the deployed Cloud Run service.
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
