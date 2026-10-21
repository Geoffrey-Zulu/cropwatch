// Cloud Run entry point: tRPC at /trpc, the mobile REST contract at /api/v1, and the Eventarc
// receiver at /internal/events.
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { eventarcVerifier, firebaseTokenVerifier } from './auth'
import { readEnv } from './env'
import { firebase } from './firebase'
import { log } from './lib/log'
import { withTransientRetry } from './services/diagnosisModel'
import { firestoreDiagnoser } from './services/firestoreDiagnoser'
import { firestoreObservations } from './services/firestoreObservations'
import { geminiDiagnosisModel } from './services/gemini'
import { loadPrompt } from './services/prompt'

const env = readEnv()
const { auth, db, bucket } = firebase(env)
// Loaded at startup so a missing prompt fails the deploy, not the first farmer.
const prompt = loadPrompt('diagnose-v1')

const app = createApp({
  corsOrigins: env.corsOrigins,
  logRequests: true,
  services: {
    version: env.version,
    verifyIdToken: firebaseTokenVerifier(auth),
    verifyEventarcToken: eventarcVerifier(env.eventarcServiceAccount),
    observations: firestoreObservations(db),
    diagnose: firestoreDiagnoser({
      db,
      bucket,
      generate: withTransientRetry(geminiDiagnosisModel(env)),
      prompt,
      modelId: env.geminiModel,
    }),
  },
})

const server = serve({ fetch: app.fetch, port: env.port }, info => {
  log('INFO', 'listening', {
    port: info.port,
    model: env.geminiModel,
    prompt: prompt.version,
    version: env.version,
  })
})

// Cloud Run sends SIGTERM before stopping an instance; finish in-flight requests first.
process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
