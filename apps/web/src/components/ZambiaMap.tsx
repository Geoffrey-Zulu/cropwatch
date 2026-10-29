import { geoMercator, geoPath } from 'd3-geo'
import type { Feature, FeatureCollection, MultiPolygon } from 'geojson'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { ISSUE_LABELS, type GeoPoint, type Issue, type RiskLevel } from '@repo/shared'

// Map fills: stronger than the tag tints so Elevated reads against Low at national scale.
const MAP_FILL: Record<RiskLevel, string> = {
  HIGH: 'var(--copper-deep)',
  ELEVATED: '#E5BD97',
  LOW: 'var(--sheet)',
}

type DistrictFeature = Feature<
  MultiPolygon,
  { slug: string; name: string; province: string; part_of: string | null }
>
type Districts = FeatureCollection<MultiPolygon, DistrictFeature['properties']> & {
  attribution: string
}

// District boundaries ship with the app (public/geo, CC BY 4.0): no tile server, so the map
// works on hotel wifi and a projector without a network round trip per pan.
let cached: Promise<Districts> | null = null
export function useDistricts() {
  const [districts, setDistricts] = useState<Districts | null>(null)
  useEffect(() => {
    cached ??= fetch('/geo/zambia-districts.json').then(r => r.json() as Promise<Districts>)
    let live = true
    cached.then(d => live && setDistricts(d)).catch(() => undefined)
    return () => {
      live = false
    }
  }, [])
  return districts
}

export interface MapPoint {
  id: string
  location: GeoPoint
  sim: boolean
  issue: Issue | null
  label: string
}

export interface MapCluster {
  id: string
  center: GeoPoint
  radiusKm: number
  issue: Issue
  size: number
  sim: boolean
}

const WIDTH = 960
const HEIGHT = 720

