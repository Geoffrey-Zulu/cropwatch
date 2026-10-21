// Deterministic randomness: the same seed gives the same sequence on every run and machine,
// so rehearsals see identical data (technicaldoc §12).
export function createRandom(seed: number) {
  let state = seed >>> 0
  // mulberry32
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    between: (min: number, max: number) => min + (max - min) * next(),
    int: (min: number, max: number) => Math.floor(min + (max - min + 1) * next()),
    chance: (p: number) => next() < p,
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)],
    weighted: <T>(entries: readonly (readonly [T, number])[]) => {
      const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
      let roll = next() * total
      for (const [value, weight] of entries) {
        roll -= weight
        if (roll < 0) return value
      }
      return entries[entries.length - 1][0]
    },
  }
}
export type Random = ReturnType<typeof createRandom>

const KM_PER_DEGREE_LATITUDE = 110.574

// A point `km` from `center` on `bearing` (radians); flat-earth is fine at these distances.
export function offset(
  center: { latitude: number; longitude: number },
  km: number,
  bearing: number
) {
  const latitude = center.latitude + (km * Math.cos(bearing)) / KM_PER_DEGREE_LATITUDE
  const kmPerDegreeLongitude = 111.32 * Math.cos((center.latitude * Math.PI) / 180)
  const longitude = center.longitude + (km * Math.sin(bearing)) / kmPerDegreeLongitude
  return { latitude: round(latitude), longitude: round(longitude) }
}

const round = (value: number) => Math.round(value * 1e5) / 1e5
