// Runtime configuration, read once at startup. Cloud Run sets PORT and K_REVISION; the rest
// come from infra/deploy.sh. Defaults suit local development.
export interface Env {
  port: number
  corsOrigins: string[]
  projectId: string
  location: string
  // Where Gemini is called. The europe-west1 regional endpoint serves no current Gemini model
  // (2.5 retired on 2026-10-20; 3.x is offered on global and the us/eu multi-regions), so the
  // default is the EU multi-region: processing stays in the EU.
  geminiLocation: string
  geminiModel: string
  storageBucket: string
  // tools/corpus ingest writes it: the RAG corpus name and the curated document metadata.
  knowledgeIndexUri: string
  // Placeholder register rows are test data; only a deliberate demo set-up may allow them.
  allowPlaceholderProducts: boolean
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
    geminiLocation: source.GEMINI_LOCATION ?? 'eu',
    // Chosen 2026-10-23 after Gemini 2.5 retired: GA until at least July 2027, 12/12 valid and
    // 11/12 correct on the test photos, slowest 6.4 s (buildplan D4 log).
    geminiModel: source.GEMINI_MODEL ?? 'gemini-3.5-flash-lite',
    storageBucket: source.STORAGE_BUCKET ?? 'crop-watch01.firebasestorage.app',
    knowledgeIndexUri: source.KNOWLEDGE_INDEX_URI ?? 'gs://crop-watch01-knowledge/index.json',
    allowPlaceholderProducts: source.ALLOW_PLACEHOLDER_PRODUCTS === 'true',
    eventarcServiceAccount: source.EVENTARC_SERVICE_ACCOUNT ?? null,
    version: source.K_REVISION ?? 'dev',
  }
}
