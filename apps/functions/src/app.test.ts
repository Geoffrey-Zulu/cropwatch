import { describe, it, expect } from 'vitest'
import { createApp } from './app'

const app = createApp({ corsOrigins: ['http://localhost:5173'] })

describe('createApp', () => {
  it('answers the health check', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('serves the tRPC router at /trpc', async () => {
    const res = await app.request('/trpc/user.list')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.data).toHaveLength(2)
  })

  it('allows the dashboard origin on /trpc', async () => {
    const res = await app.request('/trpc/user.list', {
      headers: { Origin: 'http://localhost:5173' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
  })

  it('does not allow other origins on /trpc', async () => {
    const res = await app.request('/trpc/user.list', {
      headers: { Origin: 'https://evil.example' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it.each([
    ['POST', '/api/v1/observations', '/api/v1/observations'],
    ['GET', '/api/v1/observations/abc', '/api/v1/observations/:id'],
    ['POST', '/api/v1/observations/abc/verify', '/api/v1/observations/:id/verify'],
    ['POST', '/api/v1/observations/abc/intervention', '/api/v1/observations/:id/intervention'],
    ['POST', '/api/v1/observations/abc/outcome', '/api/v1/observations/:id/outcome'],
    ['GET', '/api/v1/alerts?district=Chongwe', '/api/v1/alerts'],
  ])('stubs %s %s with 501', async (method, path, route) => {
    const res = await app.request(path, { method })
    expect(res.status).toBe(501)
    expect(await res.json()).toEqual({ error: 'not_implemented', route: `${method} ${route}` })
  })

  it('returns JSON 404 for unknown paths', async () => {
    const res = await app.request('/api/v2/observations')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
  })
})
