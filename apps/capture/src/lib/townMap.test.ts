import { describe, expect, it } from 'vitest'
import { mapViewport } from './townMap'

describe('town map geometry', () => {
  it('places the world tile correctly at the equator', () => {
    expect(mapViewport({ latitude: 0, longitude: 0 }, 256, 256, 0)).toEqual([
      { x: 0, y: 0, left: 0, top: 0, zoom: 0 },
    ])
  })
  it('keeps Monze at the viewport centre and requests only intersecting tiles', () => {
    const tiles = mapViewport({ latitude: -16.28, longitude: 27.48 }, 350, 182)
    expect(tiles.length).toBeLessThanOrEqual(6)
    const first = tiles[0]
    const cx = first.x * 256 - first.left + 175
    const cy = first.y * 256 - first.top + 91
    const size = 256 * 2 ** 12
    expect((cx / size) * 360 - 180).toBeCloseTo(27.48, 7)
    expect((Math.atan(Math.sinh(Math.PI * (1 - (2 * cy) / size))) * 180) / Math.PI).toBeCloseTo(
      -16.28,
      7
    )
    for (const tile of tiles) {
      expect(tile.left).toBeLessThan(350)
      expect(tile.left + 256).toBeGreaterThan(0)
      expect(tile.top).toBeLessThan(182)
      expect(tile.top + 256).toBeGreaterThan(0)
    }
  })
})
