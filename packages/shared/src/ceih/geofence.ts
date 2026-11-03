import { GEOFENCE_GRACE_M } from '../constants/ceih'
import type { GeoPoint } from '../schemas/common'

// Field polygons and the geofence check (docs/ceih-overnight-plan.md, Phase 1). MVP rule: a
// circle around the officer's pin holding the claimed hectares; walked boundaries are post-MVP.
// GeoJSON Polygon, stored as text (Firestore cannot hold nested arrays).

const M_PER_DEG_LAT = 110_574

export function fieldRadiusM(claimedHa: number): number {
  return Math.sqrt((claimedHa * 10_000) / Math.PI)
}

export function circlePolygon(center: GeoPoint, radiusM: number, vertices = 32): string {
  const mPerDegLng = 111_320 * Math.cos((center.latitude * Math.PI) / 180)
  const ring: [number, number][] = []
  for (let i = 0; i < vertices; i++) {
    const a = (2 * Math.PI * i) / vertices
    ring.push([
      round(center.longitude + (radiusM * Math.sin(a)) / mPerDegLng),
      round(center.latitude + (radiusM * Math.cos(a)) / M_PER_DEG_LAT),
    ])
  }
  ring.push(ring[0])
  return JSON.stringify({ type: 'Polygon', coordinates: [ring] })
}

const round = (value: number) => Math.round(value * 1e7) / 1e7

// The outer ring as [longitude, latitude] pairs, or null if the text is not a GeoJSON Polygon.
export function polygonRing(text: string): [number, number][] | null {
  try {
    const shape = JSON.parse(text) as { type?: unknown; coordinates?: unknown }
    if (shape.type !== 'Polygon' || !Array.isArray(shape.coordinates)) return null
    const ring = shape.coordinates[0] as unknown
    if (!Array.isArray(ring) || ring.length < 4) return null
    const points = ring.filter(
      (p): p is [number, number] =>
        Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number'
    )
    return points.length === ring.length ? points : null
  } catch {
    return null
  }
}

// Metres east and north of an origin (flat earth: fields are hundreds of metres across).
function local(origin: GeoPoint) {
  const mPerDegLng = 111_320 * Math.cos((origin.latitude * Math.PI) / 180)
  return ([lng, lat]: [number, number]) =>
    [(lng - origin.longitude) * mPerDegLng, (lat - origin.latitude) * M_PER_DEG_LAT] as const
}

// Inside the polygon, or within the grace margin of its edge. A malformed polygon never passes.
export function geofenceOk(point: GeoPoint, polygon: string, graceM = GEOFENCE_GRACE_M): boolean {
  const ring = polygonRing(polygon)
  if (!ring) return false
  const xy = ring.map(local(point))
  // The point is the origin: ray-cast along +x.
  let inside = false
  for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) {
    const [xi, yi] = xy[i]
    const [xj, yj] = xy[j]
    if (yi > 0 !== yj > 0 && 0 < ((xj - xi) * (0 - yi)) / (yj - yi) + xi) inside = !inside
  }
  if (inside) return true
  let nearest = Infinity
  for (let i = 1; i < xy.length; i++) {
    nearest = Math.min(nearest, distanceToSegment(xy[i - 1], xy[i]))
  }
  return nearest <= graceM
}

// Distance from the origin to the segment a–b.
function distanceToSegment(a: readonly [number, number], b: readonly [number, number]) {
  const [ax, ay] = a
  const [dx, dy] = [b[0] - ax, b[1] - ay]
  const length2 = dx * dx + dy * dy
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length2))
  return Math.hypot(ax + t * dx, ay + t * dy)
}

// A ring of [longitude, latitude] pairs, as drawn on the Fields map (closed or not).
export type Ring = [number, number][]

const openRing = (ring: Ring) =>
  ring.length > 1 &&
  ring[0][0] === ring[ring.length - 1][0] &&
  ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring

// Area in hectares (flat earth around the ring's first point: a field is hundreds of metres).
export function polygonAreaHa(ring: Ring): number {
  const points = openRing(ring)
  if (points.length < 3) return 0
  const toXY = local({ latitude: points[0][1], longitude: points[0][0] })
  const xy = points.map(p => toXY(p))
  let twice = 0
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i]
    const [x2, y2] = xy[(i + 1) % xy.length]
    twice += x1 * y2 - x2 * y1
  }
  return Math.abs(twice) / 2 / 10_000
}

export function ringCentroid(ring: Ring): GeoPoint {
  const points = openRing(ring)
  const latitude = points.reduce((n, p) => n + p[1], 0) / points.length
  const longitude = points.reduce((n, p) => n + p[0], 0) / points.length
  return { latitude: round(latitude), longitude: round(longitude) }
}

// GeoJSON Polygon text from a ring, closed, coordinates rounded to about a centimetre.
export function ringPolygon(ring: Ring): string {
  const points = openRing(ring).map(([lng, lat]) => [round(lng), round(lat)] as [number, number])
  return JSON.stringify({ type: 'Polygon', coordinates: [[...points, points[0]]] })
}
