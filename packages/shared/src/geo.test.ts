import { describe, it, expect } from 'vitest'
import { distanceKm, geohash } from './geo'

describe('geohash', () => {
  it('matches the reference encoding', () => {
    // Reference value from the original geohash.org example.
    expect(geohash(57.64911, 10.40744, 11)).toBe('u4pruydqqvj')
  })

  it('encodes a Zambian point with the default precision', () => {
    const hash = geohash(-15.4167, 28.2833)
    expect(hash).toHaveLength(9)
    expect(hash).toMatch(/^[0-9b-hjkmnp-z]+$/)
    // Nearby points share a prefix.
    expect(geohash(-15.4168, 28.2834).slice(0, 6)).toBe(hash.slice(0, 6))
  })
})

describe('distanceKm', () => {
  it('is zero for the same point', () => {
    expect(
      distanceKm({ latitude: -15.4, longitude: 28.3 }, { latitude: -15.4, longitude: 28.3 })
    ).toBe(0)
  })

  it('matches a known distance (Lusaka to Chongwe town, about 43 km)', () => {
    const km = distanceKm(
      { latitude: -15.4167, longitude: 28.2833 },
      { latitude: -15.33, longitude: 28.68 }
    )
    expect(km).toBeGreaterThan(40)
    expect(km).toBeLessThan(46)
  })

  it('treats 0.09 degrees of latitude as about 10 km', () => {
    const km = distanceKm(
      { latitude: -13.6, longitude: 32.6 },
      { latitude: -13.69, longitude: 32.6 }
    )
    expect(km).toBeCloseTo(10.0, 0)
  })
})
