import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { Camera } from '@capacitor/camera'
import { Geolocation } from '@capacitor/geolocation'
import { createObservation } from './api'
import { currentPosition } from './location'
import { nativePhoto } from './native'
import { buildReport } from './report'

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn() },
  CapacitorHttp: { request: vi.fn() },
}))
vi.mock('@capacitor/camera', () => ({
  Camera: { getPhoto: vi.fn() },
  CameraSource: { Camera: 'CAMERA', Photos: 'PHOTOS' },
  CameraResultType: { Uri: 'uri' },
}))
vi.mock('@capacitor/geolocation', () => ({ Geolocation: { getCurrentPosition: vi.fn() } }))

beforeEach(() => {
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true)
})
afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

const report = () =>
  buildReport({
    obsId: 'nativeReport12345678',
    uid: 'farmer1',
    crop: 'maize',
    district: 'Chongwe',
    location: { latitude: -15.33, longitude: 28.68 },
    plantingDate: null,
    description: '',
  })

describe('native transport', () => {
  it('sends the existing contract and bearer token through native HTTP', async () => {
    vi.mocked(CapacitorHttp.request).mockResolvedValue({
      status: 201,
      data: { obs_id: 'nativeReport12345678', status: 'diagnosing' },
      headers: {},
      url: 'https://example.test',
    })
    const request = report()
    expect(await createObservation('id-token', request)).toEqual({
      obs_id: request.obs_id,
      status: 'diagnosing',
    })
    expect(CapacitorHttp.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        data: request,
        headers: { authorization: 'Bearer id-token', 'content-type': 'application/json' },
      })
    )
  })

  it('surfaces authentication failures instead of accepting an error body as a report', async () => {
    vi.mocked(CapacitorHttp.request).mockResolvedValue({
      status: 401,
      data: { message: 'Expired ID token' },
      headers: {},
      url: 'https://example.test',
    })
    await expect(createObservation('expired', report())).rejects.toMatchObject({ status: 401 })
  })

  it('retains fetch for the browser version', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false)
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          obs_id: 'nativeReport12345678',
          status: 'diagnosing',
        }),
        { status: 201 }
      )
    )
    vi.stubGlobal('fetch', fetch)
    await createObservation('browser-token', report())
    expect(fetch).toHaveBeenCalledOnce()
    expect(CapacitorHttp.request).not.toHaveBeenCalled()
  })
})

describe('native capture', () => {
  it('uses native foreground location and preserves coordinates', async () => {
    vi.mocked(Geolocation.getCurrentPosition).mockResolvedValue({
      timestamp: 1,
      coords: {
        latitude: -15.33,
        longitude: 28.68,
        accuracy: 5,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        magneticHeading: null,
        trueHeading: null,
        headingAccuracy: null,
        course: null,
      },
    })
    expect(await currentPosition(5000)).toEqual({ latitude: -15.33, longitude: 28.68 })
    expect(Geolocation.getCurrentPosition).toHaveBeenCalledWith({
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 60_000,
    })
  })

  it('returns a photo file for the existing resize/upload flow without saving it to the gallery', async () => {
    vi.mocked(Camera.getPhoto).mockResolvedValue({
      webPath: 'capacitor://localhost/photo.jpg',
      format: 'jpeg',
      saved: false,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['photo'], { type: 'image/jpeg' }),
      })
    )
    const file = await nativePhoto('photos')
    expect(file.name).toBe('crop.jpeg')
    expect(file.type).toBe('image/jpeg')
    expect(Camera.getPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'PHOTOS',
        saveToGallery: false,
        width: 1600,
      })
    )
  })

  it('propagates denied location access for the existing fallback UI', async () => {
    vi.mocked(Geolocation.getCurrentPosition).mockRejectedValue(new Error('Location denied'))
    await expect(currentPosition()).rejects.toThrow('Location denied')
  })
})
