import { Hono, type Context } from 'hono'

// /api/v1: REST adapter for the Flutter app and Eventarc webhooks (buildplan.md §2). Request
// and response shapes come from @repo/shared and freeze on D2. Until each route is built it
// answers 501, so the mobile client can wire paths against a live server.
const notImplemented = (c: Context) =>
  c.json({ error: 'not_implemented', route: `${c.req.method} ${c.req.routePath}` }, 501)

export const restV1 = new Hono()
  .post('/observations', notImplemented)
  .get('/observations/:id', notImplemented)
  .post('/observations/:id/verify', notImplemented)
  .post('/observations/:id/intervention', notImplemented)
  .post('/observations/:id/outcome', notImplemented)
  .get('/alerts', notImplemented)
