import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { bodyLimit } from 'hono/body-limit'
import {
  FieldInputSchema,
  type FieldRecord,
  type FieldEvidence,
  type FieldInput,
} from '@repo/shared'
import { fieldArea } from './geometry'

type Collect = (geometry: FieldInput['geometry'], fieldId: string | null) => Promise<FieldEvidence>
export function fieldApp(
  db: DatabaseSync,
  verify: (token: string) => Promise<string>,
  collect: Collect,
  origins: string[]
) {
  db.exec(
    'PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS fields(id TEXT PRIMARY KEY, owner TEXT NOT NULL, record TEXT NOT NULL, report TEXT); CREATE INDEX IF NOT EXISTS fields_owner ON fields(owner);'
  )
  const app = new Hono<{ Variables: { uid: string } }>()
  app.use(
    '*',
    cors({
      origin: origin => (origins.includes(origin) ? origin : ''),
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowHeaders: ['authorization', 'content-type'],
    })
  )
  app.use(
    '*',
    bodyLimit({
      maxSize: 32768,
      onError: c => c.json({ message: 'Boundary request is too large' }, 413),
    })
  )
  app.get('/health', c =>
    c.json({
      status: 'ok',
      service: 'phytos-field-evidence',
      catalogue: 'Sentinel-2 L2A / Earth Search',
      ndvi_configured: Boolean(process.env.CDSE_CLIENT_ID && process.env.CDSE_CLIENT_SECRET),
    })
  )
  app.use('/v1/*', async (c, next) => {
    const token = /^Bearer (\S+)$/.exec(c.req.header('authorization') ?? '')?.[1]
    if (!token) return c.json({ message: 'Sign in to access your field evidence.' }, 401)
    try {
      c.set('uid', await verify(token))
    } catch {
      return c.json({ message: 'Your sign-in token is invalid or expired.' }, 401)
    }
    await next()
  })
  const recent = new Map<string, number>()
  const limited = (key: string, seconds: number) => {
    const now = Date.now(),
      previous = recent.get(key) ?? 0
    if (now - previous < seconds * 1000) return true
    if (recent.size > 10000) for (const [k, t] of recent) if (now - t > 3600000) recent.delete(k)
    recent.set(key, now)
    return false
  }
  let context: FieldEvidence | null = null
  let contextPending: Promise<FieldEvidence> | null = null
  app.get('/v1/satellite/context', async c => {
    if (context && Date.now() - Date.parse(context.retrieved_at) < 6 * 3600000)
      return c.json(context)
    const region: FieldInput['geometry'] = {
      type: 'Polygon',
      coordinates: [
        [
          [27.47, -16.29],
          [27.49, -16.29],
          [27.49, -16.27],
          [27.47, -16.27],
          [27.47, -16.29],
        ],
      ],
    }
    contextPending ??= collect(region, null).finally(() => {
      contextPending = null
    })
    context = await contextPending
    return c.json(context)
  })
  app.get('/v1/fields', c => {
    const rows = db
      .prepare('SELECT record FROM fields WHERE owner=? ORDER BY rowid DESC')
      .all(c.get('uid'))
    return c.json({ fields: rows.map(row => JSON.parse(String(row.record))) })
  })
  app.post('/v1/fields', async c => {
    const uid = c.get('uid')
    if (limited(`save:${uid}`, 3))
      return c.json({ message: 'Wait a few seconds before saving another field.' }, 429)
    const count = db.prepare('SELECT COUNT(*) AS n FROM fields WHERE owner=?').get(uid)
    if (Number(count?.n) >= 20)
      return c.json({ message: 'This pilot supports up to 20 fields per user.' }, 400)
    const parsed = FieldInputSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success)
      return c.json(
        { message: 'Enter a field name, crop, season and a closed GeoJSON Polygon boundary.' },
        400
      )
    let area: number
    try {
      area = fieldArea(parsed.data.geometry)
    } catch (error) {
      return c.json({ message: (error as Error).message }, 400)
    }
    const record: FieldRecord = {
      ...parsed.data,
      id: randomUUID(),
      area_ha: area,
      boundary_status: 'claimed',
      created_at: new Date().toISOString(),
    }
    db.prepare('INSERT INTO fields(id,owner,record) VALUES(?,?,?)').run(
      record.id,
      uid,
      JSON.stringify(record)
    )
    return c.json(record, 201)
  })
  app.get('/v1/fields/:id/evidence', c => {
    const row = db
      .prepare('SELECT report FROM fields WHERE id=? AND owner=?')
      .get(c.req.param('id'), c.get('uid'))
    if (!row) return c.json({ message: 'Field not found.' }, 404)
    return c.json({ report: row.report ? JSON.parse(String(row.report)) : null })
  })
  app.post('/v1/fields/:id/evidence', async c => {
    const uid = c.get('uid'),
      id = c.req.param('id')
    const row = db.prepare('SELECT record FROM fields WHERE id=? AND owner=?').get(id, uid)
    if (!row) return c.json({ message: 'Field not found.' }, 404)
    if (limited(`refresh:${uid}`, 60))
      return c.json(
        { message: 'Wait one minute before requesting another satellite assessment.' },
        429
      )
    const field = JSON.parse(String(row.record)) as FieldRecord
    const report = await collect(field.geometry, id)
    db.prepare('UPDATE fields SET report=? WHERE id=? AND owner=?').run(
      JSON.stringify(report),
      id,
      uid
    )
    return c.json(report)
  })
  app.delete('/v1/fields/:id', c => {
    const result = db
      .prepare('DELETE FROM fields WHERE id=? AND owner=?')
      .run(c.req.param('id'), c.get('uid'))
    return result.changes ? c.json({ deleted: true }) : c.json({ message: 'Field not found.' }, 404)
  })
  app.onError((_error, c) =>
    c.json({ message: 'Field evidence is temporarily unavailable. Try again shortly.' }, 500)
  )
  return app
}
