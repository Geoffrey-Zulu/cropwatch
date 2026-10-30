import { geoMercator, geoPath } from 'd3-geo'
import { Minus, Plus } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { ISSUE_LABELS, type GeoPoint, type Issue, type RiskLevel } from '@repo/shared'
import { Bar, Loading } from './Skeleton'
import { useDistricts } from './ZambiaMap'

// The national map in mockup A's language (Field-airy): the map is the page. Zambia is fitted
// into the space the floating islands leave, districts shaded as fields (Low a fallow green, High
// solid brick, Elevated hatched maize), reports as small ink dots, clusters as rings with their
// count in a white pill. It moves like the ops console (the one import from mockup B): the
// region toggle and a pressed district fly to their place, rings breathe, fills fade between
// levels. 250 to 400 ms, ease-out, no bounce; under prefers-reduced-motion it simply changes.

const W = 960
const H = 720
const FILL: Record<RiskLevel, string> = { HIGH: '#A23B21', ELEVATED: '#EEC14A', LOW: '#D6E2C4' }
const FLY_MS = 360

export type Region = 'all' | 'lusaka' | 'eastern'

export interface FieldPoint {
  id: string
  location: GeoPoint
  sim: boolean
}

export interface FieldCluster {
  id: string
  center: GeoPoint
  size: number
  verified: number
  issue: Issue
  district: string
  sim: boolean
}

interface View {
  // Screen pixels per map unit, and the map unit at the centre of the stage.
  s: number
  cx: number
  cy: number
}

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
const ease = (t: number) => 1 - Math.pow(1 - t, 3)

