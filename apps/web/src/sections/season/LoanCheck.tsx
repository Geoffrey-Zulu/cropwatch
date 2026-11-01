import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Banknote, Check, ChevronsRight, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  CROP_LABELS,
  eligibilityLabel,
  establishmentNdvi,
  zmw,
  type EligibilityFactor,
  type FieldCard,
} from '@repo/shared'
import { NdviChart } from '../../components/NdviChart'
import { useCountUp } from '../../hooks/useCountUp'
import { IMAGERY } from '../../lib/imagery'
import { firstName, seasonDate } from '../../lib/season'

// The hunger-month loan check, played rather than shown (Geoffrey, 1 Nov): the farm on real
// imagery, the satellite passes along his curve, the rules one by one, then the cap's arithmetic
// to the verdict. Every figure and every tick is the field card's, which the deterministic rules
// built (packages/shared/src/ceih/eligibility.ts): nothing is computed here, and nothing is a
// score. A click moves to the next stage; Skip goes to the verdict; reduced motion shows it all.

const STAGE_MS = [3400, 3600, 3600] as const
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const cropWord = (crop: FieldCard['crop']) =>
  crop === 'soybean' ? 'soya' : CROP_LABELS[crop].toLowerCase()

// The record's six checks, read as one line once all of them hold.
const RECORD: EligibilityFactor['code'][] = [
  'contract',
  'consent',
  'momo',
  'history',
  'shock',
  'one_advance',
]

interface Rule {
  met: boolean
  text: string
}

// The rules the check walks through, in the order the credit team reads them.
function rulesOf(card: FieldCard): Rule[] {
  const f = card.eligibility.factors
  const verified = card.ground_checks.find(
    g => g.verification === 'FIELD_VERIFIED' || g.verification === 'EXPERT_CONFIRMED'
  )
  const photo = verified ?? card.ground_checks[0]
  const rules: Rule[] = []
  rules.push(
    photo
      ? {
          met: photo.geofence_ok === true,
          text:
            photo.geofence_ok === true
              ? `Photo taken within 150 m of the field, ${seasonDate(photo.at).replace(/ \d{4}$/, '')}`
              : 'Photo taken outside the field: it does not count',
        }
      : card.eligibility.established_by === 'satellite'
        ? { met: true, text: 'No ground photo needed: the passes establish the field' }
        : { met: false, text: 'No photo from within 150 m of the field yet' }
  )
  for (const factor of f.filter(x => x.code === 'established'))
    rules.push({ met: factor.met, text: factor.text })
  const issue = f.find(x => x.code === 'open_issue')
  if (issue) rules.push({ met: issue.met, text: issue.text })
  const record = f.filter(x => RECORD.includes(x.code))
  const failed = record.filter(x => !x.met)
  rules.push(
    failed.length
      ? { met: false, text: failed.map(x => x.text).join('; ') }
      : {
          met: true,
          text: 'Contract, consent, mobile money number, history, camp flag, one advance a season',
        }
  )
  return rules
}

export function LoanCheck({
  card,
  onClose,
  onRequest,
}: {
  card: FieldCard
  onClose: () => void
  // Shown on the verdict when the farmer is eligible and has no advance open.
  onRequest?: () => void
}) {
  // 0 the field, 1 the passes, 2 the rules, 3 the verdict.
  const [stage, setStage] = useState(() => (reduced() ? 3 : 0))
  const next = () => setStage(s => Math.min(3, s + 1))
  useEffect(() => {
    if (stage >= 3) return
    const t = setTimeout(next, STAGE_MS[stage])
    return () => clearTimeout(t)
  }, [stage])
  useEffect(() => {
    const key = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] grid items-start justify-items-center overflow-y-auto bg-[rgb(244_243_236/0.82)] p-3 backdrop-blur-[2px] md:p-6 md:pt-[6vh]"
      onClick={next}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="loan-check"
        className="slide-in island w-full max-w-[74rem] px-[1.4rem] pb-[1.3rem] pt-[1.2rem] md:px-[1.7rem]"
      >
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="meta">
              Hunger-month loan check · {card.camp} · {card.contracted_ha} ha {cropWord(card.crop)}
            </p>
            <h2 id="loan-check" className="serif text-title font-semibold text-fg">
              {card.farmer_name}
            </h2>
          </div>
          {stage < 3 && (
            <button
              type="button"
              className="btn-quiet !h-9"
              onClick={event => {
                event.stopPropagation()
                setStage(3)
              }}
            >
              <ChevronsRight size={16} aria-hidden />
              Skip
            </button>
          )}
          <button
            type="button"
            aria-label="Close"
            onClick={event => {
              event.stopPropagation()
              onClose()
            }}
            className="-mr-2 inline-grid h-10 w-10 shrink-0 place-items-center rounded-pill text-fg-2 transition-colors duration-200 ease-out hover:bg-well hover:text-fg"
          >
            <X aria-hidden />
          </button>
        </header>

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            <Stage n={1} title="The field" active={stage >= 0} space="h-[15rem]">
              <CheckMap card={card} instant={stage > 0} />
            </Stage>
            <Stage n={2} title="The passes" active={stage >= 1} space="h-[11.6rem]">
              <PassesReveal card={card} instant={stage > 1} />
            </Stage>
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <Stage n={3} title="The rules" active={stage >= 2} space="h-[10.5rem]">
              <RulesTick card={card} instant={stage > 2} />
            </Stage>
            <Stage n={4} title="The verdict" active={stage >= 3} space="h-[12rem]">
              {stage >= 3 && (
                <Verdict
                  card={card}
                  onRequest={
                    onRequest
                      ? () => {
                          onClose()
                          onRequest()
                        }
                      : undefined
                  }
                  onClose={onClose}
                />
              )}
            </Stage>
          </div>
        </div>
      </div>
    </div>
  )
}

