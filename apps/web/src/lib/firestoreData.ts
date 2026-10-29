import { GeoPoint, Timestamp } from 'firebase/firestore'

// Firestore Timestamps and GeoPoints to the shared schemas' ISO strings and { latitude,
// longitude }, at the boundary.
export function plain(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (value instanceof GeoPoint) return { latitude: value.latitude, longitude: value.longitude }
  if (Array.isArray(value)) return value.map(plain)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]))
  }
  return value
}