export function ZambiaMap({
  levels,
  points = [],
  clusters = [],
  focus,
  onPoint,
  onCluster,
  onDistrict,
  height = 560,
}: {
  levels: Map<string, RiskLevel>
  points?: MapPoint[]
  clusters?: MapCluster[]
  // Fit the view to this box ([west, south], [east, north]) instead of the whole country.
  focus?: [[number, number], [number, number]] | null
  onPoint?: (id: string) => void
  onCluster?: (id: string) => void
  onDistrict?: (slug: string) => void
  height?: number
}) {
  const districts = useDistricts()
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<string | null>(null)

  const projection = useMemo(() => {
    if (!districts) return null
    const p = geoMercator()
    if (focus) {
      const [[w, s], [e, n]] = focus
      p.fitExtent(
        [
          [40, 40],
          [WIDTH - 40, HEIGHT - 40],
        ],
        // Two corners, not a polygon: a box has no winding to get wrong.
        {
          type: 'MultiPoint',
          coordinates: [
            [w, s],
            [e, n],
          ],
        }
      )
    } else {
      p.fitExtent(
        [
          [16, 16],
          [WIDTH - 16, HEIGHT - 16],
        ],
        districts
      )
    }
    return p
  }, [districts, focus])

  const paths = useMemo(() => {
    if (!districts || !projection) return []
    const path = geoPath(projection)
    return districts.features.map(f => ({
      key: `${f.properties.slug}:${f.properties.name}`,
      slug: f.properties.slug,
      name: f.properties.name,
      partOf: f.properties.part_of,
      d: path(f) ?? '',
    }))
  }, [districts, projection])

  const project = (p: GeoPoint) => projection?.([p.longitude, p.latitude]) ?? null
  const kmToPx = (center: GeoPoint, km: number) => {
    const a = project(center)
    const b = project({
      latitude: center.latitude,
      longitude: center.longitude + km / (111.32 * Math.cos((center.latitude * Math.PI) / 180)),
    })
    return a && b ? Math.abs(b[0] - a[0]) : 0
  }

  // Zoom about a point in SVG coordinates.
  const zoomAt = (factor: number, cx = WIDTH / 2, cy = HEIGHT / 2) =>
    setView(v => {
      const k = Math.min(12, Math.max(1, v.k * factor))
      const f = k / v.k
      return { k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f }
    })

  const toSvg = (clientX: number, clientY: number) => {
    const box = svg.current!.getBoundingClientRect()
    return [((clientX - box.left) / box.width) * WIDTH, ((clientY - box.top) / box.height) * HEIGHT]
  }

  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    const [cx, cy] = toSvg(e.clientX, e.clientY)
    zoomAt(e.deltaY < 0 ? 1.25 : 0.8, cx, cy)
  }
  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }
  }
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag.current || !svg.current) return
    const box = svg.current.getBoundingClientRect()
    const dx = ((e.clientX - drag.current.x) / box.width) * WIDTH
    const dy = ((e.clientY - drag.current.y) / box.height) * HEIGHT
    if (Math.abs(dx) + Math.abs(dy) > 2) {
      const { vx, vy } = drag.current
      setView(v => ({ ...v, x: vx + dx, y: vy + dy }))
    }
  }
  const onUp = () => {
    drag.current = null
  }

  const hovered = paths.find(p => p.key === hover)
  const hoverLevel = hovered ? levels.get(hovered.slug) : undefined

  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-[#F3EEE4]">
      {!districts && (
        <p className="absolute inset-0 flex items-center justify-center text-label text-ink-2">
          Loading district boundaries…
        </p>
      )}
      <svg
        ref={svg}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ height }}
        className="w-full touch-none select-none"
        role="img"
        aria-label="Map of Zambia: districts shaded by prototype risk level, with reports and clusters"
        onWheel={onWheel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {paths.map(p => {
            const level = levels.get(p.slug)
            return (
              <path
                key={p.key}
                d={p.d}
                fill={level ? MAP_FILL[level] : 'var(--paper)'}
                stroke={hover === p.key ? 'var(--navy)' : 'var(--line-strong)'}
                strokeWidth={(hover === p.key ? 1.6 : 0.6) / view.k}
                className={onDistrict ? 'cursor-pointer' : undefined}
                onPointerEnter={() => setHover(p.key)}
                onPointerLeave={() => setHover(h => (h === p.key ? null : h))}
                onClick={() => onDistrict?.(p.slug)}
              >
                <title>
                  {p.name}
                  {p.partOf ? ` (counted with ${p.partOf})` : ''}
                </title>
              </path>
            )
          })}

          {clusters.map(c => {
            const at = project(c.center)
            if (!at) return null
            const r = Math.max(kmToPx(c.center, c.radiusKm), 6 / view.k)
            return (
              <g
                key={c.id}
                className={onCluster ? 'cursor-pointer' : undefined}
                onClick={() => onCluster?.(c.id)}
              >
                {/* A light halo keeps the ring visible over a High district. */}
                <circle
                  cx={at[0]}
                  cy={at[1]}
                  r={r}
                  fill="none"
                  stroke="var(--sheet)"
                  strokeWidth={5 / view.k}
                />
                <circle
                  cx={at[0]}
                  cy={at[1]}
                  r={r}
                  fill="rgb(180 100 42 / 0.16)"
                  stroke="var(--copper)"
                  strokeWidth={2 / view.k}
                  strokeDasharray={c.sim ? `${4 / view.k} ${3 / view.k}` : undefined}
                />
                <text
                  x={at[0]}
                  y={at[1] - r - 4 / view.k}
                  textAnchor="middle"
                  fontSize={12 / view.k}
                  className="fill-copper-deep font-mono font-semibold"
                >
                  {c.size}
                </text>
                <title>
                  Cluster: {ISSUE_LABELS[c.issue]}, {c.size} reports within {c.radiusKm} km
                </title>
              </g>
            )
          })}

          {points.map(p => {
            const at = project(p.location)
            if (!at) return null
            return (
              <circle
                key={p.id}
                cx={at[0]}
                cy={at[1]}
                r={(p.sim ? 2.6 : 3.4) / Math.sqrt(view.k)}
                fill={p.sim ? 'var(--sheet)' : 'var(--navy)'}
                stroke="var(--navy)"
                strokeWidth={1.1 / Math.sqrt(view.k)}
                className={onPoint ? 'cursor-pointer' : undefined}
                onClick={() => onPoint?.(p.id)}
              >
                <title>{p.label}</title>
              </circle>
            )
          })}
        </g>
      </svg>

      <div className="absolute right-3 top-3 flex flex-col gap-1">
        <MapButton label="Zoom in" onClick={() => zoomAt(1.5)}>
          <Plus size={18} strokeWidth={2} aria-hidden />
        </MapButton>
        <MapButton label="Zoom out" onClick={() => zoomAt(1 / 1.5)}>
          <Minus size={18} strokeWidth={2} aria-hidden />
        </MapButton>
        <MapButton label="Reset view" onClick={() => setView({ x: 0, y: 0, k: 1 })}>
          <Maximize2 size={16} strokeWidth={2} aria-hidden />
        </MapButton>
      </div>

      {hovered && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-card border border-line bg-sheet px-3 py-2 shadow-raise">
          <p className="text-label font-semibold text-navy">{hovered.name}</p>
          <p className="font-mono text-eyebrow uppercase text-ink-2">
            {hovered.partOf ? `Counted with ${hovered.partOf} · ` : ''}
            {hoverLevel ? `Prototype signal: ${hoverLevel}` : 'No reports'}
          </p>
        </div>
      )}

      <MapLegend />
      <p className="bg-sheet px-3 pb-2 font-mono text-[10px] leading-tight text-ink-2">
        Boundaries: geoBoundaries, GRID3 and Office of the Surveyor General (CC BY 4.0)
      </p>
    </div>
  )
}

function MapButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-card border border-line-strong bg-sheet text-navy hover:bg-navy-tint"
    >
      {children}
    </button>
  )
}

function MapLegend() {
  return (
    <div className="border-t border-line bg-sheet px-3 py-2">
      <p className="eyebrow mb-1">Prototype risk signal</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption">
        {(['HIGH', 'ELEVATED', 'LOW'] as const).map(level => (
          <span key={level} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-3 w-4 rounded-[1px] border border-line-strong"
              style={{ background: MAP_FILL[level] }}
            />
            {level === 'HIGH' ? 'High' : level === 'ELEVATED' ? 'Elevated' : 'Low'}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-navy" />
          Report
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full border border-navy bg-sheet" />
          Simulated report
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-3 rounded-full border-2 border-copper" />
          Cluster (10 km)
        </span>
      </div>
    </div>
  )
}
