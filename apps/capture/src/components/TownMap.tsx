import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import type { Point } from '../lib/location'
import { fieldMapView, mapViewport } from '../lib/townMap'

const tileTemplate =
  import.meta.env.VITE_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export function TownMap({
  center,
  online,
  boundary,
  label = 'Monze, Zambia',
}: {
  center: Point
  online: boolean
  boundary?: [number, number][]
  label?: string
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [failed, setFailed] = useState(false)
  const view =
    boundary && boundary.length >= 4
      ? fieldMapView(boundary, width || 350, 182)
      : { center, zoom: 12, points: null }
  useEffect(() => {
    if (!viewport.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries =>
      setWidth(Math.round(entries[0].contentRect.width))
    )
    observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (online) setFailed(false)
  }, [online])
  return (
    <div
      ref={viewport}
      className="town-map"
      role="group"
      aria-label={`${label}. ${boundary ? 'Claimed field boundary, not an attested parcel.' : 'Regional overview, not a farm boundary.'}`}
    >
      <div className="field-map-fallback">
        <MapPin size={26} aria-hidden />
        <strong>{label}</strong>
        <span>
          {view.center.latitude.toFixed(5)}, {view.center.longitude.toFixed(5)}
        </span>
        {(!online || failed) && <small>Map unavailable. GPS capture still works.</small>}
      </div>
      {online && !failed && width > 0 && (
        <div className="town-map-tiles" aria-hidden>
          {mapViewport(view.center, width, 182, view.zoom).map(tile => (
            <img
              key={`${tile.zoom}/${tile.x}/${tile.y}`}
              src={tileTemplate
                .replace('{z}', String(tile.zoom))
                .replace('{x}', String(tile.x))
                .replace('{y}', String(tile.y))}
              alt=""
              draggable={false}
              width={256}
              height={256}
              style={{ left: tile.left, top: tile.top }}
              onError={() => setFailed(true)}
            />
          ))}
        </div>
      )}
      {view.points && width > 0 && (
        <svg className="field-boundary-overlay" viewBox={`0 0 ${width} 182`} aria-hidden>
          <polygon
            points={view.points}
            fill="#2c744327"
            stroke="#245d37"
            strokeWidth="2"
            strokeDasharray="5 3"
          />
        </svg>
      )}
      <a
        className="town-map-credit"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
      >
        © OpenStreetMap contributors
      </a>
    </div>
  )
}
