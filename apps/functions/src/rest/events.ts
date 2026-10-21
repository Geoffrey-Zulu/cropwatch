import { Hono } from 'hono'
import { parsePhotoPath } from '@repo/shared'
import { bearerToken, type VerifyEventarcToken } from '../auth'
import type { Diagnose } from '../services/firestoreDiagnoser'

export interface EventServices {
  verifyEventarcToken: VerifyEventarcToken
  diagnose: Diagnose
}

// Eventarc pushes here on google.cloud.storage.object.v1.finalized (infra/deploy.sh). The body
// is the Storage object; only observation photos matter. A non-2xx reply makes Eventarc retry,
// so failures propagate as 500s.
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
    return c.json({ obs_id: photo.obsId, outcome: await services.diagnose(photo.obsId) })
  })

  return app
}
