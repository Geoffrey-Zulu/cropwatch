import type { FieldInput } from '@repo/shared'

export function fieldArea(geometry: FieldInput['geometry']) {
  const ring = geometry.coordinates[0]
  if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
    throw new Error('Close the boundary ring by repeating its first coordinate.')
  if (ring.some(([lon, lat]) => lon < 21.9 || lon > 34.1 || lat < -18.2 || lat > -8.1))
    throw new Error('The field boundary must be inside Zambia.')
  const vertices = ring.slice(0, -1)
  if (new Set(vertices.map(p => p.join(','))).size !== vertices.length)
    throw new Error('Remove repeated boundary corners.')
  const cross = (a: number[], b: number[], c: number[]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 2; j < vertices.length; j++) {
      if (i === 0 && j === vertices.length - 1) continue
      const [a, b, c, d] = [ring[i], ring[i + 1], ring[j], ring[j + 1]]
      if (
        cross(a, b, c) * cross(a, b, d) <= 0 &&
        cross(c, d, a) * cross(c, d, b) <= 0 &&
        Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <=
          Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) &&
        Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <=
          Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1]))
      )
        throw new Error('Boundary edges cross. Record the corners in order around the field.')
    }
  }
  const origin = ring[0]
  const meanLat = vertices.reduce((sum, p) => sum + p[1], 0) / vertices.length
  const mx = 111320 * Math.cos((meanLat * Math.PI) / 180)
  let area = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [a, b] = [ring[i], ring[i + 1]]
    area +=
      (a[0] - origin[0]) * mx * (b[1] - origin[1]) * 111320 -
      (b[0] - origin[0]) * mx * (a[1] - origin[1]) * 111320
  }
  const ha = Math.abs(area) / 20000
  if (ha < 0.1 || ha > 5000)
    throw new Error(
      'Record a field between 0.1 and 5,000 hectares. A GPS pin alone is not a boundary.'
    )
  return Math.round(ha * 1000) / 1000
}
