import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FieldInput, FieldEvidence } from '@repo/shared'
import { fieldArea } from './geometry'
import { fieldApp } from './app'
import { collectEvidence } from './providers'

const geometry: FieldInput['geometry'] = {
  type: 'Polygon',
  coordinates: [
    [
      [27.48, -16.28],
      [27.482, -16.28],
      [27.482, -16.278],
      [27.48, -16.278],
      [27.48, -16.28],
    ],
  ],
}
const input: FieldInput = {
  name: 'Integration test field',
  crop: 'soybean',
  season: '2026/27',
  planting_date: null,
  capture_method: 'imported',
  geometry,
}
const evidence: FieldEvidence = {
  field_id: null,
  scope: 'regional',
  retrieved_at: new Date().toISOString(),
  catalogue_source: 'Sentinel-2 L2A / Earth Search',
  scenes: [],
  catalogue_status: 'ok',
  vegetation_source: 'Copernicus Sentinel Hub Statistical API',
  vegetation_status: 'not_configured',
  readings: [],
  review_status: 'officer_review_required',
}

describe('claimed boundaries', () => {
  it('computes approximate hectares from longitude/latitude coordinates', () =>
    expect(fieldArea(geometry)).toBeCloseTo(4.757, 1))
  it('rejects a single pin, open rings, self-crossing polygons and non-Zambian coordinates', () => {
    expect(() =>
      fieldArea({
        type: 'Polygon',
        coordinates: [
          [
            [27.48, -16.28],
            [27.48, -16.28],
            [27.48, -16.28],
            [27.48, -16.28],
          ],
        ],
      })
    ).toThrow()
    expect(() =>
      fieldArea({ type: 'Polygon', coordinates: [geometry.coordinates[0].slice(0, -1)] })
    ).toThrow('Close')
    expect(() =>
      fieldArea({
        type: 'Polygon',
        coordinates: [
          [
            [27.48, -16.28],
            [27.482, -16.278],
            [27.482, -16.28],
            [27.48, -16.278],
            [27.48, -16.28],
          ],
        ],
      })
    ).toThrow('cross')
    expect(() =>
      fieldArea({
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      })
    ).toThrow('Zambia')
  })
})

describe('field ownership', () => {
  const databases: DatabaseSync[] = []
  afterEach(() => {
    databases.splice(0).forEach(db => db.close())
  })
  it('uses the verified caller for every read, refresh and delete', async () => {
    const db = new DatabaseSync(':memory:')
    databases.push(db)
    const collector = vi.fn(async () => evidence)
    const app = fieldApp(
      db,
      async token => {
        if (!['a', 'b'].includes(token)) throw new Error()
        return token
      },
      collector,
      []
    )
    const headers = { authorization: 'Bearer a', 'content-type': 'application/json' }
    expect((await app.request('/v1/fields')).status).toBe(401)
    const created = await app.request('/v1/fields', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...input, owner: 'b' }),
    })
    expect(created.status).toBe(201)
    const field = (await created.json()) as { id: string; boundary_status: string }
    expect(field.boundary_status).toBe('claimed')
    expect(
      await (await app.request('/v1/fields', { headers: { authorization: 'Bearer b' } })).json()
    ).toEqual({ fields: [] })
    expect(
      (
        await app.request(`/v1/fields/${field.id}/evidence`, {
          headers: { authorization: 'Bearer b' },
        })
      ).status
    ).toBe(404)
    expect(
      (
        await app.request(`/v1/fields/${field.id}/evidence`, {
          method: 'POST',
          headers: { authorization: 'Bearer b' },
        })
      ).status
    ).toBe(404)
    expect(collector).not.toHaveBeenCalled()
    expect(
      (
        await app.request(`/v1/fields/${field.id}`, {
          method: 'DELETE',
          headers: { authorization: 'Bearer b' },
        })
      ).status
    ).toBe(404)
    expect(
      (await app.request(`/v1/fields/${field.id}/evidence`, { method: 'POST', headers })).status
    ).toBe(200)
    expect(collector).toHaveBeenCalledWith(geometry, field.id)
    expect(
      (await app.request(`/v1/fields/${field.id}/evidence`, { method: 'POST', headers })).status
    ).toBe(429)
    expect(
      (await app.request(`/v1/fields/${field.id}`, { method: 'DELETE', headers })).status
    ).toBe(200)
  })
})

