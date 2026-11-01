import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Check,
  LocateFixed,
  Plus,
  RefreshCw,
  Satellite,
  ShieldAlert,
  X,
} from 'lucide-react'
import type { FieldEvidence as Evidence, FieldInput, FieldRecord } from '@repo/shared'
import { fieldApi } from '../lib/fieldApi'
import { currentPosition } from '../lib/location'
import { TownMap } from './TownMap'
import './fieldEvidence.css'

const date = (value: string) =>
  new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
type Draft = {
  name: string
  crop: FieldInput['crop']
  season: string
  planting: string
  points: [number, number][]
  geojson: string
}
function readDraft(uid: string): Draft {
  try {
    const d = JSON.parse(localStorage.getItem(`phytos:field-draft:${uid}`) ?? 'null')
    if (d && Array.isArray(d.points) && typeof d.name === 'string') return d
  } catch {}
  return { name: '', crop: 'soybean', season: '2026/27', planting: '', points: [], geojson: '' }
}
const unavailable = {
  not_configured:
    'Field-level NDVI processing is not connected. Satellite scene observations remain available.',
  authorization_failed: 'Copernicus authorization failed. A valid client configuration is needed.',
  unavailable: 'Vegetation statistics could not be retrieved. Try again later.',
  no_usable_pixels: 'No intervals met the cloud-free coverage and pixel-count requirements.',
  ok: '',
}

