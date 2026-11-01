import type { Point } from './location'

// Web Mercator pixels, matching the standard raster tile grid.
export function mapViewport(center: Point, width: number, height: number, zoom = 12) {
  const size = 256 * 2 ** zoom
  const latitude = Math.max(-85.05112878, Math.min(85.05112878, center.latitude))
  const sine = Math.sin((latitude * Math.PI) / 180)
  const cx = ((center.longitude + 180) / 360) * size
  const cy = (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * size
  const left = cx - width / 2
  const top = cy - height / 2
  const tiles = []
  for (let y = Math.floor(top / 256); y <= Math.floor((top + height - 1) / 256); y++) {
    for (let x = Math.floor(left / 256); x <= Math.floor((left + width - 1) / 256); x++) {
      tiles.push({ x, y, left: x * 256 - left, top: y * 256 - top, zoom })
    }
  }
  return tiles
}
