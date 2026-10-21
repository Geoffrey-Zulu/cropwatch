import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from './trpc/router'
import { eventRoutes, type EventServices } from './rest/events'
import { restV1, type RestServices } from './rest/v1'
import { errorFields, log } from './lib/log'

export type AppServices = RestServices & EventServices

export interface AppOptions {
  // Browser origins allowed to call /trpc (the dashboard). Mobile and Eventarc are not browsers.
  corsOrigins: string[]
  services: AppServices
  logRequests?: boolean
}

export function createApp({ corsOrigins, services, logRequests = false }: AppOptions) {
  const app = new Hono()

  if (logRequests) app.use(logger())

  // Not /healthz: Cloud Run reserves paths ending in "z".
  app.get('/health', c => c.json({ status: 'ok' }))

  app.use('/trpc/*', cors({ origin: corsOrigins }))
  app.all('/trpc/*', c =>
    fetchRequestHandler({
      endpoint: '/trpc',
      req: c.req.raw,
      router: appRouter,
      createContext: () => ({}),
    })
  )

  app.route('/api/v1', restV1(services))
  app.route('/internal/events', eventRoutes(services))

  app.notFound(c => c.json({ error: 'not_found' }, 404))
  app.onError((err, c) => {
    log('ERROR', 'unhandled', { path: c.req.path, ...errorFields(err) })
    return c.json({ error: 'internal' }, 500)
  })

  return app
}
