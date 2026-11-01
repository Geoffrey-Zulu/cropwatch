// The Fields map's basemap (Outgrower View only; every other map stays our own drawing): Esri
// World Imagery, then EOX Sentinel-2 cloudless if Esri fails, then the plain canvas. No keys.
export const IMAGERY = {
  esri: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    // The imagery is real; the field outlines on it are the demo season's.
    attribution: 'Imagery: Esri, Maxar, Earthstar Geographics · field outlines simulated',
    maxNativeZoom: 18,
  },
  eox: {
    url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
    attribution:
      'Imagery: Sentinel-2 cloudless by EOX (s2maps.eu), contains modified Copernicus Sentinel data 2020 · field outlines simulated',
    maxNativeZoom: 15,
  },
} as const

// Slippy-map tile numbers for a point.
export function tileOf(lng: number, lat: number, z: number) {
  const n = 2 ** z
  const rad = (lat * Math.PI) / 180
  return {
    x: Math.floor(((lng + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n),
  }
}

// The venue's network may be poor: fetch the demo camps' tiles once, so the browser has them
// when the map flies in. Zooms 13 to 17 over each camp's extent; at most `limit` tiles.
export function warmTiles(
  extents: [number, number, number, number][],
  zooms = [13, 14, 15, 16, 17],
  limit = 600
) {
  const urls: string[] = []
  // Zoom by zoom across every camp, so the limit never starves the last camp of its tiles.
  for (const z of zooms) {
    for (const [west, south, east, north] of extents) {
      const a = tileOf(west, north, z)
      const b = tileOf(east, south, z)
      for (let x = a.x; x <= b.x; x++)
        for (let y = a.y; y <= b.y; y++)
          urls.push(
            IMAGERY.esri.url.replace('{z}', `${z}`).replace('{y}', `${y}`).replace('{x}', `${x}`)
          )
    }
  }
  for (const url of urls.slice(0, limit)) {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
  }
  return Math.min(urls.length, limit)
}
