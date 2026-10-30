import { ArrowRight, ChevronDown, CircleCheck, Info, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { RISK_ORDER, type RiskLevel } from '@repo/shared'
import { DemoBadge } from '../components/DemoBadge'
import { FieldMap, type Region } from '../components/FieldMap'
import { Bar, Loading, SkeletonRows } from '../components/Skeleton'
import { useDistricts } from '../components/ZambiaMap'
import { CountUp } from '../hooks/useCountUp'
import type { DashRisk, LiveData } from '../hooks/useLive'
import { useNow } from '../hooks/useNow'
import { useDrawerLinks } from '../hooks/useRoute'
import { ago, compactFactors, LEVEL_TEXT } from '../lib/copy'

const DAY = 86_400_000
const WINDOW_DAYS = 14

const REGIONS: { key: Region; label: string }[] = [
  { key: 'all', label: 'All Zambia' },
  { key: 'lusaka', label: 'Lusaka and Chongwe' },
  { key: 'eastern', label: 'Eastern Province' },
]

const SWATCH: Record<RiskLevel, string> = {
  HIGH: 'swatch-high',
  ELEVATED: 'swatch-elevated',
  LOW: 'swatch-low',
}
const LEVEL_WORD: Record<RiskLevel, string> = {
  HIGH: 'text-high-text',
  ELEVATED: 'text-attention-text',
  LOW: 'text-fg-2',
}
const SERIF_TITLE = { fontVariationSettings: '"SOFT" 100, "WONK" 0, "opsz" 96' }
const SERIF_FIGURE = { fontVariationSettings: '"SOFT" 100, "WONK" 0, "opsz" 72' }

// Below 1024 px the islands stack under the map instead of floating on it.
function useStacked() {
  const query = '(max-width: 1023px)'
  const [stacked, setStacked] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const list = window.matchMedia(query)
    const change = () => setStacked(list.matches)
    list.addEventListener('change', change)
    return () => list.removeEventListener('change', change)
  }, [])
  return stacked
}

