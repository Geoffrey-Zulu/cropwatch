import { useMemo } from 'react'
import { IMAGERY } from '../lib/imagery'

type Ring = [number, number][]

// A small, still picture of one farm: Esri World Imagery cropped to its traced outline, with
// the outline drawn on top. Tiles are placed by Web Mercator arithmetic: no map, no
// interaction. A tile that cannot load leaves the canvas, and the outline still shows. Each view
// that shows one carries the imagery credit once (IMAGERY_CREDIT).
export const IMAGERY_CREDIT = IMAGERY.esri.attribution

const TILE = 256
const MAX_NATIVE = 17

// Web Mercator, in pixels of the zoom-0 world (256 across).
function world([lng, lat]: [number, number]) {
  const rad = (lat * Math.PI) / 180
  return [
    ((lng + 180) / 360) * TILE,
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * TILE,
  ] as const
}

export function FieldThumb({
  ring,
  size,
  label,
  className = '',
  inset = 0.62,
}: {
  ring: Ring
  // Square, in CSS pixels.
  size: number
  label: string
  className?: string
  // How much of the square the field spans.
  inset?: number
}) {
  const view = useMemo(() => {
    const pts = ring.map(world)
    const xs = pts.map(p => p[0])
    const ys = pts.map(p => p[1])
    const [minX, maxX, minY, maxY] = [
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys),
    ]
    const span = Math.max(maxX - minX, maxY - minY, 1e-9)
    // Screen pixels per zoom-0 pixel, and the tile zoom that serves it.
    const scale = (size * inset) / span
    const zoom = Math.min(MAX_NATIVE, Math.max(0, Math.floor(Math.log2(scale))))
    const tileScale = scale / 2 ** zoom
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const toScreen = ([x, y]: readonly [number, number]) =>
      [(x - cx) * scale + size / 2, (y - cy) * scale + size / 2] as const
    // The tiles that cover the square at `zoom`.
    const half = size / 2 / scale
    const n = 2 ** zoom
    const t0x = Math.floor(((cx - half) * n) / TILE)
    const t1x = Math.floor(((cx + half) * n) / TILE)
    const t0y = Math.floor(((cy - half) * n) / TILE)
    const t1y = Math.floor(((cy + half) * n) / TILE)
    const tiles: { key: string; url: string; left: number; top: number; px: number }[] = []
    for (let tx = t0x; tx <= t1x; tx++)
      for (let ty = t0y; ty <= t1y; ty++) {
        const [left, top] = toScreen([(tx * TILE) / n, (ty * TILE) / n])
        tiles.push({
          key: `${zoom}/${tx}/${ty}`,
          url: IMAGERY.esri.url
            .replace('{z}', `${zoom}`)
            .replace('{y}', `${ty}`)
            .replace('{x}', `${tx}`),
          left,
          top,
          px: TILE * tileScale,
        })
      }
    const outline = pts
      .map(p =>
        toScreen(p)
          .map(v => v.toFixed(1))
          .join(',')
      )
      .join(' ')
    return { tiles, outline }
  }, [ring, size, inset])

  return (
    <div
      role="img"
      aria-label={label}
      className={`relative shrink-0 overflow-hidden rounded-card bg-[var(--canvas-2)] shadow-[inset_0_0_0_1px_var(--hairline)] ${className}`}
      style={{ width: size, height: size }}
    >
      {view.tiles.map(t => (
        <img
          key={t.key}
          src={t.url}
          alt=""
          aria-hidden
          draggable={false}
          loading="lazy"
          decoding="async"
          className="absolute max-w-none select-none"
          style={{ left: t.left, top: t.top, width: t.px, height: t.px }}
          onError={event => (event.currentTarget.style.visibility = 'hidden')}
        />
      ))}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
        aria-hidden
      >
        <polygon
          points={view.outline}
          fill="none"
          stroke="#fff"
          strokeOpacity={0.95}
          strokeWidth={4.5}
          strokeLinejoin="round"
        />
        <polygon
          points={view.outline}
          fill="var(--signal)"
          fillOpacity={0.18}
          stroke="var(--fg)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
