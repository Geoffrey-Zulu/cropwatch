import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Check, LoaderCircle, PenLine, Undo2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  polygonAreaHa,
  zmw,
  type FieldState,
  type FieldsMap,
  type MomoProvider,
} from '@repo/shared'
import { DemoBadge } from '../../components/DemoBadge'
import { Dialog } from '../../components/Dialog'
import { Drawer } from '../../components/Drawer'
import { Bar, Loading } from '../../components/Skeleton'
import { useDrawerLinks } from '../../hooks/useRoute'
import { IMAGERY, warmTiles } from '../../lib/imagery'
import { useSeasonRefresh } from '../../lib/season'
import { trpc } from '../../lib/trpc'
import { FieldCardSection } from './FieldCardSection'

// The Fields map (Outgrower View): the org's fields over the real ground, coloured by what the
// season's rules say about each (verified from space, checked on the ground), a click from its
// field card. Outlines are this agribusiness's own (invariant 6, amended); anyone else gets camp
// totals. Drawing a boundary enrols a farm: its hectares come from the outline.

const STATE_LABEL: Record<FieldState, string> = {
  established: 'Established: seen from space or on a field visit',
  not_planted: 'No crop seen from space: visit',
  stress: 'Stress on this field only',
  shock: 'Drought-flagged camp',
  cloud_gap: 'Cloud gap: waiting for a clear pass or a visit',
}
const STATE_ORDER: FieldState[] = ['established', 'not_planted', 'stress', 'shock', 'cloud_gap']

type Ring = [number, number][]

// Wide: the map is the page, with the title, the tabs and the controls floating over its top left
// and the key at its bottom left. A fly-in lands the fields clear of them.
const wide = () => window.matchMedia('(min-width: 1024px)').matches
const clear = (): L.FitBoundsOptions =>
  wide()
    ? { paddingTopLeft: L.point(32, 236), paddingBottomRight: L.point(32, 32) }
    : { padding: L.point(16, 16) }

// The header line: what the map shows, counted, so the white outlines are explained up front.
function fieldCounts(fields: FieldsMap['fields']) {
  const n = (s: FieldState) => fields.filter(f => f.state === s).length
  return [
    `${fields.length} fields`,
    // A zero says nothing ("0 established" in a drought camp reads as "never came up").
    n('established') && `${n('established')} established`,
    n('cloud_gap') && `${n('cloud_gap')} under cloud, waiting for a clear pass or a visit`,
    n('shock') && `${n('shock')} in a drought-flagged camp`,
  ]
    .filter(Boolean)
    .join(' · ')
}
const toLatLngs = (ring: Ring) => ring.map(([lng, lat]) => L.latLng(lat, lng))
const extent = (b: [number, number, number, number]) =>
  L.latLngBounds(L.latLng(b[1], b[0]), L.latLng(b[3], b[2]))

export function FieldsMapSection({
  orgId,
  commandCenter,
  intro,
}: {
  orgId: string
  commandCenter: boolean
  // The page's title and tabs: they float on the map on a wide screen, and stack above it on a
  // phone (mockup A's .intro).
  intro?: ReactNode
}) {
  const query = trpc.season.fields.useQuery({ orgId }, { refetchInterval: 6000, staleTime: 2000 })
  const { route, open, close } = useDrawerLinks()
  const opened = route.drawer?.kind === 'contract' ? route.drawer.id : null
  const data = query.data
  if (query.error)
    return (
      <p className="island px-6 py-5 text-label text-fg-2">
        The Fields map could not load ({query.error.message}).
      </p>
    )
  if (!data)
    return (
      <Loading label="Loading the Fields map">
        <Bar className="h-[62vh] w-full rounded-island" />
      </Loading>
    )
  const openedField = data.fields.find(f => f.contract_id === opened)
  return (
    <>
      <FieldsMapView
        data={data}
        intro={intro}
        onOpen={id => (window.location.hash = open({ kind: 'contract', id }))}
      />
      {openedField && (
        <Drawer
          kicker={`${openedField.camp} · ${openedField.contracted_ha} ha soya`}
          title={openedField.farmer_name}
          aside={<DemoBadge small rows={[openedField]} />}
          closeHref={close()}
        >
          <FieldCardSection
            orgId={orgId}
            contractId={openedField.contract_id}
            commandCenter={commandCenter}
            narrow
          />
        </Drawer>
      )}
    </>
  )
}

