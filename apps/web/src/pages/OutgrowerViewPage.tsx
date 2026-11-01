import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Loading, SkeletonRows } from '../components/Skeleton'
import { SkeletonStatCards } from '../components/StatCards'
import type { Officer } from '../hooks/useAuth'
import { useRoute, type OutgrowerTab } from '../hooks/useRoute'
import { seasonDate, useSeasonQueries } from '../lib/season'
import { ApprovalsSection } from '../sections/season/ApprovalsSection'
import { DemoControls } from '../sections/season/DemoControls'
import { FieldsMapSection } from '../sections/season/FieldsMapSection'
import { ReconciliationSection } from '../sections/season/ReconciliationSection'
import { PortfolioHeader, SeasonLedgerSection } from '../sections/season/SeasonLedgerSection'

// The simulated agribusiness a Command Center account stands in for (the seed's org).
const SIMULATED_ORG_ID = 'demo-outgrower'

const Muted = ({ children }: { children: React.ReactNode }) => (
  <p className="island px-6 py-5 text-label text-fg-2">{children}</p>
)

// The product: one agribusiness's season on four screens. A Command Center account stands in
// for the credit team of the simulated org; an agribusiness's own accounts see their org.
export function OutgrowerViewPage({
  officer,
  tab: shown,
}: {
  officer: Officer
  // The dev preview names the tab itself (its routes are not the app's).
  tab?: OutgrowerTab
}) {
  const orgId = officer.commandCenter ? SIMULATED_ORG_ID : officer.orgId
  const route = useRoute()
  const tab = shown ?? route.tab
  if (!orgId) return <Muted>This account is not linked to an outgrower.</Muted>
  return <SeasonTabs orgId={orgId} tab={tab} commandCenter={officer.commandCenter} />
}

const TABS: { tab: OutgrowerTab; label: string }[] = [
  { tab: 'fields', label: 'Fields map' },
  { tab: 'season', label: 'Season ledger' },
  { tab: 'approvals', label: 'Approvals' },
  { tab: 'reconciliation', label: 'Reconciliation' },
]

// The four screens. Page tabs take the tint, so the filled green stays the data filter's alone
// (mockup A).
function OutgrowerTabs({ current, waiting }: { current: OutgrowerTab; waiting?: number }) {
  // On a phone the strip scrolls sideways: bring the current tab into it, never cut at the edge.
  const nav = useRef<HTMLElement>(null)
  useEffect(() => {
    const strip = nav.current
    const tab = strip?.querySelector<HTMLElement>('[aria-current="page"]')
    if (strip && tab && strip.scrollWidth > strip.clientWidth)
      strip.scrollLeft = tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2
  }, [current])
  return (
    <nav
      ref={nav}
      className="toggle-group toggle-group-page min-w-0 self-start"
      aria-label="Outgrower View"
    >
      {TABS.map(t => (
        <a
          key={t.label}
          href={`#/outgrower/${t.tab}`}
          className="toggle inline-flex items-center gap-1.5"
          aria-current={t.tab === current ? 'page' : undefined}
          aria-selected={t.tab === current}
          role="tab"
        >
          {t.label}
          {t.tab === 'approvals' && waiting ? (
            <span className="inline-grid h-5 min-w-5 place-items-center rounded-pill bg-chip px-1.5 text-[0.72rem] font-bold text-chip-fg">
              {waiting}
            </span>
          ) : null}
        </a>
      ))}
    </nav>
  )
}