export function FieldEvidence({ uid, onExample }: { uid: string; onExample: () => void }) {
  const [fields, setFields] = useState<FieldRecord[]>([])
  const [selected, setSelected] = useState('')
  const [regional, setRegional] = useState<Evidence | null>(null)
  const [report, setReport] = useState<Evidence | null>(null)
  const [draft, setDraft] = useState(() => readDraft(uid))
  const [editing, setEditing] = useState(false)
  const form = useRef<HTMLElement>(null)
  const [busy, setBusy] = useState<'saving' | 'refreshing' | 'gps' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    Promise.allSettled([fieldApi.list(), fieldApi.context()]).then(([f, r]) => {
      if (!active) return
      if (f.status === 'fulfilled') {
        setFields(f.value)
        setSelected(f.value[0]?.id ?? '')
      } else
        setError(
          f.reason instanceof Error
            ? f.reason.message
            : 'Could not load your fields. Your draft stays on this device.'
        )
      if (r.status === 'fulfilled') setRegional(r.value)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [uid])
  useEffect(() => {
    let active = true
    setReport(null)
    if (selected)
      fieldApi
        .report(selected)
        .then(value => {
          if (active) setReport(value)
        })
        .catch(() => {})
    return () => {
      active = false
    }
  }, [selected])
  useEffect(() => {
    try {
      localStorage.setItem(`phytos:field-draft:${uid}`, JSON.stringify(draft))
    } catch {}
  }, [draft, uid])
  useEffect(() => {
    if (editing) {
      form.current?.scrollIntoView?.({ block: 'start' })
      form.current?.querySelector('input')?.focus({ preventScroll: true })
    }
  }, [editing])
  const field = fields.find(f => f.id === selected)
  const evidence = field ? report : regional
  const readings = evidence?.readings ?? []
  const latest = readings[readings.length - 1]
  const fresh = latest ? Date.now() - Date.parse(latest.to) < 21 * 86400000 : false
  const afterPlanting = Boolean(
    latest && field?.planting_date && Date.parse(latest.from) >= Date.parse(field.planting_date)
  )
  const reviewMessage =
    latest && fresh
      ? !field?.planting_date
        ? 'Planting date is not recorded. A dated field visit is needed before this evidence can support the current crop.'
        : !afterPlanting
          ? 'The latest vegetation interval predates planting. It does not verify the current crop.'
          : 'Recent vegetation evidence is available. The claimed boundary and field visit still require review.'
      : 'Complete field verification with usable satellite evidence and an officer review. Missing imagery is not evidence of crop failure.'
  const center = field
    ? {
        latitude:
          field.geometry.coordinates[0].slice(0, -1).reduce((s, p) => s + p[1], 0) /
          (field.geometry.coordinates[0].length - 1),
        longitude:
          field.geometry.coordinates[0].slice(0, -1).reduce((s, p) => s + p[0], 0) /
          (field.geometry.coordinates[0].length - 1),
      }
    : { latitude: -16.28, longitude: 27.48 }
  const capture = async () => {
    setBusy('gps')
    setError('')
    try {
      const p = await currentPosition()
      setDraft(d => ({ ...d, points: [...d.points, [p.longitude, p.latitude]] }))
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not capture GPS. Allow location access and try again.'
      )
    } finally {
      setBusy(null)
    }
  }
  const save = async () => {
    setBusy('saving')
    setError('')
    try {
      let geometry: FieldInput['geometry']
      if (draft.geojson.trim()) {
        const parsed = JSON.parse(draft.geojson)
        geometry = parsed.type === 'Feature' ? parsed.geometry : parsed
      } else {
        if (draft.points.length < 3)
          throw new Error(
            'Record at least three different corners in order around the field, or import a GeoJSON polygon.'
          )
        geometry = { type: 'Polygon', coordinates: [[...draft.points, draft.points[0]]] }
      }
      const record = await fieldApi.create({
        name: draft.name,
        crop: draft.crop,
        season: draft.season,
        planting_date: draft.planting || null,
        capture_method: draft.geojson.trim() ? 'imported' : 'gps',
        geometry,
      })
      setFields(f => [record, ...f])
      setSelected(record.id)
      setEditing(false)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not save the field. The draft stays on this device.'
      )
    } finally {
      setBusy(null)
    }
  }
  const refresh = async () => {
    if (!field) return
    setBusy('refreshing')
    setError('')
    try {
      setReport(await fieldApi.refresh(field.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Satellite assessment failed.')
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="field-workspace">
      {error && (
        <p className="field-api-error" role="alert">
          {error}
        </p>
      )}
      {loading && (
        <p className="field-loading" role="status">
          Connecting to your fields and Sentinel-2 observations
        </p>
      )}
      <div className="field-picker">
        {fields.length > 0 ? (
          <label>
            <span>Your fields</span>
            <select
              value={selected}
              disabled={busy === 'refreshing' || busy === 'saving'}
              onChange={e => setSelected(e.target.value)}
            >
              {fields.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} · {f.season}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div>
            <strong>No field registered yet</strong>
            <span>Add a boundary to request field-specific evidence.</span>
          </div>
        )}
        <button
          className="season-small-button"
          aria-label={editing ? 'Close field form' : 'Add a field'}
          onClick={() => setEditing(!editing)}
        >
          {editing ? (
            <X size={16} aria-label="Close field form" />
          ) : (
            <Plus size={17} aria-label="Add a field" />
          )}
        </button>
      </div>
      {editing && (
        <section ref={form} className="field-registration" aria-label="Register a field boundary">
          <h2>Record the field</h2>
          <p>
            Walk around the actual field and capture corners in order, or import its GeoJSON
            polygon. A single GPS pin is not a field boundary.
          </p>
          <label>
            Field name
            <input
              value={draft.name}
              maxLength={80}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder="For example, North soybean plot"
            />
          </label>
          <div className="field-form-pair">
            <label>
              Crop
              <select
                value={draft.crop}
                onChange={e => setDraft({ ...draft, crop: e.target.value as Draft['crop'] })}
              >
                <option value="soybean">Soybean</option>
                <option value="maize">Maize</option>
                <option value="tomato">Tomato</option>
              </select>
            </label>
            <label>
              Season
              <input
                value={draft.season}
                onChange={e => setDraft({ ...draft, season: e.target.value })}
                placeholder="2026/27"
              />
            </label>
          </div>
          <label>
            Planting date, if known
            <input
              type="date"
              value={draft.planting}
              onChange={e => setDraft({ ...draft, planting: e.target.value })}
            />
          </label>
          <button
            className="season-secondary"
            disabled={!!busy || draft.points.length >= 300}
            onClick={capture}
          >
            <LocateFixed size={16} aria-hidden />
            {busy === 'gps' ? 'Capturing GPS' : 'Capture next corner'}
            <span>{draft.points.length} corners</span>
          </button>
          {draft.points.length > 0 && (
            <ol className="field-corners">
              {draft.points.map(([lon, lat], i) => (
                <li key={i}>
                  <span>{i + 1}</span>
                  <code>
                    {lat.toFixed(5)}, {lon.toFixed(5)}
                  </code>
                  <button
                    aria-label={`Remove corner ${i + 1}`}
                    onClick={() =>
                      setDraft({ ...draft, points: draft.points.filter((_, n) => i !== n) })
                    }
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ol>
          )}
          <details>
            <summary>Import a GeoJSON boundary instead</summary>
            <label>
              Polygon or Feature, coordinates in longitude, latitude
              <textarea
                rows={5}
                value={draft.geojson}
                onChange={e => setDraft({ ...draft, geojson: e.target.value })}
                placeholder={'{"type":"Polygon","coordinates":[...]}'}
              />
            </label>
          </details>
          <p className="field-consent">
            Draft corners stay on this phone while offline. Saving sends the boundary to Phytos and
            records it as your claim, not an attested or cadastral boundary.
          </p>
          <button
            className="season-primary"
            disabled={!!busy || draft.name.trim().length < 2}
            onClick={save}
          >
            {busy === 'saving' ? 'Saving field' : 'Save field boundary'}
            <Check size={17} />
          </button>
        </section>
      )}
      <section className="field-panel">
        <div className="field-map">
          <TownMap
            center={center}
            online={navigator.onLine}
            boundary={field?.geometry.coordinates[0]}
            label={field?.name ?? 'Monze regional context'}
          />
          <span className="field-map-label">
            {field ? 'Claimed field boundary' : 'Monze town overview'}
          </span>
        </div>
        <div className="field-panel-body">
          <div>
            <p className="season-overline">
              {field ? 'YOUR RECORDED FIELD' : 'REGIONAL SATELLITE CONTEXT'}
            </p>
            <h2>{field?.name ?? 'Monze, Zambia'}</h2>
          </div>
          <span className="season-tag">{field ? 'Unattested' : 'Not a farm'}</span>
        </div>
        {field && (
          <div className="field-measures">
            <div>
              <strong>
                {field.area_ha.toFixed(2)} <small>ha</small>
              </strong>
              <span>Approximate claimed area</span>
            </div>
            <div>
              <strong>{field.crop}</strong>
              <span>{field.season}</span>
            </div>
          </div>
        )}
        {field && (
          <p className="field-planting">
            Planting date: {field.planting_date ? date(field.planting_date) : 'not recorded'}
          </p>
        )}
      </section>
      <section className="satellite-evidence">
        <div className="season-section-title">
          <h2>
            <Satellite size={17} aria-hidden /> Satellite observations
          </h2>
          <span className="season-tag season-tag--green">
            {evidence?.catalogue_status === 'ok' ? 'Live catalogue' : 'Awaiting data'}
          </span>
        </div>
        <p className="field-explainer">
          {field
            ? 'Sentinel-2 scenes intersecting the recorded polygon. Scene cloud cover describes the full image tile, not clear pixels over your field.'
            : 'Real Sentinel-2 passes over Monze. These are regional context until you register a field boundary.'}
        </p>
        {(evidence?.scenes ?? []).slice(0, 3).map((scene, i) => (
          <article key={scene.id} className="satellite-pass">
            <div>
              <strong>{date(scene.acquired_at)}</strong>
              <span>
                {scene.scene_cloud_pct === null
                  ? 'Cloud cover unavailable'
                  : `${scene.scene_cloud_pct.toFixed(1)}% scene cloud cover`}
              </span>
            </div>
            <small>Sentinel-2 L2A</small>
            {i === 0 && scene.preview_url && (
              <details>
                <summary>View actual scene preview</summary>
                <img
                  src={scene.preview_url}
                  alt={`Full Sentinel-2 tile acquired ${date(scene.acquired_at)}`}
                  loading="lazy"
                />
                <p>Full satellite tile, not a field-scale crop-health image.</p>
                <code>{scene.id}</code>
              </details>
            )}
          </article>
        ))}
        {evidence?.catalogue_status === 'ok' && !evidence.scenes.length && (
          <p>No intersecting scenes were returned for the last 90 days.</p>
        )}
        {evidence?.retrieved_at && (
          <p className="evidence-source">
            Source: {evidence.catalogue_source}
            <br />
            Checked {date(evidence.retrieved_at)}
          </p>
        )}
      </section>
      {field && (
        <>
          <section className="vegetation-panel">
            <div className="season-section-title">
              <h2>Field vegetation index</h2>
              <span>NDVI</span>
            </div>
            {latest ? (
              <>
                <strong className="vegetation-value">{latest.ndvi.toFixed(2)}</strong>
                <p>
                  {date(latest.from)} – {date(latest.to)} · {latest.valid_pixel_pct.toFixed(0)}%
                  usable sampling-grid pixels
                </p>
                {readings.length > 1 && (
                  <svg
                    viewBox="0 0 300 85"
                    role="img"
                    aria-label="Recorded NDVI intervals, oldest to newest"
                  >
                    <path d="M0 74H300M0 10H300" stroke="#e1e8da" fill="none" />
                    <polyline
                      points={readings
                        .map(
                          (r, i) =>
                            `${(i / (readings.length - 1)) * 300},${74 - ((r.ndvi + 1) / 2) * 64}`
                        )
                        .join(' ')}
                      fill="none"
                      stroke="#3b704a"
                      strokeWidth="2.5"
                    />
                  </svg>
                )}
                <span>
                  {fresh ? 'Recent usable observation' : 'Observation is older than 21 days'}
                </span>
              </>
            ) : (
              <p>
                {report
                  ? unavailable[report.vegetation_status]
                  : 'Request an assessment to check for usable field-level observations.'}
              </p>
            )}
            <p className="evidence-source">
              Cloud-masked red/NIR statistics sampled at about 10 m. Minimum 50% usable sampling-grid
              pixels and 10 valid pixels. Irregular boundaries can lower this coverage. No crop yield
              or weeding conclusion is inferred.
            </p>
          </section>
          <div className="field-review-note">
            <ShieldAlert size={20} />
            <div>
              <strong>Officer review required</strong>
              <p>{reviewMessage}</p>
            </div>
          </div>
          <button className="season-primary" disabled={!!busy} onClick={refresh}>
            <RefreshCw size={17} />
            {busy === 'refreshing' ? 'Requesting satellite evidence' : 'Refresh satellite evidence'}
          </button>
          <p className="field-consent">
            This sends your boundary to the satellite catalogue and, when configured, Copernicus for
            processing.
          </p>
        </>
      )}
      {!field && !editing && (
        <button className="season-primary" onClick={() => setEditing(true)}>
          Register your field <Plus size={17} />
        </button>
      )}
      <button className="field-example-link" onClick={onExample}>
        <span>
          <strong>Explore the financing example</strong>
          <small>Given’s illustrative CEIH season and advance ledger</small>
        </span>
        <ArrowRight size={18} />
      </button>
    </div>
  )
}
