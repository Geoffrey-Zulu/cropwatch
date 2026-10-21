// Runtime configuration, read once at startup. Cloud Run sets PORT and K_REVISION; the rest
// come from infra/deploy.sh. Defaults suit local development.
export interface Env {
  port: number
  corsOrigins: string[]
  projectId: string
  location: string
  geminiModel: string
  storageBucket: string
  // Identity Eventarc signs its push requests with; unset locally, which disables the route.
  eventarcServiceAccount: string | null
  version: string
}

export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  return {
    // 3001 locally keeps clear of the Firestore emulator on 8080.
    port: Number(source.PORT ?? 3001),
    corsOrigins: (source.CORS_ORIGINS ?? 'http://localhost:5173')
      .split(',')
      .map(origin => origin.trim())
      .filter(Boolean),
    projectId: source.GOOGLE_CLOUD_PROJECT ?? 'crop-watch01',
    location: source.GOOGLE_CLOUD_LOCATION ?? 'europe-west1',
    geminiModel: source.GEMINI_MODEL ?? 'gemini-2.5-flash',
    storageBucket: source.STORAGE_BUCKET ?? 'crop-watch01.firebasestorage.app',
    eventarcServiceAccount: source.EVENTARC_SERVICE_ACCOUNT ?? null,
    version: source.K_REVISION ?? 'dev',
  }
}
