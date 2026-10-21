const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'

// Standard geohash; precision 9 is roughly a 5 m cell, enough for proximity queries.
export function geohash(latitude: number, longitude: number, precision = 9) {
  const lat = [-90, 90]
  const lng = [-180, 180]
  let hash = ''
  let bits = 0
  let value = 0
  let evenBit = true

  while (hash.length < precision) {
    const range = evenBit ? lng : lat
    const coordinate = evenBit ? longitude : latitude
    const mid = (range[0] + range[1]) / 2
    value <<= 1
    if (coordinate >= mid) {
      value |= 1
      range[0] = mid
    } else {
      range[1] = mid
    }
    evenBit = !evenBit
    if (++bits === 5) {
      hash += BASE32[value]
      bits = 0
      value = 0
    }
  }
  return hash
}

const EARTH_RADIUS_KM = 6371

// Great-circle distance (haversine), for the cluster rule's "within 10 km" (technicaldoc §9).
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) {
  const rad = (degrees: number) => (degrees * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLng = rad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}
