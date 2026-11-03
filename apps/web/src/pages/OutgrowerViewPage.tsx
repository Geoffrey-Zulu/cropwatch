import { useEffect, useLayoutEffect } from 'react'
import type { Portfolio } from '@repo/shared'
import { Loading, SkeletonRows } from '../components/Skeleton'
import { SkeletonStatCards } from '../components/StatCards'
import type { Officer } from '../hooks/useAuth'
import { useRoute, type OutgrowerTab } from '../hooks/useRoute'
import { seasonDate, useSeasonQueries } from '../lib/season'
import { DemoControls } from '../sections/season/DemoControls'
import { FieldsMapSection } from '../sections/season/FieldsMapSection'
import { ReconciliationSection } from '../sections/season/ReconciliationSection'
import { PHASE, PortfolioHeader, SeasonLedgerSection } from '../sections/season/SeasonLedgerSection'

// The simulated agribusiness a Command Center account stands in for (the seed's org).
const SIMULATED_ORG_ID = 'demo-outgrower'

// The org this account works on: a Command Center account stands in for the credit team of the
// simulated org; an agribusiness's own accounts see their org.
export const orgIdFor = (officer: Officer) =>
  officer.commandCenter ? SIMULATED_ORG_ID : officer.orgId

const Muted = ({ children }: { children: React.ReactNode }) => (
  <p className="island px-6 py-5 text-label text-fg-2">{children}</p>
)

const TABS: { tab: OutgrowerTab; label: string }[] = [
  { tab: 'fields', label: 'Fields map' },
  { tab: 'season', label: 'Season ledger' },
  { tab: 'reconciliation', label: 'Reconciliation' },
]

// The three screens, as the header's pills (AppShell renders them in the header and, on a phone,
// in a strip under it). Advances need no approval queue: within the cap, the season's rules send
// them (CLAUDE.md invariant 11, 1 Nov).
export function SeasonNav({ current }: { current: OutgrowerTab }) {
  // On a phone the strip scrolls sideways: bring the current screen to its middle, never cut it
  // off. Measured from the boxes, again once the fonts have settled the widths.
  useEffect(() => {
    const centre = () => {
      for (const strip of document.querySelectorAll<HTMLElement>('[data-screens-strip]')) {
        const tab = strip.querySelector<HTMLElement>('[aria-current="page"]')
        if (!tab) continue
        const s = strip.getBoundingClientRect()
        const t = tab.getBoundingClientRect()
        strip.scrollLeft += t.left + t.width / 2 - (s.left + s.width / 2)
      }
    }
    centre()
    void document.fonts?.ready.then(centre)
    const t = setTimeout(centre, 600)
    return () => clearTimeout(t)
  }, [current])
  return (
    <>
      {TABS.map(t => {
        const on = t.tab === current
        return (
          <a
            key={t.tab}
            href={`#/outgrower/${t.tab}`}
            aria-current={on ? 'page' : undefined}
            className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-pill px-[0.85rem] py-2 text-[0.95rem] transition-colors duration-200 ease-out ${
              on
                ? 'bg-signal-tint font-semibold text-signal-text'
                : 'font-medium text-fg-2 hover:bg-well hover:text-fg'
            }`}
          >
            {t.label}
          </a>
        )
      })}
    </>
  )
}

// The presenter's season controls: the gear in the header, before the avatar, on every screen.
export function SeasonGear({ orgId, commandCenter }: { orgId: string; commandCenter: boolean }) {
  const { portfolio } = useSeasonQueries(orgId)
  const p = portfolio.data
  return commandCenter && p?.sim ? <DemoControls portfolio={p} /> : null
}

export function OutgrowerViewPage({
  officer,
  tab: shown,
}: {
  officer: Officer
  // The dev preview names the tab itself (its routes are not the app's).
  tab?: OutgrowerTab
}) {
  const orgId = orgIdFor(officer)
  const route = useRoute()
  const tab = shown ?? route.tab
  if (!orgId) return <Muted>This account is not linked to an outgrower.</Muted>
  return <SeasonTabs orgId={orgId} tab={tab} commandCenter={officer.commandCenter} />
}

// An org name stored in capitals is set in title case for the page title: capitals at display
// size outweigh everything else on the page. Others as stored.
function orgTitle(name: string) {
  return name === name.toUpperCase()
    ? name
        .toLowerCase()
        .replace(/(^|[\s(])([a-z])/g, (_, gap: string, c: string) => gap + c.toUpperCase())
    : name
}

// The org's name and, beside it (under it on a phone), the season line: the season, its day and
// its phase, with no "Simulated" (Geoffrey, 1 Nov afternoon; CLAUDE.md invariant 5). The Fields
// map, the first page, carries the name alone.
function OrgHeading({
  portfolio: p,
  seasonLine = true,
}: {
  portfolio: Portfolio | undefined
  seasonLine?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-0.5">
      <h1
        className="serif text-[1.6rem] font-semibold leading-[1.1] tracking-[-0.015em] text-fg md:text-[1.85rem]"
        style={{ fontVariationSettings: '"SOFT" 100, "WONK" 0, "opsz" 96' }}
      >
        {orgTitle(p?.name ?? 'Season')}
      </h1>
      {p && seasonLine && (
        <p className="text-caption text-fg-2">
          Season {p.season} · Season day{' '}
          <span className="font-semibold text-fg">{seasonDate(p.today)}</span> · {PHASE[p.phase]}
        </p>
      )}
    </div>
  )
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
  const { portfolio } = useSeasonQueries(orgId)
  const p = portfolio.data
  // A new screen opens at its top. A layout effect runs before the screens' own scroll-into-view
  // effects (an opened ledger row, the statement), so those still land where they should.
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])
  if (portfolio.error) return <Muted>The season could not load ({portfolio.error.message}).</Muted>
  // The Fields map is the page (mockup A): the map fills the screen under the header, the org's
  // name floats on it, and the figures follow below.
  if (tab === 'fields')
    return (
      <div>
        <FieldsMapSection
          orgId={orgId}
          commandCenter={commandCenter}
          intro={<OrgHeading portfolio={p} seasonLine={false} />}
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
    <div className="flex flex-col gap-6">
      <OrgHeading portfolio={p} />
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
          {tab === 'reconciliation' && (
            <ReconciliationSection portfolio={p} commandCenter={commandCenter} />
          )}
        </>
      )}
    </div>
  )
}