// A stage keeps its final height from the start, so the dialog never jumps as it fills.
function Stage({
  n,
  title,
  active,
  space,
  children,
}: {
  n: number
  title: string
  active: boolean
  space: string
  children: React.ReactNode
}) {
  return (
    <section
      aria-label={title}
      className={`transition-opacity duration-300 ease-out ${active ? 'opacity-100' : 'opacity-30'}`}
    >
      <h3 className="mb-2 flex items-center gap-2 text-label font-semibold text-fg">
        <span className="grid h-6 w-6 place-items-center rounded-pill bg-signal-tint text-caption font-bold text-signal-text">
          {n}
        </span>
        {title}
      </h3>
      {active ? children : <div className={`${space} rounded-card bg-well`} />}
    </section>
  )
}

// Stage 1: real imagery, a fly from the camp's scale into the farm, then its outline draws.
function CheckMap({ card, instant }: { card: FieldCard; instant: boolean }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  // Lands on the field and draws its outline; animated unless `still`. Runs once.
  const land = useRef<(still: boolean) => void>(() => undefined)
  const ring = card.ring
  useEffect(() => {
    if (!el.current || !ring) return
    const latlngs = ring.map(([lng, lat]) => L.latLng(lat, lng))
    const bounds = L.latLngBounds(latlngs)
    const m = L.map(el.current, {
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      zoomSnap: 0.25,
    })
    m.attributionControl.setPrefix(false)
    L.tileLayer(IMAGERY.esri.url, {
      maxZoom: 19,
      maxNativeZoom: IMAGERY.esri.maxNativeZoom,
      attribution: IMAGERY.esri.attribution,
    }).addTo(m)
    map.current = m
    let done = false
    const draw = (still: boolean) => {
      L.polygon(latlngs, { className: 'lc-halo', interactive: false, fill: false }).addTo(m)
      const field = L.polygon(latlngs, { className: 'lc-field', interactive: false }).addTo(m)
      const path = field.getElement() as SVGPathElement | undefined
      if (!path || still) return
      const length = path.getTotalLength()
      path.style.strokeDasharray = `${length}`
      path.style.strokeDashoffset = `${length}`
      path.style.fillOpacity = '0'
      void path.getBoundingClientRect()
      path.style.transition =
        'stroke-dashoffset 1100ms ease-out, fill-opacity 500ms ease-out 1000ms'
      path.style.strokeDashoffset = '0'
      path.style.fillOpacity = ''
    }
    land.current = still => {
      if (done) return
      done = true
      m.off('moveend')
      m.stop()
      if (still) m.fitBounds(bounds, { padding: [28, 28], animate: false })
      draw(still)
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    if (reduced()) land.current(true)
    else {
      // From the camp's scale into the farm.
      m.fitBounds(bounds.pad(14), { animate: false })
      timer = setTimeout(() => {
        m.once('moveend', () => {
          if (done) return
          done = true
          draw(false)
        })
        m.flyToBounds(bounds, { padding: [28, 28], duration: 1.5 })
      }, 250)
    }
    return () => {
      clearTimeout(timer)
      m.remove()
      map.current = null
    }
  }, [ring])
  // Skipped ahead: the field is in place and drawn at once.
  useEffect(() => {
    if (instant) land.current(true)
  }, [instant])
  if (!ring)
    return (
      <p className="rounded-card bg-well px-4 py-6 text-label text-fg-2">
        The field outline is shown to this agribusiness&apos;s own credit team and field officers.
      </p>
    )
  return (
    <div>
      <div
        ref={el}
        className="lc-map h-[13.5rem] w-full overflow-hidden rounded-card bg-[var(--canvas-2)]"
      />
      <p className="mt-1.5 text-caption text-fg-2">
        {card.contracted_ha} ha traced · a photo within 150 m of it counts as on the field
      </p>
    </div>
  )
}

// Stage 2: the passes arrive one by one along his curve, the clouded ones as gaps.
function PassesReveal({ card, instant }: { card: FieldCard; instant: boolean }) {
  const total = card.curve.length
  const [ticked, setCount] = useState(() => (reduced() ? total : 1))
  // Skipped ahead: every pass at once.
  const count = instant ? total : ticked
  useEffect(() => {
    if (count >= total) return
    const t = setTimeout(() => setCount(c => c + 1), Math.max(120, 2800 / total))
    return () => clearTimeout(t)
  }, [count, total])
  const shown = card.curve.slice(0, Math.max(1, count))
  const clear = shown.filter(p => p.usable).length
  const clouded = shown.length - clear
  return (
    <div>
      <NdviChart
        compact
        height={160}
        curve={shown}
        plantingDate={card.planting_date}
        today={card.today}
        threshold={establishmentNdvi(card.crop)}
        label={`${firstName(card.farmer_name)}'s greenness against the ${card.camp} camp median`}
      />
      <p className="mt-1 text-caption tabular-nums text-fg-2">
        {shown.length} passes · {clear} clear · {clouded} clouded out · against the {card.camp} camp
        median
      </p>
    </div>
  )
}

// Stage 3: the rules tick on one by one, each with its tick or its cross.
function RulesTick({ card, instant }: { card: FieldCard; instant: boolean }) {
  const rules = rulesOf(card)
  const [ticked, setCount] = useState(() => (reduced() ? rules.length : 0))
  const count = instant ? rules.length : ticked
  useEffect(() => {
    if (count >= rules.length) return
    const t = setTimeout(() => setCount(c => c + 1), count === 0 ? 250 : 620)
    return () => clearTimeout(t)
  }, [count, rules.length, instant])
  return (
    <ul className="flex flex-col gap-2">
      {rules.map((r, i) => {
        const Mark = r.met ? Check : X
        return (
          <li
            key={i}
            className={`flex items-start gap-2 text-label leading-[1.4] ${i < count ? 'lc-row' : 'invisible'} ${r.met ? 'text-fg' : 'font-semibold text-fg'}`}
          >
            <span
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-pill ${r.met ? 'bg-signal-tint text-signal' : 'bg-[rgb(162_59_33/0.1)] text-high-text'}`}
            >
              <Mark size={13} strokeWidth={3} aria-hidden />
            </span>
            <span className="sr-only">{r.met ? 'Met: ' : 'Not met: '}</span>
            {r.text}
          </li>
        )
      })}
    </ul>
  )
}

// Stage 4: the cap's arithmetic counts up to the verdict.
function Verdict({
  card,
  onRequest,
  onClose,
}: {
  card: FieldCard
  onRequest?: () => void
  onClose: () => void
}) {
  const e = card.eligibility
  const value = useCountUp(card.projected_value_zmw, 1100, 0)
  const cap = useCountUp(e.cap_zmw, 1100, 0)
  const raw = Math.floor(card.projected_value_zmw * card.credit.cap_pct)
  const held = raw > card.credit.hard_ceiling_zmw
  const open = card.advance && !['declined', 'failed'].includes(card.advance.state)
  return (
    <div className="lc-row rounded-card bg-ground px-4 py-3.5 shadow-[inset_0_0_0_1px_var(--hairline)]">
      <dl className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1.5 text-label">
        <dt className="text-fg-2">
          {card.contracted_ha} ha
          {card.projected_yield_t_ha !== undefined && card.contract_price_zmw_t !== undefined
            ? ` × ${card.projected_yield_t_ha} t/ha × ${zmw(card.contract_price_zmw_t)}/t`
            : ''}{' '}
          projected crop
        </dt>
        <dd className="text-right font-semibold tabular-nums text-fg">{zmw(value)}</dd>
        <dt className="text-fg-2">
          Cap: {Math.round(card.credit.cap_pct * 100)}% of the crop
          {held ? `, held at the ${zmw(card.credit.hard_ceiling_zmw)} ceiling` : ''}
        </dt>
        <dd className="text-right font-semibold tabular-nums text-fg">{zmw(cap)}</dd>
      </dl>
      <div className="mt-3 border-t border-hairline pt-3">
        {e.eligible ? (
          <p className="flex items-baseline gap-2">
            <span className="text-label font-semibold text-signal-text">Eligible</span>
            <span className="serif text-[2rem] font-semibold leading-none tabular-nums text-fg">
              <span className="mr-1 font-body text-[0.85rem] font-[650] text-fg-2">ZMW</span>
              {cap.toLocaleString('en-GB')}
            </span>
          </p>
        ) : (
          <p className="text-[1.15rem] font-semibold text-fg">{eligibilityLabel(e)}</p>
        )}
        <p className="mt-1 text-caption text-fg-2">Rules, not a score: every one is above.</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {e.eligible && !open && onRequest && (
          <button
            type="button"
            className="btn-primary"
            onClick={event => {
              event.stopPropagation()
              onRequest()
            }}
          >
            <Banknote size={18} aria-hidden />
            Request advance for {firstName(card.farmer_name)}
          </button>
        )}
        <button
          type="button"
          className="btn-quiet"
          onClick={event => {
            event.stopPropagation()
            onClose()
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}
