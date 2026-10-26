import { gcpFetch, PROJECT_ID } from './auth'

// Firestore REST. The Admin SDK's Firestore client refuses non-service-account credentials, and
// tools must run as the authorized account, so they talk REST with its gcloud token.

const ROOT = `projects/${PROJECT_ID}/databases/(default)/documents`
const API = `https://firestore.googleapis.com/v1/${ROOT}`
// Firestore accepts at most 500 writes per commit.
const MAX_WRITES = 500

// Values that need Firestore's own types; everything else maps from plain JSON.
export class FsTimestamp {
  constructor(readonly iso: string) {}
}
export class FsGeoPoint {
  constructor(
    readonly latitude: number,
    readonly longitude: number
  ) {}
}

export type FsValue =
  | null
  | boolean
  | number
  | string
  | FsTimestamp
  | FsGeoPoint
  | FsValue[]
  | { [key: string]: FsValue }

type Encoded = Record<string, unknown>

export function encodeValue(value: FsValue): Encoded {
  if (value === null) return { nullValue: null }
  if (value instanceof FsTimestamp) return { timestampValue: value.iso }
  if (value instanceof FsGeoPoint) {
    return { geoPointValue: { latitude: value.latitude, longitude: value.longitude } }
  }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  }
  if (typeof value === 'string') return { stringValue: value }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } }
  if (typeof value === 'object') return { mapValue: { fields: encodeFields(value) } }
  throw new Error(`Cannot store ${typeof value} in Firestore`)
}

export function encodeFields(document: { [key: string]: FsValue }) {
  for (const [key, value] of Object.entries(document)) {
    if (value === undefined) throw new Error(`Field ${key} is undefined`)
  }
  return Object.fromEntries(Object.entries(document).map(([key, v]) => [key, encodeValue(v)]))
}

// Back to plain JSON: timestamps as ISO strings, geopoints as { latitude, longitude }.
export function decodeValue(value: Encoded): unknown {
  if ('nullValue' in value) return null
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('stringValue' in value) return value.stringValue
  if ('timestampValue' in value) return new Date(String(value.timestampValue)).toISOString()
  if ('geoPointValue' in value) return value.geoPointValue
  if ('arrayValue' in value) {
    const { values = [] } = value.arrayValue as { values?: Encoded[] }
    return values.map(decodeValue)
  }
  if ('mapValue' in value) {
    const { fields = {} } = value.mapValue as { fields?: Record<string, Encoded> }
    return decodeFields(fields)
  }
  throw new Error(`Unknown Firestore value ${JSON.stringify(value)}`)
}

export function decodeFields(fields: Record<string, Encoded>) {
  return Object.fromEntries(Object.entries(fields).map(([key, v]) => [key, decodeValue(v)]))
}

export const documentName = (path: string) => `${ROOT}/${path}`

// set replaces the document; patch changes only the fields given.
export type Write =
  | { set: string; data: { [key: string]: FsValue } }
  | { patch: string; data: { [key: string]: FsValue } }
  | { delete: string }

export function toRestWrite(write: Write) {
  if ('set' in write)
    return { update: { name: documentName(write.set), fields: encodeFields(write.data) } }
  if ('patch' in write)
    return {
      update: { name: documentName(write.patch), fields: encodeFields(write.data) },
      updateMask: { fieldPaths: Object.keys(write.data) },
    }
  return { delete: documentName(write.delete) }
}

// Commits in batches of 500. Each batch is atomic; the whole run is not.
export async function commit(writes: Write[]) {
  for (let i = 0; i < writes.length; i += MAX_WRITES) {
    await gcpFetch(`${API}:commit`, {
      method: 'POST',
      body: JSON.stringify({ writes: writes.slice(i, i + MAX_WRITES).map(toRestWrite) }),
    })
  }
}

// Paths of the documents in a collection where `field == value` (no field data fetched).
export async function queryPaths(collection: string, field: string, value: FsValue) {
  const response = await gcpFetch(`${API}:runQuery`, {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: {
          fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: encodeValue(value) },
        },
        select: { fields: [{ fieldPath: '__name__' }] },
      },
    }),
  })
  const rows = (await response.json()) as { document?: { name: string } }[]
  return rows.flatMap(row => (row.document ? [row.document.name.slice(ROOT.length + 1)] : []))
}

// Documents in a collection where the array `field` holds any of `values` (at most 30, a
// Firestore limit), decoded.
export async function queryArrayContainsAny(collection: string, field: string, values: string[]) {
  const documents: { path: string; data: Record<string, unknown> }[] = []
  for (let i = 0; i < values.length; i += 30) {
    const response = await gcpFetch(`${API}:runQuery`, {
      method: 'POST',
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collection }],
          where: {
            fieldFilter: {
              field: { fieldPath: field },
              op: 'ARRAY_CONTAINS_ANY',
              value: encodeValue(values.slice(i, i + 30)),
            },
          },
        },
      }),
    })
    const rows = (await response.json()) as {
      document?: { name: string; fields?: Record<string, Encoded> }
    }[]
    for (const { document } of rows) {
      if (document && !documents.some(d => d.path === document.name.slice(ROOT.length + 1)))
        documents.push({
          path: document.name.slice(ROOT.length + 1),
          data: decodeFields(document.fields ?? {}),
        })
    }
  }
  return documents
}

// Every document in a collection, decoded.
export async function listDocuments(collection: string) {
  const documents: { path: string; data: Record<string, unknown> }[] = []
  let pageToken = ''
  do {
    const query = new URLSearchParams({ pageSize: '300', ...(pageToken ? { pageToken } : {}) })
    const response = await gcpFetch(`${API}/${collection}?${query}`)
    const page = (await response.json()) as {
      documents?: { name: string; fields?: Record<string, Encoded> }[]
      nextPageToken?: string
    }
    for (const doc of page.documents ?? []) {
      documents.push({
        path: doc.name.slice(ROOT.length + 1),
        data: decodeFields(doc.fields ?? {}),
      })
    }
    pageToken = page.nextPageToken ?? ''
  } while (pageToken)
  return documents
}

// One document decoded, or null if it does not exist. The path's segments are already IDs.
export async function getDocument(path: string) {
  const url = `${API}/${path.split('/').map(encodeURIComponent).join('/')}`
  try {
    const response = await gcpFetch(url)
    const doc = (await response.json()) as { fields?: Record<string, Encoded> }
    return decodeFields(doc.fields ?? {})
  } catch (error) {
    if (String(error).includes('HTTP 404')) return null
    throw error
  }
}