describe('satellite provenance and coverage', () => {
  const catalog = () =>
    Response.json({
      features: [
        {
          id: 'real-scene-id',
          properties: { datetime: '2026-10-30T08:00:00Z', 'eo:cloud_cover': 35 },
          assets: {
            thumbnail: {
              href: 'https://sentinel-cogs.s3.us-west-2.amazonaws.com/test/preview.jpg',
            },
          },
        },
      ],
    })
  it('returns real scene metadata without synthesizing NDVI when credentials are absent', async () => {
    const request = vi.fn(async () => catalog()) as unknown as typeof fetch
    const report = await collectEvidence(geometry, 'field-id', {}, request)
    expect(report.scenes[0].scene_cloud_pct).toBe(35)
    expect(report.readings).toEqual([])
    expect(report.vegetation_status).toBe('not_configured')
    expect(report.review_status).toBe('officer_review_required')
  })
  it('filters cloudy/no-data intervals and keeps qualified field pixels separate from scene cloud cover', async () => {
    const request = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
      if (String(url).endsWith('/search')) return catalog()
      if (String(url).endsWith('/token')) return Response.json({ access_token: 'test-only' })
      const body = JSON.parse(String(options?.body))
      expect(body.input.bounds.properties.crs).toContain('4326')
      expect(body.aggregation.resx).toBeGreaterThan(0.00009)
      expect(body.aggregation.resx).toBeLessThan(0.0001)
      expect(body.aggregation.resy).toBeCloseTo(0.00009037, 7)
      const interval = { from: '2026-10-20T00:00:00Z', to: '2026-10-25T00:00:00Z' }
      const row = (mean: number | string, sampleCount: number, noDataCount: number) => ({
        interval,
        outputs: { ndvi: { bands: { B0: { stats: { mean, sampleCount, noDataCount } } } } },
      })
      return Response.json({
        data: [row(0.54, 100, 20), row(0.65, 100, 90), row('NaN', 100, 0), row(0.2, 5, 0)],
      })
    }) as unknown as typeof fetch
    const report = await collectEvidence(
      geometry,
      'field-id',
      { CDSE_CLIENT_ID: 'test', CDSE_CLIENT_SECRET: 'test' },
      request
    )
    expect(report.vegetation_status).toBe('ok')
    expect(report.readings).toHaveLength(1)
    expect(report.readings[0]).toMatchObject({ ndvi: 0.54, valid_pixel_pct: 80, valid_pixels: 80 })
    expect(report.scenes[0].scene_cloud_pct).toBe(35)
  })
  it('does not replace failed Copernicus authentication with a demo success', async () => {
    const request = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith('/search') ? catalog() : new Response('{}', { status: 401 })
    ) as unknown as typeof fetch
    const report = await collectEvidence(
      geometry,
      'field-id',
      { CDSE_CLIENT_ID: 'invalid', CDSE_CLIENT_SECRET: 'invalid' },
      request
    )
    expect(report.vegetation_status).toBe('authorization_failed')
    expect(report.catalogue_status).toBe('ok')
    expect(report.readings).toEqual([])
  })
  it('reuses a valid OAuth token across field assessments', async () => {
    const request = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith('/search')) return catalog()
      if (String(url).endsWith('/token'))
        return Response.json({ access_token: 'cached-test-only', expires_in: 3600 })
      return Response.json({ data: [] })
    }) as unknown as typeof fetch
    const env = { CDSE_CLIENT_ID: 'reuse-test', CDSE_CLIENT_SECRET: 'reuse-test' }
    await collectEvidence(geometry, 'field-a', env, request)
    await collectEvidence(geometry, 'field-b', env, request)
    expect(
      vi.mocked(request).mock.calls.filter(([url]) => String(url).endsWith('/token'))
    ).toHaveLength(1)
  })
})
