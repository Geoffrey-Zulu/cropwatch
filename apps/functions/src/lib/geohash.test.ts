import { describe, it, expect } from 'vitest'
import { geohash } from './geohash'

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
