import { ChevronDown, Download } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { zmw, type Portfolio, type SeasonRow } from '@repo/shared'
import { Sparkline } from '../../components/NdviChart'
import { SourceLine, SOURCE } from '../../components/SourceLine'
import { StatCards } from '../../components/StatCards'
import { useDrawerLinks } from '../../hooks/useRoute'
import { download, rosterCsv, seasonDate } from '../../lib/season'
import { ADVANCE_STATE, EligibilityChip, FieldCardSection } from './FieldCardSection'

export const PHASE = {
  january: 'January: the advance',
  march: 'March: mid-season',
  june: 'June: harvest',
} as const

// The portfolio over the season's tabs (plan §3): what the agribusiness has out and where it
// stands. Exposure figures are the point now (CLAUDE.md, CEIH note), always under the DEMO pill
// while simulated.
export function PortfolioHeader({ portfolio: p }: { portfolio: Portfolio }) {
  return (
    <div className="flex flex-col gap-2">
      <StatCards
        countFromZero
        columns="grid-cols-1 min-[440px]:grid-cols-2 md:grid-cols-3"
        stats={[
          {
            label: 'Contracts',
            value: p.contracts,
            delta:
              p.phase === 'june'
                ? 'Harvest: deliveries coming in'
                : // Established (from space or a visit): "verified" is kept for a field visit.
                  `${p.verified} established · ${p.eligible} eligible`,
          },
          {
            label: 'Projected value',
            prefix: 'ZMW',
            value: p.projected_value_zmw,
            delta: 'Hectares × yield × price',
          },
          {
            label: 'Input loans out',
            prefix: 'ZMW',
            value: p.input_loans_zmw,
            delta: 'Delivered and acknowledged',
          },
          {
            label: 'Advances out',
            prefix: 'ZMW',
            value: p.advances_out_zmw,
            delta: `${p.rows.filter(r => r.advance?.state === 'disbursed').length} sent · ${p.awaiting_approval} waiting approval`,
          },
          {
            label: 'Recovered',
            prefix: 'ZMW',
            value: p.recovered_zmw,
            delta: p.phase === 'june' ? 'From crop delivered' : 'Deliveries from June',
          },
          {
            label: 'Shock-flagged camps',
            value: p.shock_camps.length,
            delta: p.shock_camps.length ? p.shock_camps.join(', ') : 'Rain and NDVI must agree',
          },
        ]}
      />
    </div>
  )
}

