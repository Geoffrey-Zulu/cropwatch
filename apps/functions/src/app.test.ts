import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Observation } from '@repo/shared'
import { createApp, type AppServices } from './app'
import type { Caller } from './services/observationModel'
import { newObservation, toObservationView } from './services/observationModel'
import type { ObservationStore } from './services/firestoreObservations'

const FARMER: Caller = { uid: 'farmerUid0001', role: 'farmer', orgId: 'org1' }
const OTHER_FARMER: Caller = { uid: 'farmerUid0002', role: 'farmer', orgId: null }
const AGRONOMIST: Caller = { uid: 'agronomist01', role: 'agronomist', orgId: null }
const OFFICER_SAME_ORG: Caller = { uid: 'officer00001', role: 'field_officer', orgId: 'org1' }
const OFFICER_OTHER_ORG: Caller = { uid: 'officer00002', role: 'field_officer', orgId: 'org2' }
const CALLERS: Record<string, Caller> = Object.fromEntries(
  [FARMER, OTHER_FARMER, AGRONOMIST, OFFICER_SAME_ORG, OFFICER_OTHER_ORG].map(c => [c.uid, c])
)

const OBS_ID = 'k3J9xQ2mW8pL5vR1tY7u'

const createBody = (uid = FARMER.uid, obsId = OBS_ID) => ({
  obs_id: obsId,
  crop: 'maize',
  location: { latitude: -13.6333, longitude: 32.65 },
  district: 'Chipata District',
  province: 'Eastern',
  photo_paths: [`observations/${uid}/${obsId}/0.jpg`],
  farmer_description: 'holes in the leaves',
})

// In memory, but built from the same pure functions as the Firestore store.
function memoryStore(): ObservationStore & { docs: Map<string, Observation> } {
  const docs = new Map<string, Observation>()
  return {
    docs,
    async create(caller, request, now) {
      const existing = docs.get(request.obs_id)
      if (existing) {
        return existing.reporter_id === caller.uid
          ? { kind: 'exists', status: existing.status }
          : { kind: 'forbidden' }
      }
      const observation = newObservation(caller, request, now)
      docs.set(request.obs_id, observation)
      return { kind: 'created', status: observation.status }
    },
    async get(obsId) {
      const observation = docs.get(obsId)
      if (!observation) return null
      return {
        view: toObservationView(obsId, observation, null),
        reporterId: observation.reporter_id,
        orgId: observation.org_id,
      }
    },
  }
}

let store: ReturnType<typeof memoryStore>
let services: AppServices
let app: ReturnType<typeof createApp>

beforeEach(() => {
  store = memoryStore()
  services = {
    version: 'test-rev',
    verifyIdToken: async token => {
      const caller = CALLERS[token]
      if (!caller) throw new Error('bad token')
      return caller
    },
    verifyEventarcToken: async token => token === 'eventarc-ok',
    observations: store,
    diagnose: vi.fn(async () => 'diagnosed' as const),
    now: () => new Date('2026-10-22T09:30:00.000Z'),
  }
  app = createApp({ corsOrigins: ['http://localhost:5173'], services })
})

const as = (caller: Caller | null, init: RequestInit = {}) => ({
  ...init,
  headers: {
    'content-type': 'application/json',
    ...(caller ? { authorization: `Bearer ${caller.uid}` } : {}),
  },
})
const post = (path: string, caller: Caller | null, body: unknown) =>
  app.request(path, as(caller, { method: 'POST', body: JSON.stringify(body) }))
const get = (path: string, caller: Caller | null) => app.request(path, as(caller))

describe('health', () => {
  it('answers at the root and in the contract', async () => {
    expect((await app.request('/health')).status).toBe(200)
    const res = await app.request('/api/v1/health')
    expect(await res.json()).toEqual({ status: 'ok', version: 'test-rev' })
  })
})

