import { geoMercator, geoPath } from 'd3-geo'
import type { Feature, FeatureCollection, MultiPolygon } from 'geojson'
import { Maximize2, Minus, Plus } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from 'react'
import { ISSUE_LABELS, type GeoPoint, type Issue, type RiskLevel } from '@repo/shared'
import { Bar, Loading } from './Skeleton'

// The map on the console (patterns-v2.md): white land on a light grey ground, grey district
// lines, Elevated in amber and High in red-gold (the only warm colours), reports as ink dots,
// clusters and the selected district in the one accent. It is the projector view (v2.1): fills
// strong and dots large enough to read from the back of a room. No glow: projectors wash it out.
const MAP = {
  sea: '#F4F5F6',
  land: '#FFFFFF',
  border: '#D3D7DC',
  hover: '#17191C',
  report: '#17191C',
  simReport: '#4D535B',
  ring: '#2160C4',
  ringText: '#1B4F8F',
  ringFill: '#2160C41A',
}
const MAP_FILL: Record<RiskLevel, string> = {
  HIGH: '#C8612A',
  ELEVATED: '#E5B451',
  LOW: '#F8F9FA',
}
// Elevated and High also get a darker outline in their own hue, so they read without colour too.
const MAP_EDGE: Partial<Record<RiskLevel, string>> = {
  HIGH: '#7A3109',
  ELEVATED: '#8F6511',
}
// Report dot radii at the national view, in map units.
const DOT = { report: 6.8, sim: 4.4 }
// A cluster is one ring with its report count inside, never smaller than this (screen units).
const BADGE = 14

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
  selected = null,
  compact = false,
  height = 560,
  badge,
}: {
  levels: Map<string, RiskLevel>
  points?: MapPoint[]
  clusters?: MapCluster[]
  // Fit the view to this box ([west, south], [east, north]) instead of the whole country.
  focus?: [[number, number], [number, number]] | null
  onPoint?: (id: string) => void
  onCluster?: (id: string) => void
  onDistrict?: (slug: string) => void
  // The district selected in the side panel: outlined in deep leaf (patterns.md rule 5).
  selected?: string | null
  // A small locator (the visit drawer): no zoom controls, no legend.
  compact?: boolean
  // Pixels, or any CSS length ("max(480px, 70vh)") on screens wider than a phone.
  height?: number | string
  // The DEMO badge, pinned to the map's top-right corner (left of the zoom controls).
  badge?: ReactNode
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
      // The floating legend sits bottom left: keep the country clear of it.
      p.fitExtent(
        [
          [16, 16],
          [WIDTH - 16, HEIGHT - (compact ? 16 : 96)],
        ],
        districts
      )
    }
    return p
  }, [districts, focus, compact])

  const paths = useMemo(() => {
    if (!districts || !projection) return []
    const path = geoPath(projection)
    // Some districts have several parts with the same name (Senanga): the index keeps keys unique.
    return districts.features.map((f, i) => ({
      key: `${f.properties.slug}:${f.properties.name}:${i}`,
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

  // Cluster rings: the 10 km circle, or a badge where that is too small to hold the count.
  // Badges that would overlap at this zoom (Lusaka and Chongwe at the national view) are nudged
  // apart so every count stays readable.
  const rings = clusters.flatMap(c => {
    const at = project(c.center)
    if (!at) return []
    const km = kmToPx(c.center, c.radiusKm)
    const badge = km * view.k < BADGE
    return [{ cluster: c, x: at[0], y: at[1], r: badge ? BADGE / view.k : km, badge }]
  })
  for (let pass = 0; pass < 24; pass++) {
    let moved = false
    for (let i = 0; i < rings.length; i++)
      for (let j = i + 1; j < rings.length; j++) {
        const a = rings[i]
        const b = rings[j]
        if (!a.badge || !b.badge) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.hypot(dx, dy) || 0.01
        const overlap = a.r + b.r + 2 / view.k - dist
        if (overlap <= 0) continue
        const ux = dist > 0.01 ? dx / dist : 1
        const uy = dist > 0.01 ? dy / dist : 0
        a.x -= (ux * overlap) / 2
        a.y -= (uy * overlap) / 2
        b.x += (ux * overlap) / 2
        b.y += (uy * overlap) / 2
        moved = true
      }
    if (!moved) break
  }

  return (
    <div className="relative overflow-hidden rounded-card" style={{ background: MAP.sea }}>
      {!districts && (
        <div className="absolute inset-0">
          <Loading label="Loading the map">
            <Bar className="absolute inset-0 rounded-none" />
          </Loading>
        </div>
      )}
      <svg
        ref={svg}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        // Phones take the map at its own 4:3 shape; wider screens give it the requested height.
        style={{ ['--map-h' as string]: typeof height === 'number' ? `${height}px` : height }}
        className="aspect-[4/3] w-full touch-none select-none sm:aspect-auto sm:h-[var(--map-h)]"
        role="img"
        aria-label="Map of Zambia: districts shaded by risk signal level, with reports and clusters"
        onWheel={onWheel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {paths.map(p => {
            const level = levels.get(p.slug)
            const edge = level && MAP_EDGE[level]
            return (
              <path
                key={p.key}
                d={p.d}
                fill={level ? MAP_FILL[level] : MAP.land}
                stroke={hover === p.key ? MAP.hover : (edge ?? MAP.border)}
                strokeWidth={(hover === p.key ? 1.6 : 0.7) / view.k}
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

          {paths
            .filter(p => p.slug === selected)
            .map(p => (
              <path
                key={`selected-${p.key}`}
                d={p.d}
                fill="none"
                stroke={MAP.ring}
                strokeWidth={2.5 / view.k}
                pointerEvents="none"
              />
            ))}

          {points.map(p => {
            const at = project(p.location)
            if (!at) return null
            return (
              <circle
                key={p.id}
                cx={at[0]}
                cy={at[1]}
                r={(p.sim ? DOT.sim : DOT.report) / Math.sqrt(view.k)}
                fill={p.sim ? MAP.simReport : MAP.report}
                stroke={MAP.land}
                strokeWidth={1.2 / Math.sqrt(view.k)}
                className={onPoint ? 'cursor-pointer' : undefined}
                onClick={() => onPoint?.(p.id)}
              >
                <title>{p.label}</title>
              </circle>
            )
          })}

          {/* Over the dots: a badge stands for the reports under it. */}
          {rings.map(({ cluster: c, x, y, r, badge }) => (
            <g
              key={c.id}
              className={onCluster ? 'cursor-pointer' : undefined}
              onClick={() => onCluster?.(c.id)}
            >
              {/* A paper halo keeps the ring readable over a red-gold High district. */}
              <circle
                cx={x}
                cy={y}
                r={r}
                fill="none"
                stroke={MAP.land}
                strokeOpacity={0.9}
                strokeWidth={5 / view.k}
                pointerEvents="none"
              />
              {/* A large ring takes clicks on its edge only, so the reports inside stay clickable. */}
              <circle
                cx={x}
                cy={y}
                r={r}
                pointerEvents={badge ? 'visiblePainted' : 'visibleStroke'}
                fill={badge ? MAP.land : MAP.ringFill}
                stroke={MAP.ring}
                strokeWidth={2.5 / view.k}
                strokeDasharray={c.sim ? `${4 / view.k} ${2.5 / view.k}` : undefined}
              />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={14 / view.k}
                fontWeight={700}
                fill={MAP.ringText}
                stroke={MAP.land}
                strokeWidth={badge ? 0 : 3 / view.k}
                paintOrder="stroke"
                className="tabular-nums"
              >
                {c.size}
              </text>
              <title>
                Cluster: {ISSUE_LABELS[c.issue]}, {c.size} reports within {c.radiusKm} km
              </title>
            </g>
          ))}
        </g>
      </svg>

      <div className={`absolute right-3 top-3 hidden flex-col gap-1 ${compact ? '' : 'sm:flex'}`}>
        <MapButton label="Zoom in" onClick={() => zoomAt(1.5)}>
          <Plus aria-hidden />
        </MapButton>
        <MapButton label="Zoom out" onClick={() => zoomAt(1 / 1.5)}>
          <Minus aria-hidden />
        </MapButton>
        <MapButton label="Reset view" onClick={() => setView({ x: 0, y: 0, k: 1 })}>
          <Maximize2 size={16} aria-hidden />
        </MapButton>
      </div>

      {hovered && (
        <div className="pointer-events-none absolute left-3 top-14 rounded-card bg-panel px-3 py-2 shadow-raise">
          <p className="text-label font-semibold text-fg">{hovered.name}</p>
          <p className="meta">
            {hovered.partOf ? `Counted with ${hovered.partOf} · ` : ''}
            {hoverLevel
              ? `Risk signal: ${hoverLevel.charAt(0)}${hoverLevel.slice(1).toLowerCase()}`
              : 'No reports'}
          </p>
        </div>
      )}

      {badge && (
        <div className={`absolute right-3 top-3 z-10 ${compact ? '' : 'sm:right-[3.75rem]'}`}>
          {badge}
        </div>
      )}
      {!compact && <MapLegend />}
      <p className="px-3 pb-1 text-[10px] leading-tight text-fg-2 sm:absolute sm:bottom-1 sm:right-2 sm:p-0">
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
      className="inline-flex h-9 w-9 items-center justify-center rounded-card bg-panel text-fg shadow-raise hover:bg-well"
    >
      {children}
    </button>
  )
}

function MapLegend() {
  return (
    <div className="bg-panel px-3 py-2 sm:absolute sm:bottom-3 sm:left-3 sm:max-w-[calc(100%-1.5rem)] sm:rounded-card sm:shadow-raise">
      <p className="text-caption font-medium text-fg">Risk signal from reports</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-fg-2">
        {(['HIGH', 'ELEVATED', 'LOW'] as const).map(level => (
          <span key={level} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2.5 w-3.5 rounded-[2px] border"
              style={{
                background: MAP_FILL[level],
                borderColor: MAP_EDGE[level] ?? MAP.border,
              }}
            />
            {level === 'HIGH' ? 'High' : level === 'ELEVATED' ? 'Elevated' : 'Low'}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: MAP.report }} />
          Report
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ background: MAP.simReport }}
          />
          Simulated report
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 text-[10px] font-bold leading-none"
            style={{ borderColor: MAP.ring, color: MAP.ringText }}
          >
            5
          </span>
          Cluster: reports within 10 km
        </span>
      </div>
    </div>
  )
}
