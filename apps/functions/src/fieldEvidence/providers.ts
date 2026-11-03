import type { FieldEvidence, FieldInput, VegetationReading } from '@repo/shared'

type Scene = {
  id: string
  properties: { datetime: string; 'eo:cloud_cover'?: number }
  assets?: { thumbnail?: { href?: string } }
}
const CATALOGUE = 'https://earth-search.aws.element84.com/v1/search'
const TOKEN =
  'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token'
const STATISTICS = 'https://sh.dataspace.copernicus.eu/api/v1/statistics'
// Adapted from SKACE's Sentinel Hub client: approximately 10m sampling, stricter quality masking,
// and no synthetic fallback. Scene-level cloud cover is kept separate from field coverage.
const EVALSCRIPT = `//VERSION=3
function setup(){return {input:[{bands:["B04","B08","SCL","dataMask"]}],output:[{id:"ndvi",bands:1,sampleType:"FLOAT32"},{id:"dataMask",bands:1}]};}
function evaluatePixel(s){var sum=s.B08+s.B04;var valid=s.dataMask&&[4,5,6].includes(s.SCL)&&sum>0;return {ndvi:[sum>0?(s.B08-s.B04)/sum:0],dataMask:[valid?1:0]};}`

let cachedToken: {
  clientId: string
  clientSecret: string
  accessToken: string
  expiresAt: number
} | null = null

function samplingResolution(geometry: FieldInput['geometry']) {
  const latitudes = geometry.coordinates[0].map(p => p[1])
  const phi = (((Math.min(...latitudes) + Math.max(...latitudes)) / 2) * Math.PI) / 180
  // Statistical API resolution uses the bounds CRS units. EPSG:4326 uses degrees,
  // so resx/resy=10 would be ten degrees, not ten metres.
  const metresPerLatitudeDegree = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi)
  const metresPerLongitudeDegree = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi)
  return { resx: 10 / metresPerLongitudeDegree, resy: 10 / metresPerLatitudeDegree }
}

export async function collectEvidence(
  geometry: FieldInput['geometry'],
  fieldId: string | null,
  env = process.env,
  fetcher = fetch
): Promise<FieldEvidence> {
  const now = new Date()
  const from = new Date(now.getTime() - 90 * 86400000).toISOString()
  const report: FieldEvidence = {
    field_id: fieldId,
    scope: fieldId ? 'field' : 'regional',
    retrieved_at: now.toISOString(),
    catalogue_source: 'Sentinel-2 L2A / Earth Search',
    scenes: [],
    catalogue_status: 'unavailable',
    vegetation_source: 'Copernicus Sentinel Hub Statistical API',
    vegetation_status: 'not_configured',
    readings: [],
    review_status: 'officer_review_required',
  }
  const catalogue = async () => {
    try {
      const response = await fetcher(CATALOGUE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          collections: ['sentinel-2-l2a'],
          intersects: geometry,
          datetime: `${from}/${now.toISOString()}`,
          limit: 12,
          sortby: [{ field: 'properties.datetime', direction: 'desc' }],
        }),
        signal: AbortSignal.timeout(25000),
      })
      if (!response.ok) return
      const data = (await response.json()) as { features?: Scene[] }
      report.scenes = (data.features ?? [])
        .filter(s => s.id && Number.isFinite(Date.parse(s.properties.datetime)))
        .map(s => ({
          id: s.id,
          acquired_at: s.properties.datetime,
          scene_cloud_pct:
            typeof s.properties['eo:cloud_cover'] === 'number'
              ? s.properties['eo:cloud_cover']
              : null,
          preview_url: s.assets?.thumbnail?.href?.startsWith(
            'https://sentinel-cogs.s3.us-west-2.amazonaws.com/'
          )
            ? s.assets.thumbnail.href
            : null,
        }))
      report.catalogue_status = 'ok'
    } catch {
      /* The independent NDVI request can still succeed. */
    }
  }
  const vegetation = async () => {
    // Regional context never gets presented as field-level NDVI evidence.
    if (!fieldId || !env.CDSE_CLIENT_ID || !env.CDSE_CLIENT_SECRET) return
    report.vegetation_status = 'unavailable'
    try {
      let accessToken =
        cachedToken?.clientId === env.CDSE_CLIENT_ID &&
        cachedToken.clientSecret === env.CDSE_CLIENT_SECRET &&
        cachedToken.expiresAt > Date.now()
          ? cachedToken.accessToken
          : null
      if (!accessToken) {
        const tokenResponse = await fetcher(TOKEN, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: env.CDSE_CLIENT_ID,
            client_secret: env.CDSE_CLIENT_SECRET,
          }),
          signal: AbortSignal.timeout(15000),
        })
        if (!tokenResponse.ok) {
          report.vegetation_status =
            tokenResponse.status === 401 ? 'authorization_failed' : 'unavailable'
          return
        }
        const token = (await tokenResponse.json()) as { access_token?: string; expires_in?: number }
        if (!token.access_token) return
        accessToken = token.access_token
        if (typeof token.expires_in === 'number' && token.expires_in > 60) {
          cachedToken = {
            clientId: env.CDSE_CLIENT_ID,
            clientSecret: env.CDSE_CLIENT_SECRET,
            accessToken,
            expiresAt: Date.now() + (Math.min(token.expires_in, 3600) - 60) * 1000,
          }
        }
      }
      const response = await fetcher(STATISTICS, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          input: {
            bounds: { geometry, properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' } },
            data: [
              {
                type: 'sentinel-2-l2a',
                dataFilter: { mosaickingOrder: 'leastCC' },
                processing: { harmonizeValues: true },
              },
            ],
          },
          aggregation: {
            timeRange: { from, to: now.toISOString() },
            aggregationInterval: { of: 'P5D' },
            evalscript: EVALSCRIPT,
            ...samplingResolution(geometry),
          },
        }),
        signal: AbortSignal.timeout(60000),
      })
      if (!response.ok) {
        if (response.status === 401) cachedToken = null
        report.vegetation_status =
          response.status === 401 || response.status === 403
            ? 'authorization_failed'
            : 'unavailable'
        return
      }
      const data = (await response.json()) as {
        data?: {
          interval: { from: string; to: string }
          outputs: {
            ndvi: {
              bands: {
                B0: { stats: { mean: number | string; sampleCount: number; noDataCount: number } }
              }
            }
          }
        }[]
      }
      report.readings = (data.data ?? [])
        .flatMap(row => {
          const s = row.outputs?.ndvi?.bands?.B0?.stats
          if (!s || s.sampleCount <= 0) return []
          const mean = Number(s.mean),
            count = s.sampleCount - s.noDataCount,
            pct = (count / s.sampleCount) * 100
          if (!Number.isFinite(mean) || mean < -1 || mean > 1 || count < 10 || pct < 50) return []
          return [
            {
              from: row.interval.from,
              to: row.interval.to,
              ndvi: mean,
              valid_pixels: count,
              valid_pixel_pct: pct,
            } satisfies VegetationReading,
          ]
        })
        .sort((a, b) => a.from.localeCompare(b.from))
      report.vegetation_status = report.readings.length ? 'ok' : 'no_usable_pixels'
    } catch {
      report.vegetation_status = 'unavailable'
    }
  }
  await Promise.all([catalogue(), vegetation()])
  return report
}