export function FieldsMapView({
  data,
  intro,
  onOpen,
}: {
  data: FieldsMap
  intro?: ReactNode
  onOpen: (contractId: string) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  // The latest click handler, without redrawing every field when the parent re-renders.
  const openRef = useRef(onOpen)
  openRef.current = onOpen
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const drawLayer = useRef<L.LayerGroup | null>(null)
  const [imagery, setImagery] = useState<'esri' | 'eox' | 'none'>('esri')
  const [camp, setCamp] = useState<string | null>(null)
  // The fills fade in once the map has landed: a class on the wrapper, not React state.
  const wrap = useRef<HTMLDivElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [points, setPoints] = useState<Ring>([])
  const [enrolling, setEnrolling] = useState<Ring | null>(null)
  const heroCamp =
    data.fields.find(f => f.contract_id === data.hero_contract_id)?.camp ??
    data.camps[0]?.camp ??
    null
  const all = useMemo(
    () =>
      data.camps.length
        ? data.camps.reduce((b, c) => b.extend(extent(c.bounds)), extent(data.camps[0].bounds))
        : null,
    [data.camps]
  )

  // The map: once. Imagery falls back to EOX, then to the plain canvas.
  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { zoomControl: false, zoomSnap: 0.25, attributionControl: true })
    m.attributionControl.setPrefix(false)
    L.control.zoom({ position: 'topright' }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    drawLayer.current = L.layerGroup().addTo(m)
    map.current = m
    // The map is the page: it fills the screen below its header, legend included, at any
    // projector resolution (the header wraps differently at each width).
    const fit = () => {
      const box = wrap.current
      if (!box) return
      // On a wide screen the map is the page and the stage sets its size.
      if (wide()) {
        box.style.height = ''
        m.invalidateSize(false)
        return
      }
      const top = box.getBoundingClientRect().top + window.scrollY
      box.style.height = `${Math.round(Math.min(832, Math.max(384, window.innerHeight - top - 16)))}px`
      m.invalidateSize(false)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => {
      window.removeEventListener('resize', fit)
      m.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const m = map.current
    if (!m || imagery === 'none') return
    const source = IMAGERY[imagery]
    let loaded = 0
    let failed = 0
    const tiles = L.tileLayer(source.url, {
      maxZoom: 19,
      maxNativeZoom: source.maxNativeZoom,
      attribution: source.attribution,
      crossOrigin: false,
    })
      .on('tileload', () => loaded++)
      .on('tileerror', ({ tile, coords }: L.TileErrorEvent) => {
        failed++
        if (failed >= 4 && loaded === 0) setImagery(imagery === 'esri' ? 'eox' : 'none')
        // A busy venue network drops the odd tile: ask once more rather than leave a hole.
        else if (!tile.dataset.retried) {
          tile.dataset.retried = '1'
          setTimeout(() => (tile.src = tiles.getTileUrl(coords)), 1200)
        }
      })
      .addTo(m)
    return () => {
      tiles.remove()
    }
  }, [imagery])

  // First view: all the camps, then fly into the storyline camp and light the fields.
  useEffect(() => {
    const m = map.current
    if (!m || !all) return
    m.fitBounds(all, { animate: false, ...clear() })
    warmTiles(data.camps.map(c => c.bounds))
    // Unless someone has already picked a camp: a press never loses to the opening fly-in.
    const t = setTimeout(() => setCamp(c => c ?? heroCamp), 700)
    return () => clearTimeout(t)
    // Once per org: the camps' extents do not move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all === null])

  useEffect(() => {
    const m = map.current
    if (!m) return
    const target = camp ? data.camps.find(c => c.camp === camp) : null
    const bounds = target ? extent(target.bounds) : all
    if (!bounds) return
    wrap.current?.classList.remove('fm-lit')
    m.flyToBounds(bounds, { duration: 0.4, ...clear() })
    m.once('moveend', () => wrap.current?.classList.add('fm-lit'))
  }, [camp, all, data.camps])

  // The fields: a light halo under a state-coloured outline, so they hold on any imagery.
  useEffect(() => {
    const g = layer.current
    if (!g) return
    g.clearLayers()
    // The storyline field last, so no neighbour's halo paints over its outline.
    const isHero = (f: FieldsMap['fields'][number]) => f.contract_id === data.hero_contract_id
    for (const f of [...data.fields].sort((a, b) => Number(isHero(a)) - Number(isHero(b)))) {
      const latlngs = toLatLngs(f.ring)
      L.polygon(latlngs, {
        className: isHero(f) ? 'fm-halo fm-halo-hero' : 'fm-halo',
        interactive: false,
        fill: false,
      }).addTo(g)
      L.polygon(latlngs, {
        className: `fm-field fm-${f.state}${f.contract_id === data.hero_contract_id ? ' fm-hero' : ''}`,
      })
        .bindTooltip(`${f.farmer_name} · ${f.eligibility_label}`, {
          sticky: true,
          className: 'fm-tip',
        })
        .on('click', () => !drawing && openRef.current(f.contract_id))
        .addTo(g)
      // The storyline farmer is named on the map from the first frame.
      if (isHero(f)) {
        // On his own west edge, pointing in: above the field it would sit over a neighbour's.
        const b = L.latLngBounds(latlngs)
        L.tooltip({
          permanent: true,
          direction: 'left',
          offset: [-6, 0],
          className: 'fm-tip fm-tip-hero',
        })
          .setLatLng(L.latLng(b.getCenter().lat, b.getWest()))
          .setContent(f.farmer_name)
          .addTo(g)
      }
    }
    if (!data.precise)
      for (const c of data.camps)
        L.circleMarker(L.latLng(c.center.latitude, c.center.longitude), {
          className: 'fm-camp',
          radius: 18,
        })
          .bindTooltip(`${c.camp}: ${c.contracts} farms, ${c.established} verified`, {
            permanent: true,
            direction: 'top',
            className: 'fm-tip',
          })
          .addTo(g)
  }, [data, drawing])

  // Drawing: a click adds a corner; the first corner or Finish closes the field.
  useEffect(() => {
    const m = map.current
    if (!m || !drawing) return
    m.doubleClickZoom.disable()
    const add = (e: L.LeafletMouseEvent) => setPoints(p => [...p, [e.latlng.lng, e.latlng.lat]])
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && stopDrawing()
    m.on('click', add)
    document.addEventListener('keydown', esc)
    m.getContainer().style.cursor = 'crosshair'
    return () => {
      m.off('click', add)
      document.removeEventListener('keydown', esc)
      m.doubleClickZoom.enable()
      m.getContainer().style.cursor = ''
    }
  }, [drawing])

  useEffect(() => {
    const g = drawLayer.current
    if (!g) return
    g.clearLayers()
    if (points.length === 0) return
    const latlngs = toLatLngs(points)
    if (points.length >= 3) L.polygon(latlngs, { className: 'fm-draft' }).addTo(g)
    else L.polyline(latlngs, { className: 'fm-draft' }).addTo(g)
    points.forEach((p, i) =>
      L.circleMarker(L.latLng(p[1], p[0]), { radius: i === 0 ? 7 : 5, className: 'fm-vertex' })
        .on('click', e => {
          L.DomEvent.stopPropagation(e)
          if (i === 0 && points.length >= 3) finish()
        })
        .addTo(g)
    )
    // finish and stopDrawing only read state through setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points])

  function stopDrawing() {
    setDrawing(false)
    setPoints([])
  }
  function finish() {
    setEnrolling(points)
    setDrawing(false)
  }
  function startDrawing() {
    const target = camp ?? heroCamp
    if (target && target !== camp) setCamp(target)
    setPoints([])
    setDrawing(true)
  }

  const ha = polygonAreaHa(points)
  const shown = camp ? data.fields.filter(f => f.camp === camp) : data.fields
  const counts = STATE_ORDER.map(s => [s, shown.filter(f => f.state === s).length] as const)

  return (
    <section
      aria-labelledby="fields-map"
      className="relative lg:h-[calc(100dvh-3.75rem)] lg:min-h-[36rem] lg:overflow-hidden"
    >
      {intro && (
        <div className="flex flex-col gap-4 px-4 pt-6 md:px-[1.6rem] md:pt-8 lg:island lg:absolute lg:left-[1.6rem] lg:top-[1.35rem] lg:z-[5] lg:flex-row lg:items-center lg:gap-5 lg:py-2 lg:pl-6 lg:pr-2">
          {intro}
        </div>
      )}
      <div className="island mx-4 mt-4 flex flex-col gap-2.5 px-[1.2rem] py-[1rem] md:mx-[1.6rem] lg:absolute lg:left-[1.6rem] lg:top-[5.9rem] lg:z-[5] lg:m-0 lg:max-w-[calc(100%-3.2rem)] lg:px-[1.35rem]">
        <div>
          <h2 id="fields-map" className="serif text-title font-semibold text-fg">
            Fields map
          </h2>
          <p className="text-label text-fg-2">
            {data.precise
              ? fieldCounts(shown)
              : `${data.camps.reduce((n, c) => n + c.contracts, 0)} farms in ${data.camps.length} camps · seen from space, checked on the ground`}
          </p>
        </div>
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          <div className="toggle-group" role="group" aria-label="Camp">
            {[null, ...data.camps.map(c => c.camp)].map(c => (
              <button
                key={c ?? 'all'}
                type="button"
                className="toggle !py-1.5"
                aria-pressed={camp === c}
                onClick={() => setCamp(c)}
              >
                {c ?? 'All camps'}
              </button>
            ))}
          </div>
          {data.precise && !drawing && (
            <button type="button" className="btn-quiet" onClick={startDrawing}>
              <PenLine size={18} aria-hidden />
              Add farm
            </button>
          )}
          <DemoBadge rows={[data]} />
        </div>
      </div>

      <div
        ref={wrap}
        className="fm relative mx-4 mt-4 h-[70dvh] overflow-hidden rounded-island shadow-island-sm md:mx-[1.6rem] lg:absolute lg:inset-0 lg:m-0 lg:h-auto lg:rounded-none lg:shadow-none"
      >
        <div
          ref={el}
          className="absolute inset-0 bg-[var(--canvas-1)]"
          aria-label="Fields over satellite imagery"
          role="region"
        />
        <svg width="0" height="0" className="absolute" aria-hidden>
          <defs>
            <pattern
              id="fm-hatch"
              width="7"
              height="7"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="7" height="7" fill="var(--attention)" />
              <rect width="2.6" height="7" fill="var(--attention-stripe)" />
            </pattern>
          </defs>
        </svg>

        {imagery === 'none' && (
          <p className="island absolute left-3 top-3 z-[500] px-3 py-1.5 text-caption text-fg-2">
            Imagery could not load: fields on the plain map
          </p>
        )}
        {drawing && (
          <div className="island absolute right-14 top-3 z-[500] flex max-w-[20rem] flex-col gap-2 px-4 py-3">
            <p className="text-label font-semibold text-fg">Trace the field&apos;s boundary</p>
            <p className="text-caption text-fg-2">
              Click each corner; the first corner or Finish closes it.
            </p>
            <p className="serif text-[1.6rem] font-semibold tabular-nums text-fg">
              {ha.toFixed(2)}{' '}
              <span className="font-body text-[0.85rem] font-[650] text-fg-2">ha</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary !h-9"
                disabled={points.length < 3}
                onClick={finish}
              >
                <Check size={16} aria-hidden />
                Finish
              </button>
              <button
                type="button"
                className="btn-quiet !h-9"
                disabled={points.length === 0}
                onClick={() => setPoints(p => p.slice(0, -1))}
              >
                <Undo2 size={16} aria-hidden />
                Undo
              </button>
              <button type="button" className="btn-quiet !h-9" onClick={stopDrawing}>
                <X size={16} aria-hidden />
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      <section
        aria-labelledby="fields-key"
        className="island mx-4 mt-3 px-4 pb-3 pt-2.5 text-caption text-fg md:mx-[1.6rem] lg:absolute lg:bottom-[1.6rem] lg:left-[1.6rem] lg:z-[5] lg:m-0 lg:w-[22rem] lg:max-w-[calc(100%-3.2rem)]"
      >
        <h3 id="fields-key" className="mb-1.5 text-[0.95rem] font-bold text-fg">
          Map key
        </h3>
        <ul className="flex flex-col gap-1">
          {counts.map(([state, n]) => (
            <li
              key={state}
              className="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-x-2"
            >
              <span aria-hidden className={`fm-key fm-key-${state}`} />
              {STATE_LABEL[state]}
              {data.precise && <span className="text-right tabular-nums text-fg-2">{n}</span>}
            </li>
          ))}
        </ul>
      </section>
      {enrolling && (
        <EnrolDialog
          orgId={data.org_id}
          camp={camp ?? heroCamp ?? ''}
          ring={enrolling}
          onClose={() => {
            setEnrolling(null)
            setPoints([])
          }}
          onDone={id => {
            setEnrolling(null)
            setPoints([])
            openRef.current(id)
          }}
        />
      )}
    </section>
  )
}

function EnrolDialog({
  orgId,
  camp,
  ring,
  onClose,
  onDone,
}: {
  orgId: string
  camp: string
  ring: Ring
  onClose: () => void
  onDone: (contractId: string) => void
}) {
  const refresh = useSeasonRefresh()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('+26097')
  const [momo, setMomo] = useState<MomoProvider>('airtel')
  const [yieldT, setYieldT] = useState('1.4')
  const [price, setPrice] = useState('8000')
  const [consent, setConsent] = useState(false)
  const enrol = trpc.season.enrolField.useMutation({
    onSuccess: made => {
      void refresh()
      onDone(made.contract_id)
    },
  })
  const ha = Math.round(polygonAreaHa(ring) * 100) / 100
  const value = Math.round(ha * Number(yieldT) * Number(price))
  const valid =
    name.trim().length > 0 &&
    /^\+260\d{9}$/.test(phone) &&
    Number(yieldT) > 0 &&
    Number(price) > 0 &&
    consent
  return (
    <Dialog
      title="Enrol a farm"
      kicker={`${camp} · ${ha.toFixed(2)} ha from the traced outline`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn-primary"
            disabled={!valid || enrol.isPending}
            onClick={() =>
              enrol.mutate({
                orgId,
                camp,
                ring,
                name: name.trim(),
                phone_msisdn: phone,
                momo_provider: momo,
                projected_yield_t_ha: Number(yieldT),
                contract_price_zmw_t: Math.round(Number(price)),
                consent: true,
              })
            }
          >
            {enrol.isPending && <LoaderCircle size={18} aria-hidden className="animate-spin" />}
            Enrol and contract
          </button>
          <button type="button" className="btn-quiet" onClick={onClose}>
            Cancel
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-label font-semibold text-fg sm:col-span-2">
          Farmer&apos;s name
          <input className="field" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </label>
        <label className="flex flex-col gap-1 text-label font-semibold text-fg">
          Phone
          <input
            className="field tabular-nums"
            inputMode="tel"
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
          />
        </label>
        <fieldset>
          <legend className="text-label font-semibold text-fg">Mobile money</legend>
          <div className="toggle-group mt-1" role="group">
            {(['airtel', 'mtn'] as const).map(p => (
              <button
                key={p}
                type="button"
                className="toggle !py-1.5"
                aria-pressed={momo === p}
                onClick={() => setMomo(p)}
              >
                {p === 'airtel' ? 'Airtel Money' : 'MTN MoMo'}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1 text-label font-semibold text-fg">
          Projected yield (t/ha)
          <input
            className="field tabular-nums"
            inputMode="decimal"
            value={yieldT}
            onChange={e => setYieldT(e.target.value.replace(/[^\d.]/g, ''))}
          />
        </label>
        <label className="flex flex-col gap-1 text-label font-semibold text-fg">
          Contract price (ZMW/t)
          <input
            className="field tabular-nums"
            inputMode="numeric"
            value={price}
            onChange={e => setPrice(e.target.value.replace(/[^\d]/g, ''))}
          />
        </label>
      </div>
      <p className="mt-3 text-label text-fg-2">
        Projected value {ha.toFixed(2)} ha × {yieldT} t × ZMW{' '}
        {Number(price).toLocaleString('en-GB')} ={' '}
        <span className="font-semibold text-fg">{zmw(value)}</span>: contract arithmetic, not a
        forecast.
      </p>
      <label className="mt-3 flex items-start gap-2 text-label text-fg">
        <input
          type="checkbox"
          className="mt-1"
          checked={consent}
          onChange={e => setConsent(e.target.checked)}
        />
        The farmer agreed to share this field&apos;s record with this agribusiness (the consent text
        was read out).
      </label>
      {enrol.error && <p className="mt-2 text-label text-high-text">{enrol.error.message}</p>}
    </Dialog>
  )
}
