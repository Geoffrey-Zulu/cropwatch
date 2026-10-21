import { GeoPoint, Timestamp } from 'firebase-admin/firestore'

// Firestore holds Timestamps and GeoPoints; the shared schemas use ISO-8601 strings and
// { latitude, longitude }. These convert at the boundary.
export function fromFirestore(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (value instanceof GeoPoint) return { latitude: value.latitude, longitude: value.longitude }
  if (Array.isArray(value)) return value.map(fromFirestore)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, fromFirestore(v)]))
  }
  return value
}

export const toTimestamp = (iso: string) => Timestamp.fromDate(new Date(iso))

export const toGeoPoint = ({ latitude, longitude }: { latitude: number; longitude: number }) =>
  new GeoPoint(latitude, longitude)