// The national map in mockup A's language (Field-airy, the contract): the map is the page and
// everything else floats over it as white islands: the title and region toggle, the figures, the
// districts to watch, the map key. Pressing a district flies to it, outlines it and slides its
// panel in; a district that shares a risk unit says so. On phones the map leads and the islands
// stack below it as cards. Alerts live behind the header bell; detail opens in drawers.
export function NationalMapPage({
  observations,
  clusters,
  risk,
  verified = null,
}: LiveData & { verified?: number | null }) {
  const { open } = useDrawerLinks()
  const stacked = useStacked()
  const districts = useDistricts()
  const [region, setRegion] = useState<Region>('all')
  const [focus, setFocus] = useState<string | null>(null)
  // The district row that is open; until someone chooses, the first district to watch is.
  const [chosenRow, setOpenRow] = useState<string | null | undefined>(undefined)
  const [card, setCard] = useState<{ slug: string; name: string } | null>(null)
  const [hoverRow, setHoverRow] = useState<string | null>(null)
  const [keyOpen, setKeyOpen] = useState(true)
  const [revealRow, setRevealRow] = useState<string | null>(null)

  const intro = useRef<HTMLDivElement>(null)
  const figures = useRef<HTMLElement>(null)
  const watchPanel = useRef<HTMLElement>(null)
  const legend = useRef<HTMLElement>(null)
  const demo = useRef<HTMLDivElement>(null)
  const credit = useRef<HTMLParagraphElement>(null)

  const now = useNow()
  const recent = useMemo(() => {
    const since = now - WINDOW_DAYS * DAY
    return (observations ?? []).filter(o => Date.parse(o.createdAt) > since)
  }, [observations, now])
  const levels = useMemo(() => new Map((risk ?? []).map(r => [r.districtSlug, r.level])), [risk])
  const riskBySlug = useMemo(() => new Map((risk ?? []).map(r => [r.districtSlug, r])), [risk])
  const watch = useMemo(
    () =>
      (risk ?? [])
        .filter(r => r.level !== 'LOW')
        .sort(
          (a, b) =>
            RISK_ORDER.indexOf(b.level) - RISK_ORDER.indexOf(a.level) ||
            a.district.localeCompare(b.district)
        ),
    [risk]
  )
  const openRow = chosenRow === undefined ? (watch[0]?.districtSlug ?? null) : chosenRow

  const weekAgo = now - 7 * DAY
  const thisWeek = recent.filter(o => Date.parse(o.createdAt) > weekAgo).length
  const lastWeek = recent.length - thisWeek
  const awaiting = recent.filter(o => o.status === 'awaiting_expert_review')
  const daily = useMemo(
    () =>
      Array.from({ length: WINDOW_DAYS }, (_, i) => {
        const end = now - (WINDOW_DAYS - 1 - i) * DAY
        return recent.filter(o => {
          const t = Date.parse(o.createdAt)
          return t > end - DAY && t <= end
        }).length
      }),
    [recent, now]
  )
  const shown = [...recent, ...(clusters ?? []), ...(risk ?? [])]
  const allSim = recent.length > 0 && recent.every(o => o.sim)

  const pressDistrict = useCallback(
    (slug: string, name: string) => {
      const again = card?.slug === slug && card.name === name
      setCard(again ? null : { slug, name })
      setFocus(again ? null : slug)
      const level = riskBySlug.get(slug)?.level
      if (!again && level && level !== 'LOW') {
        setOpenRow(slug)
        setRevealRow(slug)
      }
    },
    [riskBySlug, card]
  )
  const clearFocus = useCallback(() => {
    setFocus(null)
    setCard(null)
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !window.location.hash.includes('?')) clearFocus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [clearFocus])

  const selected = card?.slug ?? openRow
  const partOf = card
    ? (districts?.features.find(f => f.properties.name === card.name)?.properties.part_of ?? null)
    : null

  const map = (
    <FieldMap
      levels={levels}
      watched={watch.map(w => ({ slug: w.districtSlug, district: w.district }))}
      points={recent.map(o => ({ id: o.id, location: o.location, sim: o.sim }))}
      clusters={(clusters ?? []).map(c => ({
        id: c.id,
        center: c.center,
        size: c.size,
        verified: c.verifiedMembers,
        issue: c.issue,
        district: c.district,
        sim: c.sim,
      }))}
      region={region}
      focus={focus}
      selected={selected}
      highlight={hoverRow}
      onDistrict={pressDistrict}
      onCluster={id => (window.location.hash = open({ kind: 'outbreak', id }))}
      avoid={[intro, figures, legend, demo]}
      rightEdge={watchPanel}
      bottomEdge={credit}
      stacked={stacked}
    />
  )

  const toggle = (
    <div
      className={`toggle-group ${stacked ? '!flex w-full !flex-nowrap' : ''}`}
      role="group"
      aria-label="Region"
    >
      {REGIONS.map(r => (
        <button
          key={r.key}
          type="button"
          aria-pressed={region === r.key}
          onClick={() => {
            setRegion(r.key)
            clearFocus()
          }}
          className={`toggle ${stacked ? 'flex-auto !px-[0.4rem] !py-[0.7rem] text-center !text-[0.86rem]' : ''}`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )

  const figuresIsland = (
    <section
      ref={figures}
      aria-label="Key figures"
      className="island px-[1.45rem] py-[0.35rem] lg:absolute lg:left-[1.6rem] lg:top-[7.5rem] lg:z-[5] lg:w-[19rem]"
    >
      {observations && clusters && risk ? (
        <>
          <Ledger
            value={thisWeek}
            label="Reports this week"
            sub={`${thisWeek >= lastWeek ? '↑' : '↓'} ${Math.abs(thisWeek - lastWeek)} ${
              thisWeek >= lastWeek ? 'more' : 'fewer'
            } than last week (${lastWeek})`}
          >
            <Spark days={daily} />
          </Ledger>
          <Ledger
            value={clusters.length}
            label="Active clusters"
            sub={`${clusters.filter(c => Date.parse(c.firstDetectedAt) > weekAgo).length} new this week`}
          />
          <Ledger
            value={risk.filter(r => r.level === 'HIGH').length}
            label={
              <>
                Areas at <LevelWord level="HIGH" />
              </>
            }
          />
          <Ledger
            value={risk.filter(r => r.level === 'ELEVATED').length}
            label={
              <>
                Areas at <LevelWord level="ELEVATED" />
              </>
            }
          />
          <Ledger
            value={awaiting.length}
            label="Waiting for an officer"
            sub={`${awaiting.filter(o => Date.parse(o.createdAt) > weekAgo).length} new this week`}
          />
        </>
      ) : (
        <Loading label="Loading figures">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="grid grid-cols-[3.6rem_1fr] items-center gap-x-4 py-[0.72rem]">
              <Bar className="ml-auto h-8 w-10" />
              <Bar className="h-4 w-3/4" />
            </div>
          ))}
        </Loading>
      )}
    </section>
  )

  const watchIsland = (
    <aside
      ref={watchPanel}
      aria-label="Districts to watch"
      className="island flex flex-col overflow-hidden pt-[1.55rem] lg:absolute lg:bottom-[1.6rem] lg:right-[1.6rem] lg:top-[1.6rem] lg:z-[6] lg:w-[25rem]"
    >
      <div className="px-[1.65rem] pb-4">
        <h2 className="serif text-title font-semibold">Districts to watch</h2>
        <p className="mt-[0.55rem] flex items-start gap-2 text-[0.95rem] leading-[1.35] text-fg-2">
          <Info aria-hidden className="mt-[0.12rem] h-[1.05rem] w-[1.05rem] shrink-0 text-fg-3" />
          Risk signal from reports, not a forecast.
        </p>
      </div>
      {card && (
        <DistrictCard
          name={card.name}
          partOf={partOf}
          risk={riskBySlug.get(card.slug) ?? null}
          onClose={clearFocus}
        />
      )}
      <ol className="flex-1 overflow-auto px-3 pb-2 [scrollbar-width:thin]">
        {risk === null && <SkeletonRows rows={6} label="Loading districts" />}
        {risk && watch.length === 0 && (
          <li className="px-4 py-4 text-label text-fg-2">No district is above Low.</li>
        )}
        {watch.map((r, i) => (
          <WatchRow
            key={r.districtSlug}
            risk={r}
            open={openRow === r.districtSlug}
            reveal={revealRow === r.districtSlug}
            divided={i > 0}
            onToggle={() => {
              setOpenRow(openRow === r.districtSlug ? null : r.districtSlug)
              clearFocus()
            }}
            onHover={h => setHoverRow(h ? r.districtSlug : null)}
          />
        ))}
      </ol>
      <div className="flex items-center justify-between px-[1.65rem] pb-[1.1rem] pt-[0.95rem] text-[0.86rem] text-fg-2 shadow-[0_-1px_0_var(--hairline)]">
        <span>{watch[0] ? `Signals updated ${ago(watch[0].computedAt, now)}` : ''}</span>
        <a
          href="#/queue"
          className="inline-flex items-center gap-[0.3rem] font-[650] text-signal-text"
        >
          Officer queue <ArrowRight aria-hidden className="h-[0.9rem] w-[0.9rem]" />
        </a>
      </div>
    </aside>
  )

  const legendIsland = (
    <section
      ref={legend}
      aria-label="Map key"
      className="island px-[1.1rem] pb-4 pt-[0.95rem] lg:absolute lg:bottom-[1.6rem] lg:right-[calc(25rem+3.2rem)] lg:z-[5] lg:w-[15.2rem]"
    >
      <div className={`flex items-center justify-between ${keyOpen ? 'mb-[0.6rem]' : ''}`}>
        <h3 className="text-[0.95rem] font-bold">Map key</h3>
        <button
          type="button"
          aria-expanded={keyOpen}
          onClick={() => setKeyOpen(o => !o)}
          className="-mr-2 inline-flex items-center gap-1 rounded-pill px-2 py-1 text-[0.82rem] text-fg-2 hover:bg-well hover:text-fg"
        >
          {keyOpen ? 'Hide' : 'Show'}
          <ChevronDown
            aria-hidden
            className={`h-[0.85rem] w-[0.85rem] transition-transform duration-200 ease-out ${keyOpen ? '' : 'rotate-180'}`}
          />
        </button>
      </div>
      {keyOpen && (
        <>
          <ul className="mb-[0.65rem] flex gap-[0.8rem] pb-[0.7rem] shadow-[0_1px_0_var(--hairline)]">
            {(['HIGH', 'ELEVATED', 'LOW'] as const).map(l => (
              <li
                key={l}
                className="inline-flex items-center gap-[0.38rem] text-[0.86rem] font-[650]"
              >
                <span aria-hidden className={`swatch !h-[0.95rem] !w-[1.15rem] ${SWATCH[l]}`} />
                {LEVEL_TEXT[l]}
              </li>
            ))}
          </ul>
          <ul className="grid gap-[0.35rem]">
            <KeyRow
              mark={
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                  <circle cx="7" cy="7" r="4" fill="#1B2920" stroke="#fff" strokeWidth="1.4" />
                </svg>
              }
            >
              Report {allSim && <span className="text-fg-2">· simulated</span>}
            </KeyRow>
            <KeyRow
              mark={
                <svg width="30" height="24" viewBox="0 0 30 24" aria-hidden>
                  <circle cx="11" cy="13" r="9" fill="none" stroke="#1B2920" strokeWidth="1.9" />
                  <rect
                    x="15"
                    y="1"
                    width="14"
                    height="11"
                    rx="5.5"
                    fill="#fff"
                    stroke="#D5DBD1"
                    strokeWidth=".8"
                  />
                  <text
                    x="22"
                    y="9.6"
                    textAnchor="middle"
                    fontSize="8.5"
                    fontWeight="750"
                    fill="#1B2920"
                    className="font-body"
                  >
                    9
                  </text>
                </svg>
              }
            >
              Cluster <span className="text-fg-2">· within 10 km</span>
            </KeyRow>
            <KeyRow
              mark={
                <svg width="30" height="24" viewBox="0 0 30 24" aria-hidden>
                  <circle
                    cx="11"
                    cy="13"
                    r="9"
                    fill="none"
                    stroke="#1B2920"
                    strokeWidth="1.9"
                    strokeDasharray="3.4 2.4"
                  />
                </svg>
              }
            >
              Dashed <span className="text-fg-2">· none verified yet</span>
            </KeyRow>
          </ul>
        </>
      )}
    </section>
  )

  const creditLine = (
    <p
      ref={credit}
      className="text-[0.72rem] leading-[1.4] text-fg-2 lg:absolute lg:bottom-[1.5rem] lg:left-[calc(1.6rem+3.1rem+1rem)] lg:z-[5] lg:whitespace-nowrap"
    >
      Boundaries: geoBoundaries, GRID3 and Office of the Surveyor General (CC BY 4.0)
    </p>
  )

  const demoPill = (
    <div
      ref={demo}
      className="absolute z-[5] max-lg:left-3 max-lg:top-3 lg:right-[calc(25rem+3.2rem)] lg:top-[1.36rem]"
    >
      <DemoBadge rows={shown} />
    </div>
  )

  if (stacked) {
    return (
      <div className="flex flex-col pb-8">
        <div className="px-4 pt-[1.35rem]">
          <h1
            className="serif text-[2.15rem] font-semibold leading-[1.05] tracking-[-0.02em]"
            style={SERIF_TITLE}
          >
            National map
          </h1>
          {verified !== null && (
            <p className="mt-[0.55rem] flex items-center gap-[0.45rem] text-[0.92rem] text-fg-2">
              <CircleCheck aria-hidden className="h-[1.1rem] w-[1.1rem] text-signal" />
              <span>
                <b className="font-bold text-fg">
                  <CountUp value={verified} />
                </b>{' '}
                verified observations
              </span>
            </p>
          )}
        </div>
        <div className="canvas relative mt-4 h-[21rem]">
          {map}
          {demoPill}
        </div>
        <div className="overflow-x-auto px-4 pt-[0.85rem] [scrollbar-width:none]">{toggle}</div>
        <div className="mx-4 mt-4">{figuresIsland}</div>
        <div className="mx-4 mt-4">{watchIsland}</div>
        <div className="mx-4 mt-4">{legendIsland}</div>
        <div className="px-5 pt-4">{creditLine}</div>
      </div>
    )
  }

  return (
    <div className="relative h-[calc(100dvh-3.75rem)] min-h-[36rem] overflow-hidden">
      {map}
      <div
        ref={intro}
        className="absolute left-[1.6rem] top-[1.35rem] z-[5] flex items-center gap-6"
      >
        <h1 className="serif whitespace-nowrap text-display font-semibold" style={SERIF_TITLE}>
          National map
        </h1>
        {toggle}
      </div>
      {demoPill}
      {figuresIsland}
      {watchIsland}
      {legendIsland}
      {creditLine}
    </div>
  )
}

function Ledger({
  value,
  label,
  sub,
  children,
}: {
  value: number
  label: ReactNode
  sub?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="grid grid-cols-[3.6rem_1fr] items-center gap-x-4 py-[0.72rem] [&+&]:shadow-[0_-1px_0_var(--hairline)]">
      <div className="serif text-right text-stat font-semibold tabular-nums" style={SERIF_FIGURE}>
        <CountUp value={value} />
      </div>
      <div>
        <div className="text-[0.93rem] font-semibold leading-[1.3]">{label}</div>
        {sub && <div className="mt-[0.12rem] text-[0.84rem] leading-[1.3] text-fg-2">{sub}</div>}
      </div>
      {children}
    </div>
  )
}

// 14 days of reports: last week pale, this week in field green.
function Spark({ days }: { days: number[] }) {
  const n = days.length
  const w = 114
  const h = 22
  const gap = 2.4
  const bw = (w - gap * (n - 1)) / n
  const max = Math.max(1, ...days)
  const sum = (a: number[]) => a.reduce((t, d) => t + d, 0)
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Reports per day over 14 days: last week ${sum(days.slice(0, n - 7))}, this week ${sum(days.slice(n - 7))}`}
      className="col-start-2 mt-2 block h-[1.35rem] w-full max-w-[8.4rem] overflow-visible"
    >
      {days.map((d, i) => {
        const bh = Math.max(2, (d / max) * h)
        return (
          <rect
            key={i}
            x={i * (bw + gap)}
            y={h - bh}
            width={bw}
            height={bh}
            rx={1.4}
            fill={i >= n - 7 ? '#2D5B39' : '#CCD7C0'}
          />
        )
      })}
    </svg>
  )
}

function LevelWord({ level }: { level: RiskLevel }) {
  return (
    <span
      className={`inline-flex items-center gap-[0.35rem] whitespace-nowrap font-[650] ${LEVEL_WORD[level]}`}
    >
      <span aria-hidden className={`swatch ml-[0.15rem] ${SWATCH[level]}`} />
      {LEVEL_TEXT[level]}
    </span>
  )
}

function KeyRow({ mark, children }: { mark: ReactNode; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[1.5rem_1fr] items-center gap-x-2 text-[0.86rem] leading-[1.3]">
      <span className="grid place-items-center">{mark}</span>
      <span>{children}</span>
    </li>
  )
}

function WatchRow({
  risk: r,
  open,
  reveal,
  divided,
  onToggle,
  onHover,
}: {
  risk: DashRisk
  open: boolean
  reveal: boolean
  divided: boolean
  onToggle: () => void
  onHover: (on: boolean) => void
}) {
  const row = useRef<HTMLLIElement>(null)
  // Pressed on the map: bring the row into view inside the list (never scroll the page).
  useEffect(() => {
    const el = row.current
    const list = el?.parentElement
    if (!reveal || !el || !list || list.scrollHeight <= list.clientHeight) return
    const top = el.offsetTop - list.offsetTop
    if (top < list.scrollTop || top + el.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' })
  }, [reveal])
  return (
    <li
      ref={row}
      className={`relative rounded-card transition-colors duration-200 ease-out ${open ? 'bg-signal-tint' : 'hover:bg-well'} ${
        divided && !open
          ? "before:absolute before:left-[2.8rem] before:right-[0.9rem] before:top-0 before:h-px before:bg-hairline before:content-['']"
          : ''
      }`}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="grid w-full grid-cols-[1.1rem_1fr_auto] gap-x-[0.8rem] px-[0.9rem] pb-[0.82rem] pt-[0.78rem] text-left"
      >
        <span aria-hidden className={`swatch mt-[0.32rem] ${SWATCH[r.level]}`} />
        <span className="text-section font-[650]">{r.district}</span>
        <span
          className={`inline-flex items-center gap-[0.3rem] whitespace-nowrap text-[0.92rem] font-[650] leading-[1.55rem] ${LEVEL_WORD[r.level]}`}
        >
          {LEVEL_TEXT[r.level]}
          <ChevronDown
            aria-hidden
            className={`h-[0.95rem] w-[0.95rem] transition-transform duration-200 ease-out ${open ? 'rotate-180 text-signal' : 'text-fg-3'}`}
          />
        </span>
        {open ? (
          <ul className="col-span-2 col-start-2 mb-[0.1rem] mt-[0.55rem] flex flex-col gap-[0.4rem]">
            {r.factors.map(f => (
              <li
                key={f}
                className="relative pl-4 text-[0.93rem] leading-[1.4] text-fg before:absolute before:left-0 before:top-2 before:h-[0.36rem] before:w-[0.36rem] before:rounded-full before:bg-signal before:content-['']"
              >
                {f}
              </li>
            ))}
          </ul>
        ) : (
          <span className="col-span-2 col-start-2 mt-[0.1rem] text-[0.93rem] leading-[1.4] text-fg-2 [text-wrap:balance]">
            {compactFactors(r.factors)
              .split(' · ')
              .map(t => t.replace(/ /g, ' '))
              .join(' · ')}
          </span>
        )}
      </button>
    </li>
  )
}

// The panel of a pressed district, sliding in above the list: its level and factors, the risk
// unit it shares, or that it has no signal.
function DistrictCard({
  name,
  partOf,
  risk: r,
  onClose,
}: {
  name: string
  partOf: string | null
  risk: DashRisk | null
  onClose: () => void
}) {
  const level = r?.level ?? 'LOW'
  return (
    <section
      key={name}
      aria-label={`District: ${name}`}
      className="slide-in mx-3 mb-3 rounded-card bg-well px-[0.9rem] py-3"
    >
      <div className="grid grid-cols-[1.1rem_1fr_auto] items-start gap-x-[0.8rem]">
        <span aria-hidden className={`swatch mt-[0.32rem] ${SWATCH[level]}`} />
        <span className="text-section font-[650]">{name}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${name}`}
          className="-mr-1 -mt-0.5 grid h-8 w-8 place-items-center rounded-pill text-fg-2 hover:bg-panel hover:text-fg"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
        <div className="col-span-2 col-start-2 text-[0.93rem] leading-[1.4]">
          <p className={`font-[650] ${LEVEL_WORD[level]}`}>{LEVEL_TEXT[level]}</p>
          {partOf && <p className="text-fg-2">Shares its risk signal with {partOf}</p>}
          <p className="mt-[0.2rem] text-fg-2">
            {r ? compactFactors(r.factors) : 'No reports in the last 14 days.'}
          </p>
        </div>
      </div>
    </section>
  )
}
