import type { Point } from './location'

export function worldPixel(point: Point, zoom: number) {
  const size = 256 * 2 ** zoom
  const sine = Math.sin(
    (Math.max(-85.05112878, Math.min(85.05112878, point.latitude)) * Math.PI) / 180
  )
  return {
    x: ((point.longitude + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * size,
  }
}

export function fieldMapView(boundary: [number, number][], width: number, height: number) {
  const lons = boundary.map(p => p[0]),
    lats = boundary.map(p => p[1])
  const center = {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lons) + Math.max(...lons)) / 2,
  }
  let zoom = 18
  for (; zoom > 8; zoom--) {
    const a = worldPixel({ latitude: Math.min(...lats), longitude: Math.min(...lons) }, zoom)
    const b = worldPixel({ latitude: Math.max(...lats), longitude: Math.max(...lons) }, zoom)
    if (Math.abs(a.x - b.x) < width - 36 && Math.abs(a.y - b.y) < height - 36) break
  }
  const middle = worldPixel(center, zoom)
  const points = boundary
    .map(([longitude, latitude]) => {
      const p = worldPixel({ longitude, latitude }, zoom)
      return `${p.x - middle.x + width / 2},${p.y - middle.y + height / 2}`
    })
    .join(' ')
  return { center, zoom, points }
}

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