export function FieldMap({
  levels,
  watched,
  points,
  clusters,
  region,
  focus,
  selected,
  highlight = null,
  onDistrict,
  onCluster,
  avoid,
  rightEdge,
  bottomEdge,
  stacked,
}: {
  levels: Map<string, RiskLevel>
  // Risk units to name on the map (the districts to watch).
  watched: { slug: string; district: string }[]
  points: FieldPoint[]
  clusters: FieldCluster[]
  region: Region
  // A district to fly to (pressed on the map or in the list); null for the region.
  focus: string | null
  // The risk unit outlined on the map.
  selected: string | null
  // A risk unit to outline lightly (a row hovered in the list).
  highlight?: string | null
  onDistrict?: (slug: string, name: string) => void
  onCluster?: (id: string) => void
  // The islands the land keeps clear of, the panel on the right, and the line along the foot.
  avoid: RefObject<HTMLElement | null>[]
  rightEdge: RefObject<HTMLElement | null>
  bottomEdge: RefObject<HTMLElement | null>
  // Phones: the map is a block of its own, fitted with a margin, no islands on it.
  stacked: boolean
}) {
  const districts = useDistricts()
  const host = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState<View | null>(null)
  const viewRef = useRef<View | null>(null)
  const place = `${region}|${focus ?? ''}`
  const [zoomAt, setZoomAt] = useState({ place, z: 1 })
  const zoom = zoomAt.place === place ? zoomAt.z : 1
  const setZoom = (f: (z: number) => number) => setZoomAt({ place, z: f(zoom) })
  const [hover, setHover] = useState<string | null>(null)

  // The same Mercator frame as the rest of the dashboard: Zambia in 960 x 720.
  const projection = useMemo(() => {
    if (!districts) return null
    return geoMercator().fitExtent(
      [
        [16, 16],
        [W - 16, H - 56],
      ],
      districts
    )
  }, [districts])

  const shapes = useMemo(() => {
    if (!districts || !projection) return []
    const path = geoPath(projection)
    return districts.features.map((f, i) => {
      const d = path(f) ?? ''
      const [[x0, y0], [x1, y1]] = path.bounds(f)
      return {
        key: `${f.properties.slug}:${f.properties.name}:${i}`,
        slug: f.properties.slug,
        name: f.properties.name,
        province: f.properties.province,
        partOf: f.properties.part_of,
        d,
        box: [x0, y0, x1, y1] as const,
        centroid: path.centroid(f),
      }
    })
  }, [districts, projection])

  // Every vertex, for keeping the land clear of the islands.
  const vertices = useMemo(() => {
    const out: number[] = []
    for (const s of shapes) {
      const n = s.d.match(/-?\d+(\.\d+)?/g)
      if (n) for (let i = 0; i < n.length; i += 2) out.push(Number(n[i]), Number(n[i + 1]))
    }
    return out
  }, [shapes])

  const boxOf = useCallback(
    (keep: (s: (typeof shapes)[number]) => boolean) => {
      let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
      for (const s of shapes.filter(keep)) {
        x0 = Math.min(x0, s.box[0])
        y0 = Math.min(y0, s.box[1])
        x1 = Math.max(x1, s.box[2])
        y1 = Math.max(y1, s.box[3])
      }
      return [x0, y0, x1, y1] as const
    },
    [shapes]
  )

  const project = useCallback(
    (p: GeoPoint) => projection?.([p.longitude, p.latitude]) ?? null,
    [projection]
  )

  useLayoutEffect(() => {
    const el = host.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Where the map should be: the whole country hugging the right panel and the foot, clear of
  // the islands (as mockup A fits it), or a region or district fitted into the open space.
  const fit = useCallback((): View | null => {
    if (!shapes.length || !size.w || !size.h) return null
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 15
    const g = 1.6 * rem
    const country = boxOf(() => true)
    const regionBox =
      region === 'lusaka'
        ? boxOf(s => s.slug === 'lusaka' || s.slug === 'chongwe')
        : region === 'eastern'
          ? boxOf(s => s.province === 'Eastern')
          : country
    // A pressed district keeps some of its surroundings in view: at least 150 map units a side.
    const focusBox = (() => {
      if (!focus) return null
      const [x0, y0, x1, y1] = boxOf(s => s.slug === focus)
      const cx = (x0 + x1) / 2
      const cy = (y0 + y1) / 2
      const hw = Math.max(75, (x1 - x0) / 2)
      const hh = Math.max(75, (y1 - y0) / 2)
      return [cx - hw, cy - hh, cx + hw, cy + hh] as const
    })()
    const toView = (s: number, ox: number, oy: number): View => ({
      s,
      cx: (size.w / 2 - ox) / s,
      cy: (size.h / 2 - oy) / s,
    })
    const fitInto = (
      box: readonly number[],
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      k: number
    ) => {
      const s = Math.min((x1 - x0) / (box[2] - box[0]), (y1 - y0) / (box[3] - box[1])) * k
      const ox = x0 + (x1 - x0 - (box[2] - box[0]) * s) / 2 - box[0] * s
      const oy = y0 + (y1 - y0 - (box[3] - box[1]) * s) / 2 - box[1] * s
      return toView(s, ox, oy)
    }
    let v: View
    if (stacked) {
      const box = focusBox ?? regionBox
      v = fitInto(
        box,
        12,
        12,
        size.w - 12,
        size.h - 12,
        focusBox ? 0.55 : region === 'all' ? 1 : 0.82
      )
    } else {
      const hostBox = host.current!.getBoundingClientRect()
      const rect = (el: HTMLElement | null, m: number) => {
        if (!el) return null
        const r = el.getBoundingClientRect()
        if (!r.width) return null
        return {
          l: r.left - hostBox.left - m,
          t: r.top - hostBox.top - m,
          r: r.right - hostBox.left + m,
          b: r.bottom - hostBox.top + m,
        }
      }
      const right = rect(rightEdge.current, 0)
      const foot = rect(bottomEdge.current, 0)
      const x1 = (right?.l ?? size.w) - g * 0.9
      const yB = (foot?.t ?? size.h) - g * 0.45
      const yT = g * 0.6
      const islands = avoid.map(r => rect(r.current, g * 0.5)).filter(Boolean) as NonNullable<
        ReturnType<typeof rect>
      >[]
      const clear = (s: number, ox: number, oy: number) => {
        for (let i = 0; i < vertices.length; i += 2) {
          const X = vertices[i] * s + ox
          const Y = vertices[i + 1] * s + oy
          for (const r of islands) if (X > r.l && X < r.r && Y > r.t && Y < r.b) return false
        }
        return true
      }
      if (region === 'all' && !focusBox) {
        // Zambia hugs the watch panel and the foot; the largest size whose land touches no island.
        const ZR = country[2] + 42
        const hi = Math.min((x1 - g) / (ZR - country[0]), (yB - yT) / (country[3] - country[1]))
        let s = hi * 0.5
        for (let t = hi; t > hi * 0.5; t *= 0.985)
          if (clear(t, x1 - ZR * t, yB - country[3] * t)) {
            s = t
            break
          }
        const ox = x1 - ZR * s
        let oy = yB - country[3] * s
        // Lift it towards the middle while it stays clear.
        const room = oy + country[1] * s - yT
        for (let f = 0.5; f > 0; f -= 0.05)
          if (clear(s, ox, oy - room * f)) {
            oy -= room * f
            break
          }
        v = toView(s, ox, oy)
      } else {
        // A region or a district: fitted into the open space right of the tall islands on the
        // left (the figures) and below the short ones along the top (the title and toggle).
        const tall = islands.filter(r => r.l < size.w * 0.3 && r.b - r.t > size.h * 0.25)
        const top = islands.filter(r => r.b < size.h * 0.25)
        const left = Math.max(g, ...tall.map(r => r.r))
        const upper = Math.max(g, ...top.map(r => r.b))
        v = fitInto(focusBox ?? regionBox, left, upper, x1, yB, focusBox ? 0.6 : 0.9)
      }
    }
    if (zoom !== 1) v = { ...v, s: v.s * zoom }
    return v
    // `avoid` and the edges are refs read at fit time; their size changes come through `size`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes, vertices, size, region, focus, zoom, stacked, boxOf])

  // Fly to the target: the centre moves straight, the scale geometrically, ease-out. The first
  // view, and every view under prefers-reduced-motion, lands in one frame.
  useEffect(() => {
    const target = fit()
    if (!target) return
    const from = viewRef.current
    const still = !from || reduced()
    let frame = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = still || !from ? 1 : ease(Math.min(1, (now - t0) / FLY_MS))
      if (!from) {
        viewRef.current = target
        setView(target)
        return
      }
      const v = {
        s: from.s * Math.pow(target.s / from.s, p),
        cx: from.cx + (target.cx - from.cx) * p,
        cy: from.cy + (target.cy - from.cy) * p,
      }
      viewRef.current = v
      setView(v)
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [fit])

  const watchedSet = useMemo(() => new Set(watched.map(w => w.slug)), [watched])
  const selectedPath = useMemo(
    () =>
      selected
        ? shapes
            .filter(s => s.slug === selected)
            .map(s => s.d)
            .join('')
        : '',
    [shapes, selected]
  )
  const hoverSlug = highlight ?? (hover ? (shapes.find(x => x.key === hover)?.slug ?? null) : null)
  const hoverPath = useMemo(
    () =>
      hoverSlug
        ? shapes
            .filter(s => s.slug === hoverSlug)
            .map(s => s.d)
            .join('')
        : '',
    [shapes, hoverSlug]
  )

  // The fields: drawn once, their fills fading between levels.
  const fields = useMemo(
    () => (
      <>
        <g filter="url(#fm-lift)">
          <g fill="#93A784" stroke="#93A784" strokeWidth={3} strokeLinejoin="round">
            {shapes.map(s => (
              <path key={s.key} d={s.d} />
            ))}
          </g>
        </g>
        <g stroke="#FFFFFF" strokeWidth={0.75} strokeLinejoin="round">
          {shapes.map(s => {
            const level = levels.get(s.slug) ?? 'LOW'
            return (
              <path
                key={s.key}
                d={s.d}
                fill={FILL[level]}
                style={{ transition: 'fill 320ms cubic-bezier(0.16, 1, 0.3, 1)' }}
                className="cursor-pointer"
                onPointerEnter={() => setHover(s.key)}
                onPointerLeave={() => setHover(h => (h === s.key ? null : h))}
                onClick={() => onDistrict?.(s.slug, s.name)}
              >
                <title>
                  {s.name}
                  {s.partOf ? ` · shares its risk signal with ${s.partOf}` : ''}
                </title>
              </path>
            )
          })}
        </g>
        {/* Elevated is hatched as well as coloured, so it reads without colour too. */}
        <g pointerEvents="none" fill="url(#fm-stripes)">
          {shapes.map(s => (
            <path
              key={s.key}
              d={s.d}
              opacity={levels.get(s.slug) === 'ELEVATED' ? 1 : 0}
              style={{ transition: 'opacity 320ms cubic-bezier(0.16, 1, 0.3, 1)' }}
            />
          ))}
        </g>
        {/* A darker rim round High, so the block holds together on a projector. */}
        <g fill="none" stroke="#6E2410" strokeWidth={1} opacity={0.5} pointerEvents="none">
          {shapes
            .filter(s => levels.get(s.slug) === 'HIGH')
            .map(s => (
              <path key={s.key} d={s.d} />
            ))}
        </g>
      </>
    ),
    [shapes, levels, onDistrict]
  )

  if (!districts || !view || !size.w) {
    return (
      <div ref={host} className="absolute inset-0">
        <Loading label="Loading the map">
          <Bar className="absolute inset-[12%] rounded-island opacity-60" />
        </Loading>
      </div>
    )
  }

  const { s } = view
  const u = (px: number) => px / s
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 15
  const vb = [view.cx - size.w / 2 / s, view.cy - size.h / 2 / s, size.w / s, size.h / s]
  const dotR = Math.max(2.1, u(2.15))
  const ringR = Math.max(11, u(rem * 0.78))
  const countPx = rem * (stacked ? 0.78 : 0.84)
  const showNames = !(stacked && region === 'all' && !focus && zoom <= 1)

  // Each cluster's count sits in a pill at the ring's top right, or at the first other corner
  // where it clears the pills and rings already placed (Lusaka and Chongwe at the national view).
  const placed: {
    c: FieldCluster
    x: number
    y: number
    txt: string
    fs: number
    h: number
    w: number
    px: number
    py: number
  }[] = []
  for (const c of clusters) {
    const at = project(c.center)
    if (!at) continue
    const [x, y] = at
    const txt = String(c.size)
    const fs = u(countPx)
    const h = fs * 1.36
    const w = fs * (0.72 + txt.length * 0.6)
    const corner = ([sx, sy]: number[]) => ({
      px: x + sx * (ringR * 0.72 + w / 2 - fs * 0.15),
      py: y + sy * (ringR * 0.72 + h / 2 - fs * 0.3),
    })
    const hits = (px: number, py: number) =>
      placed.some(
        o =>
          (Math.abs(o.px - px) < (o.w + w) / 2 && Math.abs(o.py - py) < (o.h + h) / 2) ||
          Math.hypot(o.x - px, o.y - py) < ringR + w / 2
      )
    const spot =
      [
        [1, -1],
        [-1, -1],
        [1, 1],
        [-1, 1],
      ]
        .map(corner)
        .find(p => !hits(p.px, p.py)) ?? corner([1, -1])
    placed.push({ c, x, y, txt, fs, h, w, ...spot })
  }

  // Names for the districts to watch, nudged apart where two would collide.
  const fsLabel = u(rem * 0.9)
  const widthOf = (text: string) => fsLabel * 0.56 * text.length
  type Box = { l: number; r: number; t: number; b: number }
  const taken: Box[] = [
    ...placed.map(p => ({ l: p.x - ringR, r: p.x + ringR, t: p.y - ringR, b: p.y + ringR })),
    ...placed.map(p => ({
      l: p.px - p.w / 2,
      r: p.px + p.w / 2,
      t: p.py - p.h / 2,
      b: p.py + p.h / 2,
    })),
  ]
  // A watched district's name sits beside its cluster ring (right, then below, left, above), or
  // at the district's centre without one: the first spot that clears every ring, pill and name.
  const labels: { text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end' }[] = []
  if (showNames)
    for (const w of watched) {
      const shape =
        shapes.find(x => x.slug === w.slug && x.name === w.district) ??
        shapes.find(x => x.slug === w.slug)
      if (!shape) continue
      const ring = placed.find(p => p.c.district === w.district)
      const half = widthOf(w.district) / 2
      const gap = u(5)
      const candidates: { x: number; y: number; anchor: 'start' | 'middle' | 'end' }[] = ring
        ? [
            { x: ring.x + ringR + gap, y: ring.y + fsLabel * 0.15, anchor: 'start' },
            { x: ring.x, y: ring.y + ringR + fsLabel * 0.75, anchor: 'middle' },
            { x: ring.x - ringR - gap, y: ring.y + fsLabel * 0.15, anchor: 'end' },
            { x: ring.x, y: ring.y - ringR - fsLabel * 0.55, anchor: 'middle' },
          ]
        : [
            { x: shape.centroid[0], y: shape.centroid[1], anchor: 'middle' },
            { x: shape.centroid[0], y: shape.centroid[1] + fsLabel * 1.2, anchor: 'middle' },
            { x: shape.centroid[0], y: shape.centroid[1] - fsLabel * 1.2, anchor: 'middle' },
          ]
      const boxOf = (c: (typeof candidates)[number]): Box => {
        const l = c.anchor === 'start' ? c.x : c.anchor === 'end' ? c.x - 2 * half : c.x - half
        return { l, r: l + 2 * half, t: c.y - fsLabel * 0.6, b: c.y + fsLabel * 0.5 }
      }
      const free = (b: Box) => !taken.some(o => b.l < o.r && b.r > o.l && b.t < o.b && b.b > o.t)
      const pick = candidates.find(c => free(boxOf(c))) ?? candidates[0]
      taken.push(boxOf(pick))
      labels.push({ text: w.district, ...pick })
    }

  return (
    <div ref={host} className="absolute inset-0">
      <svg
        viewBox={vb.map(n => n.toFixed(3)).join(' ')}
        className="absolute inset-0 block h-full w-full touch-none select-none"
        role="img"
        aria-label="Zambia's districts shaded by risk signal level, with report dots and cluster rings"
      >
        <defs>
          <pattern
            id="fm-stripes"
            patternUnits="userSpaceOnUse"
            width={5.4}
            height={5.4}
            patternTransform="rotate(45)"
          >
            <rect width={2} height={5.4} fill="#B98516" />
          </pattern>
          <filter id="fm-lift" x="-10%" y="-10%" width="120%" height="125%">
            <feDropShadow dx={0} dy={6} stdDeviation={8} floodColor="#2A4024" floodOpacity={0.2} />
          </filter>
          <filter id="fm-pill" x="-40%" y="-60%" width="180%" height="240%">
            <feDropShadow
              dx={0}
              dy={0.8}
              stdDeviation={1.1}
              floodColor="#1B2920"
              floodOpacity={0.3}
            />
          </filter>
        </defs>
        {fields}
        <g fill="none" pointerEvents="none" strokeLinejoin="round">
          <path d={selectedPath} stroke="#FFFFFF" strokeWidth={u(4.8)} />
          <path d={selectedPath} stroke="#1B2920" strokeWidth={u(2.2)} />
          {hoverSlug && hoverSlug !== selected && watchedSet.has(hoverSlug) && (
            <path d={hoverPath} stroke="#1B2920" strokeWidth={u(1.5)} strokeDasharray="3 2" />
          )}
        </g>
        <g
          fill="#1B2920"
          stroke="#FFFFFF"
          strokeWidth={Math.max(0.7, u(0.75))}
          pointerEvents="none"
        >
          {points.map(p => {
            const at = project(p.location)
            return at ? <circle key={p.id} cx={at[0]} cy={at[1]} r={dotR} /> : null
          })}
        </g>
        {placed.map(({ c, x, y, txt, fs, h, w, px, py }) => {
          return (
            <g
              key={c.id}
              role="button"
              tabIndex={0}
              aria-label={`Cluster: ${c.size} ${ISSUE_LABELS[c.issue]} reports near ${c.district}${c.verified ? `, ${c.verified} verified` : ', none verified yet'}`}
              className="cursor-pointer outline-none"
              onClick={() => onCluster?.(c.id)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onCluster?.(c.id)
                }
              }}
            >
              <circle
                cx={x}
                cy={y}
                r={ringR}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={u(2)}
                className="ring-pulse"
                pointerEvents="none"
              />
              <circle
                cx={x}
                cy={y}
                r={ringR}
                fill="rgba(255,255,255,.2)"
                stroke="#FFFFFF"
                strokeWidth={u(4.2)}
              />
              <circle
                cx={x}
                cy={y}
                r={ringR}
                fill="none"
                stroke="#1B2920"
                strokeWidth={u(2)}
                strokeDasharray={c.verified > 0 ? undefined : `${u(3.8)} ${u(2.8)}`}
              />
              <rect
                x={px - w / 2}
                y={py - h / 2}
                width={w}
                height={h}
                rx={h / 2}
                fill="#FFFFFF"
                filter="url(#fm-pill)"
              />
              <text
                x={px}
                y={py + fs * 0.36}
                textAnchor="middle"
                fontSize={fs}
                fontWeight={750}
                fill="#1B2920"
                className="font-body tabular-nums"
              >
                {txt}
              </text>
              <title>
                Cluster: {ISSUE_LABELS[c.issue]}, {c.size} reports within 10 km
                {c.verified ? `, ${c.verified} verified by an officer` : ', none verified yet'}
              </title>
            </g>
          )
        })}
        <g pointerEvents="none">
          {labels.map(l => (
            <text
              key={l.text}
              x={l.x}
              y={l.y + fsLabel * 0.35}
              textAnchor={l.anchor}
              fontSize={fsLabel}
              fontWeight={650}
              fill="#1B2920"
              stroke="rgba(255,255,255,.94)"
              strokeWidth={u(3.6)}
              strokeLinejoin="round"
              paintOrder="stroke"
              className="font-body"
            >
              {l.text}
            </text>
          ))}
        </g>
      </svg>
      <div
        className={`absolute z-10 flex flex-col rounded-pill bg-panel p-[0.3rem] shadow-island-sm ${
          stacked ? 'bottom-3 right-3' : 'bottom-[1.6rem] left-[1.6rem]'
        }`}
        role="group"
        aria-label="Zoom"
      >
        <MapButton label="Zoom in" onClick={() => setZoom(z => Math.min(z * 1.35, 6))}>
          <Plus aria-hidden />
        </MapButton>
        <i className="mx-[0.55rem] my-[0.1rem] block h-px bg-hairline" />
        <MapButton label="Zoom out" onClick={() => setZoom(z => Math.max(z / 1.35, 0.6))}>
          <Minus aria-hidden />
        </MapButton>
      </div>
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
      className="grid h-10 w-10 place-items-center rounded-pill text-fg transition-colors duration-200 ease-out hover:bg-well md:h-[2.5rem] md:w-[2.5rem]"
    >
      {children}
    </button>
  )
}
