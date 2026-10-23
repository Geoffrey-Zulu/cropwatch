import { DISTRICTS, distanceKm, type District } from '@repo/shared'

export interface Point {
  latitude: number
  longitude: number
}

// The district whose town is nearest a GPS fix: a good default for the picker, which the farmer
// can always change.
export function nearestDistrict(point: Point): District {
  let best = DISTRICTS[0]
  let bestKm = Infinity
  for (const district of DISTRICTS) {
    const km = distanceKm(point, district.center)
    if (km < bestKm) {
      best = district
      bestKm = km
    }
  }
  return best
}

export function currentPosition(timeoutMs = 15_000) {
  return new Promise<Point>((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('No GPS on this device'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      position =>
        resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 }
    )
  })
}
