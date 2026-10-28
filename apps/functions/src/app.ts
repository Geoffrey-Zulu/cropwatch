import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from './trpc/router'
import { bearerToken } from './auth'
import { eventRoutes, type EventServices } from './rest/events'
import { restV1, type RestServices } from './rest/v1'
import { errorFields, log } from './lib/log'
import type { DashboardServices } from './services/dashboard/types'

export type AppServices = RestServices & EventServices & { dashboard: DashboardServices }

export interface AppOptions {
  // Browser origins: the dashboard (/trpc) and the capture PWA (/api/v1). Mobile and Eventarc
  // are not browsers and need none.
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
  // The capture PWA is a browser client of the same REST contract as the mobile app.
  app.use(
    '/api/v1/*',
    cors({
      origin: corsOrigins,
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['authorization', 'content-type'],
      maxAge: 600,
    })
  )
  app.all('/trpc/*', c =>
    fetchRequestHandler({
      endpoint: '/trpc',
      req: c.req.raw,
      router: appRouter,
      // The dashboard signs in with Firebase; a missing or invalid token is an anonymous caller,
      // which every dashboard procedure refuses.
      createContext: async ({ req }) => {
        const token = bearerToken(req.headers.get('authorization') ?? undefined)
        const caller = token ? await services.verifyIdToken(token).catch(() => null) : null
        return { caller, services: services.dashboard }
      },
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