// Tab 1 (plan §3): the roster, one row a contract, opening in place into the field card.
export function SeasonLedgerSection({
  portfolio: p,
  commandCenter,
}: {
  portfolio: Portfolio
  commandCenter: boolean
}) {
  const [camp, setCamp] = useState<string | null>(null)
  const { route, open, close } = useDrawerLinks()
  const opened = route.drawer?.kind === 'contract' ? route.drawer.id : null
  // An opened row rises to just under the header, so its card (curve, factors) fills the screen.
  useEffect(() => {
    if (!opened) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document
      .getElementById(`row-${opened}`)
      ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }, [opened])
  const rows = useMemo(() => {
    const shown = camp ? p.rows.filter(r => r.camp === camp) : p.rows
    // The storyline farmer and his neighbour first, then by name.
    const rank = (r: SeasonRow) =>
      r.contract_id === p.hero_contract_id ? 0 : r.contract_id === p.neighbour_contract_id ? 1 : 2
    return [...shown].sort(
      (a, b) => rank(a) - rank(b) || a.farmer_name.localeCompare(b.farmer_name)
    )
  }, [camp, p])
  const [all, setAll] = useState(false)
  // An opened row is always on the page (a farm just enrolled from the map may sort far down).
  const first = rows.slice(0, 12)
  const extra =
    !all && opened ? rows.find(r => r.contract_id === opened && !first.includes(r)) : undefined
  const visible = all ? rows : extra ? [extra, ...first.slice(0, 11)] : first

  return (
    <section
      aria-labelledby="ledger"
      className="island px-[1.2rem] py-[1.3rem] md:px-[1.65rem] md:py-[1.55rem]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="ledger" className="serif text-title font-semibold text-fg">
            Season ledger
          </h2>
          <p className="text-label text-fg-2">
            {rows.length} contracts · seen from space, checked on the ground
          </p>
        </div>
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          <div className="toggle-group" role="group" aria-label="Camp">
            {[null, ...p.camps].map(c => (
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
          <button
            type="button"
            className="btn-quiet"
            onClick={() =>
              download(
                `season-ledger-${(camp ?? 'all-camps').toLowerCase()}-${p.today.slice(0, 10)}.csv`,
                rosterCsv(rows)
              )
            }
          >
            <Download size={18} aria-hidden />
            Export CSV
          </button>
        </div>
      </div>

      <div className="mt-4" role="table" aria-label="Season ledger">
        <div
          role="row"
          className="hidden grid-cols-[minmax(10rem,1.3fr)_6.5rem_minmax(9rem,1fr)_minmax(12rem,1.3fr)_minmax(9rem,1fr)_7rem_6.5rem] gap-x-4 border-b border-hairline px-3 pb-2 lg:grid"
        >
          {['Farmer', 'Camp', 'Field status', 'Eligible', 'Advance', 'Exposure', 'NDVI'].map(h => (
            <span
              key={h}
              role="columnheader"
              className={`th ${h === 'Exposure' ? 'text-right' : ''}`}
            >
              {h}
            </span>
          ))}
        </div>
        {visible.map(r => {
          const isOpen = opened === r.contract_id
          return (
            <Fragment key={r.contract_id}>
              <a
                role="row"
                id={`row-${r.contract_id}`}
                href={isOpen ? close() : open({ kind: 'contract', id: r.contract_id })}
                aria-expanded={isOpen}
                className={`grid scroll-mt-[7.6rem] lg:scroll-mt-[4.75rem] grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 rounded-card px-3 py-3 transition-colors duration-200 ease-out lg:grid-cols-[minmax(10rem,1.3fr)_6.5rem_minmax(9rem,1fr)_minmax(12rem,1.3fr)_minmax(9rem,1fr)_7rem_6.5rem] lg:items-center ${
                  isOpen ? 'bg-signal-tint' : 'border-b border-hairline hover:bg-well'
                }`}
              >
                <span
                  role="cell"
                  className="flex items-center gap-1.5 text-label font-semibold text-fg"
                >
                  {r.farmer_name}
                  <ChevronDown
                    size={16}
                    aria-hidden
                    className={`shrink-0 text-fg-3 transition-transform duration-300 ease-out ${isOpen ? 'rotate-180 text-signal-text' : ''}`}
                  />
                </span>
                <span role="cell" className="text-label text-fg-2 max-lg:hidden">
                  {r.camp}
                </span>
                <span
                  role="cell"
                  className="text-right text-label font-semibold tabular-nums text-fg lg:order-none max-lg:col-start-2 max-lg:row-start-1"
                >
                  <span className="font-normal text-fg-2 lg:hidden">Exposure </span>
                  <span className="lg:hidden">{zmw(r.exposure_zmw)}</span>
                </span>
                <span
                  role="cell"
                  className="text-label leading-[1.3] text-fg max-lg:col-span-2 max-lg:row-start-3 lg:col-start-3 lg:row-start-1"
                >
                  {r.verified.label}
                  {r.verified.date && (
                    <span className="block text-caption text-fg-2">
                      {seasonDate(r.verified.date)}
                    </span>
                  )}
                </span>
                <span
                  role="cell"
                  className="max-lg:col-span-2 max-lg:row-start-2 lg:col-start-4 lg:row-start-1"
                >
                  <EligibilityChip eligible={r.eligible} label={r.eligibility_label} />
                </span>
                <span
                  role="cell"
                  className="text-label leading-[1.3] text-fg max-lg:hidden lg:col-start-5 lg:row-start-1"
                >
                  <AdvanceCell row={r} />
                </span>
                <span
                  role="cell"
                  className="hidden text-right text-label font-semibold tabular-nums text-fg lg:col-start-6 lg:row-start-1 lg:block"
                >
                  {zmw(r.exposure_zmw)}
                </span>
                <span role="cell" className="hidden lg:col-start-7 lg:row-start-1 lg:block">
                  <Sparkline values={r.spark} label={`${r.farmer_name}: NDVI at the last passes`} />
                </span>
              </a>
              {isOpen && (
                <div className="pb-3 pt-1">
                  <FieldCardSection
                    orgId={p.org_id}
                    contractId={r.contract_id}
                    commandCenter={commandCenter}
                  />
                </div>
              )}
            </Fragment>
          )
        })}
      </div>
      {rows.length > visible.length && (
        <button type="button" className="btn-quiet mt-3" onClick={() => setAll(true)}>
          Show all {rows.length} contracts
        </button>
      )}
      <p className="mt-4 text-caption text-fg-2">
        Farmer level for this agribusiness only, under each farmer&apos;s contract consent. No field
        pins are shown or exported.
      </p>
      <SourceLine className="mt-1" parts={[SOURCE.greenness(p.sim)]} />
    </section>
  )
}

function AdvanceCell({ row }: { row: SeasonRow }) {
  const a = row.advance
  if (!a) return <span className="text-fg-2">None</span>
  return (
    <>
      {zmw(a.amount_zmw)}
      <span className="block text-caption text-fg-2">
        {ADVANCE_STATE[a.state]}
        {a.simulated ? ' (simulated)' : ''}
      </span>
    </>
  )
}
