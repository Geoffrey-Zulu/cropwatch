import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { serve } from '@hono/node-server'
import { fieldApp } from './fieldEvidence/app'
import { collectEvidence } from './fieldEvidence/providers'
import { fieldTokenVerifier } from './fieldEvidence/firebaseToken'

const path = process.env.FIELD_DATABASE ?? '/data/fields.sqlite'
mkdirSync(dirname(path), { recursive: true })
const db = new DatabaseSync(path)
const app = fieldApp(
  db,
  fieldTokenVerifier(process.env.FIREBASE_PROJECT_ID ?? 'crop-watch01'),
  collectEvidence,
  (
    process.env.CORS_ORIGINS ??
    'capacitor://localhost,http://localhost:5184,http://127.0.0.1:5184,https://crop-watch01-capture.web.app'
  ).split(',')
)
const server = serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8080) })
const stop = () =>
  server.close(() => {
    db.close()
    process.exit(0)
  })
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
