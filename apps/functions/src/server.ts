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
import { firestoreAlerts } from './services/alerts/alertReader'
import { firestoreDashboard } from './services/dashboard/firestoreDashboard'
import { openMeteo } from './services/weather/openMeteo'
import { fcmPush, firestoreDispatcher } from './services/alerts/dispatch'
import { pubsubPublisher } from './services/alerts/pubsub'
import { africasTalking, smsLogOnly } from './services/alerts/sms'
import { bigQueryRest } from './services/analytics/bigquery'
import { observationRecorder } from './services/analytics/observationEvents'
import { clusterDetector } from './services/outbreaks/detect'
import { firestoreOutbreaks } from './services/outbreaks/outbreakStore'
import { tracker } from './services/outbreaks/track'
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
const { auth, db, bucket, storage, messaging } = firebase(env)
// Loaded at startup so a missing prompt fails the deploy, not the first farmer.
const prompt = loadPrompt('diagnose-v1')
const recommendPrompt = loadPrompt('recommend-v1')

const index = parseGcsUri(env.knowledgeIndexUri)
const loadIndex = cachedIndex(async () => {
  const [bytes] = await storage.bucket(index.bucket).file(index.object).download()
  return bytes
})
const knowledge = ragKnowledge({
  loadIndex,
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

// Outbreaks (technicaldoc §9–10): BigQuery snapshots and the cluster rule, Firestore clusters,
// risk and alerts, Pub/Sub to dispatch, FCM and Africa's Talking to deliver.
// Open-Meteo forecasts: weather context for risk and advisories, and the dashboard.
const weather = openMeteo()
const bigquery = bigQueryRest({
  projectId: env.projectId,
  location: env.location,
  dataset: env.bigQueryDataset,
})
const track = tracker({
  record: observationRecorder({ db, bigquery }),
  detect: clusterDetector(bigquery, env.bigQueryDataset),
  store: firestoreOutbreaks({
    db,
    bigquery,
    dataset: env.bigQueryDataset,
    publish: pubsubPublisher({ projectId: env.projectId, topic: env.alertsTopic }),
    weather,
  }),
})
const sms = env.sms
  ? africasTalking({
      username: env.sms.username,
      apiKey: env.sms.apiKey,
      from: env.sms.senderId ?? undefined,
      sandbox: env.sms.sandbox,
    })
  : smsLogOnly

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
      }),
      track
    ),
    alerts: firestoreAlerts(db),
    dispatch: firestoreDispatcher({ db, push: fcmPush(messaging), sms }),
    dashboard: firestoreDashboard({ db, index: loadIndex, weather }),
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
    sms_gateway: sms.name,
    version: env.version,
  })
})

// Cloud Run sends SIGTERM before stopping an instance; finish in-flight requests first.
process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
