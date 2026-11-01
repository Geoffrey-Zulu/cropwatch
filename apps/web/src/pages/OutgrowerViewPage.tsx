import { ChevronRight, ListChecks, Lock } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CROP_LABELS,
  findDistrict,
  type OutgrowerOverview,
  type RiskLevel,
  type Visit,
  type VisitReason,
} from '@repo/shared'
import { DemoBadge } from '../components/DemoBadge'
import { Drawer } from '../components/Drawer'
import { LevelDot } from '../components/LevelTag'
import { PageHeader } from '../components/PageHeader'
import { Muted } from '../components/Panel'
import { Bar, Loading, SkeletonRows } from '../components/Skeleton'
import { SkeletonStatCards, StatCards, weekDelta } from '../components/StatCards'
import { ZambiaMap } from '../components/ZambiaMap'
import type { Officer } from '../hooks/useAuth'
import { useDrawerLinks, useRoute, type OutgrowerTab } from '../hooks/useRoute'
import { useSeasonQueries } from '../lib/season'
import { ApprovalsSection } from '../sections/season/ApprovalsSection'
import { DemoControls } from '../sections/season/DemoControls'
import { FieldsMapSection } from '../sections/season/FieldsMapSection'
import { ReconciliationSection } from '../sections/season/ReconciliationSection'
import { PortfolioHeader, SeasonLedgerSection } from '../sections/season/SeasonLedgerSection'
import { ago, dateTime, SEVERITY_TEXT, VERIFICATION_TEXT } from '../lib/copy'
import { trpc } from '../lib/trpc'

// The seeded outgrower (tools/seed): the org a Command Center officer sees here.
const DEMO_ORG_ID = 'demo-outgrower'

const PRIORITY = {
  1: { label: 'Visit first', className: 'border-signal-text text-signal-text' },
  2: { label: 'This week', className: 'border-fg-2 text-fg' },
  3: { label: 'When nearby', className: 'border-hairline-strong text-fg-2' },
} as const

// The one reason a row shows, in this order; the drawer shows them all.
const REASON_ORDER: VisitReason[] = [
  'cluster',
  'severe',
  'awaiting_review',
  'high_district',
  'moderate',
]
const REASON_PHRASE: Record<VisitReason, string> = {
  cluster: 'In a cluster',
  severe: 'Severe damage',
  awaiting_review: 'Awaiting review',
  high_district: 'District at High',
  moderate: 'Moderate damage',
}
const topReason = (v: Visit) => {
  const code = REASON_ORDER.find(c => v.reason_codes?.includes(c))
  return code ? REASON_PHRASE[code] : v.reasons[0]
}

// Rows an officer column shows before "more".
const FIRST = 5
// Camps shown on first paint, before "Show all".
const CAMPS_FIRST = 5

interface OfficerList {
  key: string
  title: string
  district: string
  visits: Visit[]
}

// Outgrower View: which farms each field officer should visit first. Camp and district level
// only: no farm locations (CLAUDE.md invariant 6). The first paint is never empty: the top camps
// and one line a field officer show on load; "Prioritise" opens the full ranked lists. Why a
// farm is on a list, its history and where its district is open in a drawer (patterns-v2.md).
export function OutgrowerViewPage({
  officer,
  tab: shown,
}: {
  officer: Officer
  // The dev preview names the tab itself (its routes are not the app's).
  tab?: OutgrowerTab
}) {
  const orgId = officer.commandCenter ? DEMO_ORG_ID : officer.orgId
  const route = useRoute()
  const tab = shown ?? (route.page === 'outgrower' ? route.tab : undefined)
  if (!orgId) return <Muted>This account is not linked to an outgrower.</Muted>
  if (tab) return <SeasonTabs orgId={orgId} tab={tab} commandCenter={officer.commandCenter} />
  return <FieldVisits orgId={orgId} />
}

function FieldVisits({ orgId }: { orgId: string }) {
  const overview = trpc.outgrower.overview.useQuery({ orgId }, { refetchInterval: 60_000 })
  if (overview.error) return <Muted>The view could not be built ({overview.error.message}).</Muted>
  if (!overview.data) return <OverviewSkeleton />
  return <Overview data={overview.data} />
}

const TABS: { tab: OutgrowerTab | null; label: string }[] = [
  { tab: null, label: 'Field visits' },
  { tab: 'fields', label: 'Fields map' },
  { tab: 'season', label: 'Season ledger' },
  { tab: 'approvals', label: 'Approvals' },
  { tab: 'reconciliation', label: 'Reconciliation' },
]

