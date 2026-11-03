import { Hono } from 'hono'
import { parsePhotoPath } from '@repo/shared'
import { bearerToken, type VerifyEventarcToken } from '../auth'
import type { Dispatch } from '../services/alerts/dispatch'
import type { ProcessObservation } from '../services/pipeline'

export interface EventServices {
  verifyEventarcToken: VerifyEventarcToken
  process: ProcessObservation
  dispatch: Dispatch
}

// Eventarc pushes here on google.cloud.storage.object.v1.finalized (infra/deploy.sh). The body
// is the Storage object; only observation photos matter. A non-2xx reply makes Eventarc retry,
// so failures propagate as 500s (which also retries a recommendation that failed).
export function eventRoutes(services: EventServices) {
  const app = new Hono()

  app.post('/storage', async c => {
    const token = bearerToken(c.req.header('authorization'))
    if (!token || !(await services.verifyEventarcToken(token))) {
      return c.json({ error: 'unauthorized' }, 401)
    }
    const object = (await c.req.json().catch(() => null)) as { name?: unknown } | null
    const photo = typeof object?.name === 'string' ? parsePhotoPath(object.name) : null
    if (!photo) return c.json({ ignored: true })
    return c.json({ obs_id: photo.obsId, ...(await services.process(photo.obsId)) })
  })

  // Pub/Sub push from the alerts topic (infra/deploy.sh): {message: {data: base64 {alert_id}}}.
  // Signed by the same service account as Eventarc. A malformed message is acknowledged rather
  // than retried forever; a dispatch error returns 500 so Pub/Sub retries it, and so does a
  // delivery that finds another one mid-dispatch (503): if that one dies, the retry after its
  // claim expires sends the alert; if it finishes, the retry is acknowledged as "already".
  app.post('/alerts', async c => {
    const token = bearerToken(c.req.header('authorization'))
    if (!token || !(await services.verifyEventarcToken(token))) {
      return c.json({ error: 'unauthorized' }, 401)
    }
    const body = (await c.req.json().catch(() => null)) as { message?: { data?: string } } | null
    let alertId: unknown
    try {
      alertId = JSON.parse(
        Buffer.from(body?.message?.data ?? '', 'base64').toString('utf8')
      ).alert_id
    } catch {
      alertId = null
    }
    if (typeof alertId !== 'string' || !alertId) return c.json({ ignored: true })
    const outcome = await services.dispatch(alertId)
    return c.json({ alert_id: alertId, outcome }, outcome === 'in_progress' ? 503 : 200)
  })

  return app
}
