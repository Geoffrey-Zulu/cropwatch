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