// The Outgrower View's tabs (CEIH, plan §3). The season's three sit under its portfolio.
// Page tabs take the tint, so the filled green stays the data filter's alone (mockup A).
function OutgrowerTabs({ current, waiting }: { current: OutgrowerTab | null; waiting?: number }) {
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
      className="toggle-group toggle-group-page self-start"
      aria-label="Outgrower View"
    >
      {TABS.map(t => (
        <a
          key={t.label}
          href={t.tab ? `#/outgrower/${t.tab}` : '#/outgrower'}
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
      <div className="flex min-w-0 max-w-full lg:sticky lg:top-[6.9rem] lg:max-w-none lg:z-20 lg:-mx-[1.6rem] lg:-my-3 lg:bg-[rgb(244_243_236/0.94)] lg:px-[1.6rem] lg:py-3 lg:backdrop-blur-[2px] xl:top-[3.75rem]">
        {tabs}
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
          {/* Not on the Fields map, which has its own page above: the pill would cover the
              imagery credit. */}
          {commandCenter && p.sim && <DemoControls portfolio={p} />}
        </>
      )}
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <Loading label="Building the Outgrower View">
      <div className="flex flex-col gap-5">
        <Bar className="h-8 w-72" />
        <SkeletonStatCards />
        <SkeletonRows rows={CAMPS_FIRST} label="Loading the camps" />
        <SkeletonRows rows={6} label="Loading the visit lists" />
      </div>
    </Loading>
  )
}

function Overview({ data }: { data: OutgrowerOverview }) {
  const [prioritised, setPrioritised] = useState(false)
  const { route, close } = useDrawerLinks()
  const lists: OfficerList[] = useMemo(
    () => [
      ...data.officers.map(o => ({
        key: o.officer_id,
        title: o.label,
        district: o.district,
        visits: o.visits,
      })),
      ...(data.unassigned.length
        ? [
            {
              key: 'unassigned',
              title: 'No field officer in district',
              district: 'Unassigned',
              visits: data.unassigned,
            },
          ]
        : []),
    ],
    [data]
  )
  const drawer = route.drawer
  const opened =
    drawer?.kind === 'visit'
      ? lists
          .flatMap(l => l.visits.map(v => ({ visit: v, list: l })))
          .find(x => x.visit.report_number === drawer.id)
      : undefined
  const showLists = prioritised
  const visits = lists.reduce((n, l) => n + l.visits.length, 0)
  const levels = useMemo(
    () => new Map(data.camps.map(c => [c.district_slug, c.district_level] as const)),
    [data.camps]
  )
  const rows = [{ sim: data.sim }, ...lists.flatMap(l => l.visits)]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={data.name} />
      <OutgrowerTabs current={null} />
      <div className="flex flex-col gap-2">
        <StatCards
          stats={[
            { label: 'Enrolled farmers', value: data.enrolled_farmers.toLocaleString('en-GB') },
            { label: `Reports, ${data.window_days} days`, value: data.reports },
            { label: 'Verified by an officer', value: data.verified_reports },
            ...(data.top_issue
              ? [
                  {
                    label: `${data.top_issue.issue_label} this week`,
                    value: data.top_issue.this_week,
                    delta: weekDelta(data.top_issue.this_week, data.top_issue.last_week),
                  },
                ]
              : []),
          ]}
        />
        <p className="flex items-center gap-2 text-caption text-fg-2">
          <Lock size={16} aria-hidden />
          Camp and district level only. No farm locations are shown in this view.
        </p>
      </div>

      <section
        aria-labelledby="camps"
        className="island flex flex-col gap-2 px-[1.45rem] py-[1.3rem] md:px-[1.65rem] md:py-[1.55rem]"
      >
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div>
            <h2 id="camps" className="serif text-[1.35rem] font-semibold leading-[1.15] text-fg">
              Camps needing attention
            </h2>
            <p className="text-label tabular-nums text-fg-2">
              {data.camps.length} camps with reports in {data.window_days} days · clusters first
            </p>
          </div>
          <DemoBadge rows={rows} />
        </div>
        <CampsTable camps={data.camps} />
      </section>

      <section
        aria-labelledby="visits"
        className="island flex flex-col gap-4 px-[1.45rem] py-[1.3rem] md:px-[1.65rem] md:py-[1.55rem]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="visits" className="serif text-[1.35rem] font-semibold leading-[1.15] text-fg">
              Visit lists
            </h2>
            <p className="text-label tabular-nums text-fg-2">
              {visits} farm visits · {data.officers.length} field officers · most urgent first
            </p>
          </div>
          {!showLists && (
            <button
              type="button"
              className="btn-primary"
              aria-expanded={showLists}
              onClick={() => setPrioritised(true)}
            >
              <ListChecks aria-hidden />
              Prioritise field officers
            </button>
          )}
        </div>
        {showLists ? (
          <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
            {lists.map(list => (
              <OfficerColumn key={list.key} list={list} />
            ))}
          </div>
        ) : (
          <OfficerSummary lists={lists} />
        )}
        <p className="text-caption text-fg-2">
          Priority orders farms by the reasons shown, not by likelihood.
        </p>
      </section>

      {opened && (
        <VisitDrawer
          visit={opened.visit}
          officer={opened.list.title}
          level={levels.get(findDistrict(opened.visit.district)?.slug ?? '') ?? null}
          closeHref={close()}
        />
      )}
    </div>
  )
}