describe('tRPC', () => {
  it('is still served at /trpc with the dashboard origin allowed', async () => {
    const res = await app.request('/trpc/user.list', {
      headers: { Origin: 'http://localhost:5173' },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
  })

  it('does not allow other origins', async () => {
    const res = await app.request('/trpc/user.list', {
      headers: { Origin: 'https://evil.example' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })
})

describe('POST /api/v1/observations', () => {
  it('requires a valid Firebase ID token', async () => {
    expect((await post('/api/v1/observations', null, createBody())).status).toBe(401)
    const res = await app.request('/api/v1/observations', {
      method: 'POST',
      headers: { authorization: 'Bearer forged' },
      body: JSON.stringify(createBody()),
    })
    expect(res.status).toBe(401)
  })

  it('creates the observation, normalises the district and starts diagnosis', async () => {
    const res = await post('/api/v1/observations', FARMER, createBody())
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ obs_id: OBS_ID, status: 'diagnosing' })
    expect(services.diagnose).toHaveBeenCalledWith(OBS_ID)

    const stored = store.docs.get(OBS_ID)!
    expect(stored).toMatchObject({
      reporter_id: FARMER.uid,
      reporter_role: 'farmer',
      org_id: 'org1',
      district: 'Chipata District',
      district_slug: 'chipata',
      verification_state: 'UNVERIFIED',
      sim: false,
    })
    expect(stored.geohash).toHaveLength(9)
  })

  it('reports validation failures with the failing paths', async () => {
    const res = await post('/api/v1/observations', FARMER, { ...createBody(), crop: 'wheat' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('validation_failed')
    expect(body.issues.map((i: { path: string }) => i.path)).toContain('crop')
  })

  it('refuses photos under another uid (ownership binding)', async () => {
    const res = await post('/api/v1/observations', FARMER, createBody(OTHER_FARMER.uid))
    expect(res.status).toBe(403)
    expect(store.docs.size).toBe(0)
  })

  it('is first-writer-wins: a retry by the reporter is 200, another uid is 403', async () => {
    await post('/api/v1/observations', FARMER, createBody())
    const retry = await post('/api/v1/observations', FARMER, createBody())
    expect(retry.status).toBe(200)
    expect(await retry.json()).toEqual({ obs_id: OBS_ID, status: 'diagnosing' })

    const hijack = await post('/api/v1/observations', OTHER_FARMER, createBody(OTHER_FARMER.uid))
    expect(hijack.status).toBe(403)
    expect(store.docs.get(OBS_ID)!.reporter_id).toBe(FARMER.uid)
  })

  it('does not restart diagnosis once it is done', async () => {
    await post('/api/v1/observations', FARMER, createBody())
    store.docs.get(OBS_ID)!.status = 'recommending'
    vi.mocked(services.diagnose).mockClear()
    await post('/api/v1/observations', FARMER, createBody())
    expect(services.diagnose).not.toHaveBeenCalled()
  })
})

describe('GET /api/v1/observations/{id}', () => {
  beforeEach(async () => {
    await post('/api/v1/observations', FARMER, createBody())
  })

  it.each([
    ['the reporter', FARMER, 200],
    ['an agronomist', AGRONOMIST, 200],
    ['a field officer of the same org', OFFICER_SAME_ORG, 200],
    ['a field officer of another org', OFFICER_OTHER_ORG, 403],
    ['another farmer', OTHER_FARMER, 403],
  ])('%s gets %i', async (_, caller, status) => {
    expect((await get(`/api/v1/observations/${OBS_ID}`, caller)).status).toBe(status)
  })

  it('returns the contract view: no location, reporter or numbers', async () => {
    const view = await (await get(`/api/v1/observations/${OBS_ID}`, FARMER)).json()
    expect(view).toMatchObject({ obs_id: OBS_ID, status: 'diagnosing', district_slug: 'chipata' })
    const text = JSON.stringify(view)
    for (const hidden of ['location', 'latitude', 'geohash', 'reporter_id', 'model_confidence']) {
      expect(text).not.toContain(hidden)
    }
  })

  it('is 404 for unknown or malformed ids', async () => {
    expect((await get('/api/v1/observations/doesNotExist00000000', FARMER)).status).toBe(404)
    expect((await get('/api/v1/observations/bad!', FARMER)).status).toBe(404)
  })
})

describe('frozen routes built on later days', () => {
  it.each([
    ['POST', `/api/v1/observations/${OBS_ID}/verify`],
    ['POST', `/api/v1/observations/${OBS_ID}/intervention`],
    ['POST', `/api/v1/observations/${OBS_ID}/outcome`],
    ['GET', '/api/v1/alerts?district=Chongwe'],
  ])('%s %s needs auth, then answers 501', async (method, path) => {
    expect((await app.request(path, { method })).status).toBe(401)
    const res = await app.request(path, as(FARMER, { method }))
    expect(res.status).toBe(501)
    expect((await res.json()).error).toBe('not_implemented')
  })
})

describe('POST /internal/events/storage (Eventarc)', () => {
  const event = (name: string, token = 'eventarc-ok') =>
    app.request('/internal/events/storage', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ bucket: 'crop-watch01.firebasestorage.app', name }),
    })

  it('rejects anything not signed by the trigger account', async () => {
    expect((await event(`observations/u/${OBS_ID}/0.jpg`, 'forged')).status).toBe(401)
    expect(services.diagnose).not.toHaveBeenCalled()
  })

  it('diagnoses on a photo upload', async () => {
    const res = await event(`observations/${FARMER.uid}/${OBS_ID}/0.jpg`)
    expect(await res.json()).toEqual({ obs_id: OBS_ID, outcome: 'diagnosed' })
    expect(services.diagnose).toHaveBeenCalledWith(OBS_ID)
  })

  it('ignores other objects', async () => {
    expect(await (await event('exports/report.csv')).json()).toEqual({ ignored: true })
    expect(services.diagnose).not.toHaveBeenCalled()
  })
})

it('returns JSON 404 for unknown paths', async () => {
  const res = await app.request('/api/v2/observations')
  expect(res.status).toBe(404)
  expect(await res.json()).toEqual({ error: 'not_found' })
})