// An org name stored in capitals (the seed's "DEMO OUTGROWER CO.") is set in title case for the
// page title: capitals at display size outweigh everything else on the page. Others as stored.
function orgTitle(name: string) {
  return name === name.toUpperCase()
    ? name
        .toLowerCase()
        .replace(/(^|[\s(])([a-z])/g, (_, gap: string, c: string) => gap + c.toUpperCase())
    : name
}

function SeasonTabs({
  orgId,
  tab,
  commandCenter,
}: {
  orgId: string
  tab: OutgrowerTab
  commandCenter: boolean
}) {
  const { portfolio, approvals, sms } = useSeasonQueries(orgId)
  const p = portfolio.data
  // The tab band paints its canvas only once it is stuck and the page scrolls under it: at rest
  // it is no stripe of its own, just the tabs on the page.
  const band = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)
  const loaded = Boolean(p)
  useEffect(() => {
    const el = band.current
    if (!el) return
    const check = () => {
      const top = parseFloat(getComputedStyle(el).top)
      setStuck(Number.isFinite(top) && el.getBoundingClientRect().top <= top + 1)
    }
    const frame = requestAnimationFrame(check)
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [tab, loaded])
  if (portfolio.error) return <Muted>The season could not load ({portfolio.error.message}).</Muted>
  const title = orgTitle(p?.name ?? 'Season')
  const tabs = (
    <OutgrowerTabs current={tab} waiting={approvals.data?.filter(a => a.otp_ok).length} />
  )
  // The Fields map is the page (mockup A): the map fills the screen under the header, the title
  // and the tabs float on it, and the figures follow below.
  if (tab === 'fields')
    return (
      <div>
        <FieldsMapSection
          orgId={orgId}
          commandCenter={commandCenter}
          seasonLine={
            p
              ? `Season day ${seasonDate(p.today)} · ${p.sim ? 'Simulated season' : 'Season'} ${p.season}`
              : undefined
          }
          intro={
            <>
              <h1
                className="serif relative text-[2.15rem] font-semibold leading-[1.05] tracking-[-0.02em] text-fg md:text-display lg:whitespace-nowrap lg:text-[2.35rem]"
                style={{ fontVariationSettings: '"SOFT" 100, "WONK" 0, "opsz" 96' }}
              >
                {title}
              </h1>
              {tabs}
            </>
          }
        />
        <div className="mx-auto max-w-[1320px] px-4 py-6 md:px-[1.6rem] md:py-8">
          {p ? (
            <PortfolioHeader key={tab} portfolio={p} />
          ) : (
            <Loading label="Building the season">
              <SkeletonStatCards count={6} />
            </Loading>
          )}
        </div>
      </div>
    )
  return (
    <div className="flex flex-col gap-6 pb-16">
      <PageHeader title={title} />
      {/* The tabs stay in reach under the header, on a canvas band so nothing scrolls
          half-visible behind them: no scrolling back up between beats. */}
      {/* DEMO CONTROLS rides at the band's right end: in reach on every beat, over no figure. */}
      <div
        ref={band}
        className={`flex min-w-0 max-w-full flex-wrap items-center gap-3 lg:sticky lg:top-[6.9rem] lg:z-20 lg:-mx-[1.6rem] lg:-my-3 lg:max-w-none lg:flex-nowrap lg:px-[1.6rem] lg:py-3 xl:top-[3.75rem] ${stuck ? 'lg:bg-[rgb(244_243_236/0.94)] lg:backdrop-blur-[2px]' : ''}`}
      >
        {tabs}
        {commandCenter && p?.sim && <DemoControls portfolio={p} />}
      </div>
      {!p ? (
        <Loading label="Building the season">
          <div className="flex flex-col gap-5">
            <SkeletonStatCards count={6} />
            <SkeletonRows rows={8} label="Loading the season ledger" />
          </div>
        </Loading>
      ) : (
        <>
          {/* Keyed by tab: the figures count up again on every cut, as the storyline does. */}
          <PortfolioHeader key={tab} portfolio={p} />
          {tab === 'season' && <SeasonLedgerSection portfolio={p} commandCenter={commandCenter} />}
          {tab === 'approvals' && (
            <ApprovalsSection orgId={orgId} approvals={approvals.data} sms={sms.data} />
          )}
          {tab === 'reconciliation' && <ReconciliationSection portfolio={p} />}
        </>
      )}
    </div>
  )
}