// Before "Prioritise": one line a field officer (how many visits, the farm to visit first, View),
// so the page has its answer on first paint.
function OfficerSummary({ lists }: { lists: OfficerList[] }) {
  const { open } = useDrawerLinks()
  return (
    <ul className="flex flex-col" aria-label="Visit lists, first farm each">
      {lists.map(list => {
        const top = list.visits[0]
        return (
          <li key={list.key}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-0.5 py-2 sm:grid-cols-[minmax(10rem,14rem)_6rem_minmax(0,1fr)_auto]">
              <span className="text-label">
                <span className="font-semibold text-fg">{list.title}</span>
                <span className="block text-caption text-fg-2">{list.district}</span>
              </span>
              <span className="text-label tabular-nums text-fg-2">
                {list.visits.length} {list.visits.length === 1 ? 'visit' : 'visits'}
              </span>
              <span className="text-label">
                {top ? (
                  <>
                    <span className="text-fg-2">First: </span>
                    <span className="font-semibold text-fg">{top.farm_label}</span>{' '}
                    <span className="text-fg-2">· {topReason(top)}</span>
                  </>
                ) : (
                  <span className="text-fg-2">No visits needed.</span>
                )}
              </span>
              {top && (
                <a
                  href={open({ kind: 'visit', id: top.report_number })}
                  aria-label={`View ${top.farm_label}`}
                  className="inline-flex items-center justify-self-end text-label font-medium text-signal-text hover:underline"
                >
                  View
                  <ChevronRight size={16} aria-hidden />
                </a>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function OfficerColumn({ list }: { list: OfficerList }) {
  const first = list.visits.slice(0, FIRST)
  const rest = list.visits.slice(FIRST)
  return (
    <section aria-label={list.title}>
      <header className="flex items-baseline justify-between gap-2 pb-1">
        <h3 className="text-label font-semibold text-fg">{list.title}</h3>
        <span className="meta">
          {list.district} · {list.visits.length} visits
        </span>
      </header>
      {list.visits.length === 0 ? (
        <p className="py-3 text-label text-fg-2">No visits needed.</p>
      ) : (
        <>
          <VisitRows visits={first} start={1} />
          {rest.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer list-none py-2 text-label font-medium text-fg-2 hover:text-fg [&::-webkit-details-marker]:hidden">
                {rest.length} more
              </summary>
              <VisitRows visits={rest} start={FIRST + 1} />
            </details>
          )}
        </>
      )}
    </section>
  )
}

// One line a farm: rank, farm, the one reason, when, and View.
function VisitRows({ visits, start }: { visits: Visit[]; start: number }) {
  const { open } = useDrawerLinks()
  return (
    <ol className="flex flex-col">
      {visits.map((v, i) => (
        <li key={`${v.report_number}-${v.farm_label}`}>
          <a
            href={open({ kind: 'visit', id: v.report_number })}
            className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-baseline gap-x-2 rounded py-1.5 hover:bg-well"
          >
            <span className="text-caption tabular-nums text-fg-2">{start + i}</span>
            <span className="text-label">
              <span className="font-semibold text-fg">{v.farm_label}</span>{' '}
              <span className="text-fg-2">· {topReason(v)}</span>
            </span>
            <span className="flex items-baseline gap-3 whitespace-nowrap">
              <span className="meta">{ago(v.last_report_at)}</span>
              <span className="inline-flex items-center text-label font-medium text-signal-text">
                View
                <ChevronRight size={16} aria-hidden />
              </span>
            </span>
          </a>
        </li>
      ))}
    </ol>
  )
}

function VisitDrawer({
  visit: v,
  officer,
  level,
  closeHref,
}: {
  visit: Visit
  officer: string
  level: RiskLevel | null
  closeHref: string
}) {
  const district = findDistrict(v.district)
  const levels = useMemo(
    () => new Map<string, RiskLevel>(district && level ? [[district.slug, level]] : []),
    [district, level]
  )
  return (
    <Drawer
      kicker={`Visit · ${officer}`}
      title={v.farm_label}
      aside={<DemoBadge small rows={[v]} />}
      closeHref={closeHref}
    >
      <ul className="flex flex-wrap gap-1.5" aria-label="Priority">
        <li className={`chip ${PRIORITY[v.priority].className}`}>{PRIORITY[v.priority].label}</li>
      </ul>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-label">
        {[
          ['Camp', v.camp],
          ['District', v.district],
          ['Crop', CROP_LABELS[v.crop]],
          [
            'Latest report',
            `${v.issue_label}${v.severity_band ? ` · ${SEVERITY_TEXT[v.severity_band]}` : ''}`,
          ],
          ['Reported', `${ago(v.last_report_at)} (${dateTime(v.last_report_at)})`],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-caption text-fg-2">{label}</dt>
            <dd className="text-fg">{value}</dd>
          </div>
        ))}
        {level && (
          <div>
            <dt className="text-caption text-fg-2">District signal</dt>
            <dd>
              <LevelDot level={level} />
            </dd>
          </div>
        )}
      </dl>

      <section className="mt-6" aria-labelledby="why">
        <h3 id="why" className="text-section font-semibold text-fg">
          Why it is on the list
        </h3>
        <ul className="mt-1 flex flex-col gap-0.5 text-label text-fg">
          {v.reasons.map(r => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <section className="mt-6" aria-labelledby="history">
        <h3 id="history" className="text-section font-semibold text-fg">
          Reports from this farm, last 14 days
        </h3>
        <ol className="mt-1 flex flex-col">
          {(v.history ?? []).map(h => (
            <li key={h.report_number} className="py-1.5">
              <p className="text-label text-fg">
                <span className="font-mono">{h.report_number}</span> · {dateTime(h.created_at)}
              </p>
              <p className="text-caption text-fg-2">
                {h.issue_label}
                {h.severity_band ? ` · ${SEVERITY_TEXT[h.severity_band]}` : ''} ·{' '}
                {VERIFICATION_TEXT[h.verification as keyof typeof VERIFICATION_TEXT] ??
                  h.verification}
              </p>
            </li>
          ))}
          {!v.history && <li className="py-2 text-caption text-fg-2">History not available.</li>}
        </ol>
      </section>

      {district && (
        <section className="mt-6" aria-labelledby="where">
          <h3 id="where" className="text-section font-semibold text-fg">
            Where: {district.name} district
          </h3>
          <div className="mt-2">
            <ZambiaMap
              compact
              levels={levels}
              selected={district.slug}
              height={200}
              focus={[
                [district.center.longitude - 0.9, district.center.latitude - 0.7],
                [district.center.longitude + 0.9, district.center.latitude + 0.7],
              ]}
            />
          </div>
          <p className="mt-1 text-caption text-fg-2">
            District outline only. Farm locations are never shown in this view.
          </p>
        </section>
      )}
    </Drawer>
  )
}

// The count columns, right-aligned so the figures line up.
const NUMERIC = new Set([2, 4, 5, 6])

function CampsTable({ camps }: { camps: OutgrowerOverview['camps'] }) {
  const [all, setAll] = useState(false)
  const shown = all ? camps : camps.slice(0, CAMPS_FIRST)
  if (camps.length === 0) return <Muted>No reports from member farms in this window.</Muted>
  return (
    <div className="overflow-x-auto" data-visual-scroll>
      {/* Phones show the first four columns; the counts behind them need a wider screen. */}
      <table className="w-full text-left text-label md:min-w-[640px]">
        <thead>
          <tr className="border-b border-hairline">
            {[
              'Camp',
              'District signal',
              'Reports',
              'Top issue',
              'Damage reported',
              'In a cluster',
              'With an officer',
            ].map((h, i) => (
              <th
                key={h}
                className={`th py-2 pr-4 ${NUMERIC.has(i) ? 'text-right' : ''} ${i > 3 ? 'max-md:hidden' : ''}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map(c => (
            <tr key={c.camp} className="border-b border-hairline last:border-b-0">
              <td className="py-2 pr-4">
                <span className="font-semibold text-fg">{c.camp}</span>
                <span className="block text-caption text-fg-2">{c.district}</span>
              </td>
              <td className="py-2 pr-4">
                {c.district_level ? <LevelDot level={c.district_level} /> : 'None'}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">{c.reports}</td>
              <td className="py-2 pr-4">{c.top_issue_label ?? 'Not identified'}</td>
              <td className="py-2 pr-4 text-right tabular-nums max-md:hidden">{c.damaged}</td>
              <td className="py-2 pr-4 text-right tabular-nums max-md:hidden">{c.in_cluster}</td>
              <td className="py-2 pr-4 text-right tabular-nums max-md:hidden">
                {c.awaiting_review}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {camps.length > shown.length && (
        <button type="button" className="btn-quiet mt-2" onClick={() => setAll(true)}>
          Show all {camps.length} camps
        </button>
      )}
    </div>
  )
}
