// Cloud Run entry point: tRPC at /trpc, the mobile REST contract at /api/v1, and the Eventarc
// receiver at /internal/events.
import { ThinkingLevel } from '@google/genai'
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { eventarcVerifier, firebaseTokenVerifier } from './auth'
import { readEnv } from './env'
import { firebase } from './firebase'
import { log } from './lib/log'
import { withTransientRetry } from './services/diagnosisModel'
import { firestoreDiagnoser } from './services/firestoreDiagnoser'
import { firestoreObservations } from './services/firestoreObservations'
import { firestoreRecommender, registeredProducts } from './services/firestoreRecommender'
import { geminiDiagnosisModel, geminiJsonModel } from './services/gemini'
import { pipeline } from './services/pipeline'
import { loadPrompt } from './services/prompt'
import { COMPOSITION_RESPONSE_SCHEMA, ragKnowledge } from './services/recommend/ragKnowledge'
import {
  cachedIndex,
  parseGcsUri,
  vertexRetrieve,
  withRetrieveRetry,
} from './services/recommend/vertexRag'

const env = readEnv()
const { auth, db, bucket, storage } = firebase(env)
// Loaded at startup so a missing prompt fails the deploy, not the first farmer.
const prompt = loadPrompt('diagnose-v1')
const recommendPrompt = loadPrompt('recommend-v1')

const index = parseGcsUri(env.knowledgeIndexUri)
const knowledge = ragKnowledge({
  loadIndex: cachedIndex(async () => {
    const [bytes] = await storage.bucket(index.bucket).file(index.object).download()
    return bytes
  }),
  retrieve: withRetrieveRetry(vertexRetrieve()),
  compose: withTransientRetry(
    geminiJsonModel(env, {
      responseJsonSchema: COMPOSITION_RESPONSE_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: 4096,
      thinkingLevel: ThinkingLevel.LOW,
      timeoutMs: 30_000,
    })
  ),
  prompt: recommendPrompt,
  modelId: env.geminiModel,
})

const app = createApp({
  corsOrigins: env.corsOrigins,
  logRequests: true,
  services: {
    version: env.version,
    verifyIdToken: firebaseTokenVerifier(auth),
    verifyEventarcToken: eventarcVerifier(env.eventarcServiceAccount),
    observations: firestoreObservations(db),
    process: pipeline(
      firestoreDiagnoser({
        db,
        bucket,
        generate: withTransientRetry(geminiDiagnosisModel(env)),
        prompt,
        modelId: env.geminiModel,
      }),
      firestoreRecommender({
        db,
        knowledge,
        products: registeredProducts(db),
        allowPlaceholders: env.allowPlaceholderProducts,
      })
    ),
  },
})

const server = serve({ fetch: app.fetch, port: env.port }, info => {
  log('INFO', 'listening', {
    port: info.port,
    model: env.geminiModel,
    prompt: prompt.version,
    recommend_prompt: recommendPrompt.version,
    knowledge_index: env.knowledgeIndexUri,
    placeholders: env.allowPlaceholderProducts,
    version: env.version,
  })
})

// Cloud Run sends SIGTERM before stopping an instance; finish in-flight requests first.
process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
