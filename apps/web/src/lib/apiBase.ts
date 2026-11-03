// The API on Cloud Run: tRPC at /trpc, the REST contract at /api/v1. infra/deploy.sh builds
// with VITE_API_BASE; local dev may point it at the API on localhost:3001.
export const API_BASE: string =
  import.meta.env.VITE_API_BASE || 'https://cropwatch-api-24960589333.europe-west1.run.app'
