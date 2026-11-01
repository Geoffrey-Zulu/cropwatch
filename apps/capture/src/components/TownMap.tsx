import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import type { Point } from '../lib/location'
import { mapViewport } from '../lib/townMap'

const tileTemplate =
  import.meta.env.VITE_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export function TownMap({ center, online }: { center: Point; online: boolean }) {
  const viewport = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [failed, setFailed] = useState(false)
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
      aria-label="Map overview of Monze town, Zambia. No farm boundary is shown."
    >
      <div className="field-map-fallback">
        <MapPin size={26} aria-hidden />
        <strong>Monze, Zambia</strong>
        <span>16.28° S · 27.48° E</span>
        {(!online || failed) && <small>Map unavailable. GPS capture still works.</small>}
      </div>
      {online && !failed && width > 0 && (
        <div className="town-map-tiles" aria-hidden>
          {mapViewport(center, width, 182).map(tile => (
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
