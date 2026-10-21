// Cloud Run entry point: serves tRPC at /trpc and the mobile REST adapter at /api/v1.
import { serve } from '@hono/node-server'
import { createApp } from './app'

// Cloud Run injects PORT (8080). Locally 3001 keeps clear of the Firestore emulator on 8080.
const port = Number(process.env.PORT ?? 3001)
const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

const app = createApp({ corsOrigins, logRequests: true })

const server = serve({ fetch: app.fetch, port }, info => {
  console.log(`CropWatch API listening on :${info.port}`)
})

// Cloud Run sends SIGTERM before stopping an instance; finish in-flight requests first.
process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
