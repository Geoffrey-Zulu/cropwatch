import { Hono, type Context, type MiddlewareHandler } from 'hono'
import type { ZodError } from 'zod'
import {
  CreateObservationRequestSchema,
  ObservationIdSchema,
  parsePhotoPath,
  VerifyRequestSchema,
  type ErrorResponse,
} from '@repo/shared'
import { bearerToken, type VerifyIdToken } from '../auth'
import { errorFields, log } from '../lib/log'
import type { ObservationStore } from '../services/firestoreObservations'
import type { ProcessObservation } from '../services/pipeline'
import { canReadObservation, type Caller } from '../services/observationModel'

export interface RestServices {
  version: string
  verifyIdToken: VerifyIdToken
  observations: ObservationStore
  process: ProcessObservation
  now?: () => Date
}

type Env = { Variables: { caller: Caller } }

const fail = (c: Context, status: 400 | 401 | 403 | 404 | 501, body: ErrorResponse) =>
  c.json(body, status)

const validationFailed = (c: Context, error: ZodError) =>
  fail(c, 400, {
    error: 'validation_failed',
    issues: error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })),
  })

const notImplemented = (c: Context) =>
  fail(c, 501, { error: 'not_implemented', message: `${c.req.method} ${c.req.routePath}` })

// /api/v1: the frozen mobile contract (packages/shared/src/contracts/openapi.json).
export function restV1(services: RestServices) {
  const now = services.now ?? (() => new Date())
  const app = new Hono<Env>()

  app.get('/health', c => c.json({ status: 'ok' as const, version: services.version }))

  const requireCaller: MiddlewareHandler<Env> = async (c, next) => {
    const token = bearerToken(c.req.header('authorization'))
    if (!token) return fail(c, 401, { error: 'unauthorized', message: 'Bearer token required' })
    try {
      c.set('caller', await services.verifyIdToken(token))
    } catch {
      return fail(c, 401, { error: 'unauthorized', message: 'Invalid or expired ID token' })
    }
    await next()
  }

  // Diagnosis and recommendation run in the background (Cloud Run keeps CPU allocated; see
  // infra/deploy.sh). Both are idempotent, so retries and the Storage event may trigger them too.
  const startProcessing = (obsId: string) =>
    services
      .process(obsId)
      .catch(error => log('ERROR', 'processing failed', { obs_id: obsId, ...errorFields(error) }))

  app.post('/observations', requireCaller, async c => {
    const caller = c.get('caller')
    const parsed = CreateObservationRequestSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return validationFailed(c, parsed.error)
    const request = parsed.data

    if (!request.photo_paths.every(path => parsePhotoPath(path)?.uid === caller.uid)) {
      return fail(c, 403, {
        error: 'forbidden',
        message: 'Photos must be under observations/{your uid}/',
      })
    }

    const result = await services.observations.create(caller, request, now().toISOString())
    if (result.kind === 'forbidden') {
      return fail(c, 403, { error: 'forbidden', message: 'obs_id belongs to another user' })
    }
    if (result.status === 'diagnosing' || result.status === 'recommending') {
      void startProcessing(request.obs_id)
    }
    return c.json(
      { obs_id: request.obs_id, status: result.status },
      result.kind === 'created' ? 201 : 200
    )
  })

  app.get('/observations/:id', requireCaller, async c => {
    const id = ObservationIdSchema.safeParse(c.req.param('id'))
    const record = id.success ? await services.observations.get(id.data) : null
    if (!record) return fail(c, 404, { error: 'not_found' })
    if (!canReadObservation(c.get('caller'), record)) return fail(c, 403, { error: 'forbidden' })
    return c.json(record.view)
  })

  app.post('/observations/:id/verify', requireCaller, async c => {
    const caller = c.get('caller')
    const id = ObservationIdSchema.safeParse(c.req.param('id'))
    if (!id.success) return fail(c, 404, { error: 'not_found' })
    const parsed = VerifyRequestSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return validationFailed(c, parsed.error)
    if (caller.role === 'farmer') {
      return fail(c, 403, { error: 'forbidden', message: 'Officers only' })
    }
    const result = await services.observations.verify(
      caller,
      id.data,
      parsed.data,
      now().toISOString()
    )
    if (result.kind !== 'verified') {
      return result.kind === 'not_found'
        ? fail(c, 404, { error: 'not_found' })
        : fail(c, 403, { error: 'forbidden' })
    }
    if (result.recommend) void startProcessing(id.data)
    return c.json(result.record.view)
  })

  // Frozen in the contract; built on later days (intervention/outcome D7, alerts D6).
  app.post('/observations/:id/intervention', requireCaller, notImplemented)
  app.post('/observations/:id/outcome', requireCaller, notImplemented)
  app.get('/alerts', requireCaller, notImplemented)

  return app
}
