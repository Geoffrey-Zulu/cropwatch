import { LoaderCircle, Sun, Truck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  GRADE_PRICE_FACTOR,
  GRADES,
  zmw,
  type Grade,
  type Portfolio,
  type Reconciliation,
  type Statement,
  type VarianceKind,
} from '@repo/shared'
import { SkeletonRows } from '../../components/Skeleton'
import { seasonDate, useSeasonRefresh } from '../../lib/season'
import { trpc } from '../../lib/trpc'

// Tab 3 (plan §3): the depot's delivery entry, priced at the contract price for its grade; the
// statement, every line from the ledger; and the variance, shock-explained against unexplained.
export function ReconciliationSection({ portfolio: p }: { portfolio: Portfolio }) {
  const reconciliation = trpc.season.reconciliation.useQuery(
    { orgId: p.org_id },
    { refetchInterval: 6000 }
  )
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <DeliveryAndStatement portfolio={p} />
      <div className="flex min-w-0 flex-col gap-6">
        {reconciliation.data?.claim_packs.map(pack => (
          <ClaimPack key={pack.trigger_id} pack={pack} />
        ))}
        <VarianceList data={reconciliation.data} />
      </div>
    </div>
  )
}

function DeliveryAndStatement({ portfolio: p }: { portfolio: Portfolio }) {
  const refresh = useSeasonRefresh()
  const candidates = p.rows.filter(r => r.verified.state !== 'not_planted')
  const [contractId, setContractId] = useState(
    p.hero_contract_id ?? candidates[0]?.contract_id ?? ''
  )
  const [weight, setWeight] = useState('720')
  const [moisture, setMoisture] = useState('11')
  const [grade, setGrade] = useState<Grade>('A')
  const statement = trpc.season.statement.useQuery(
    { orgId: p.org_id, contractId },
    { enabled: Boolean(contractId), refetchInterval: 6000 }
  )
  // The payoff in view without a scroll on stage: on opening, the statement (before June) or the
  // depot's form (June); when June arrives, the form; after a delivery, the net due.
  const island = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const show = (el: Element | null, block: ScrollLogicalPosition = 'start') => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block })
  }
  const record = trpc.season.recordDelivery.useMutation({
    onSuccess: async () => {
      await refresh()
      setTimeout(() => show(document.getElementById('net-due'), 'center'), 150)
    },
  })
  const s = statement.data
  const kg = Number(weight)
  const price = s ? Math.round(s.contract_price_zmw_t * GRADE_PRICE_FACTOR[grade]) : 0
  const delivered = s?.lines.some(l => l.type === 'delivery') ?? false
  const before = p.phase !== 'june'
  const landed = useRef(false)
  const loaded = Boolean(statement.data)
  useEffect(() => {
    if (!loaded || landed.current) return
    landed.current = true
    show(before ? heading.current : island.current)
    // Once, when the statement first arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])
  const wasBefore = useRef(before)
  useEffect(() => {
    if (wasBefore.current && !before) show(island.current)
    wasBefore.current = before
  }, [before])

  return (
    <section
      ref={island}
      aria-labelledby="delivery"
      className="island min-w-0 scroll-mt-[4.75rem] lg:scroll-mt-[11.75rem] xl:scroll-mt-[9rem] px-[1.45rem] py-[1.3rem] md:px-[1.65rem] md:py-[1.55rem]"
    >
      <div className="grid items-start justify-items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <h2 id="delivery" className="serif text-title font-semibold text-fg">
            Delivery and statement
          </h2>
          <p className="text-label text-fg-2">
            The depot enters the weight; the ledger does the arithmetic
          </p>
        </div>
      </div>

      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={event => {
          event.preventDefault()
          record.mutate({
            orgId: p.org_id,
            contract_id: contractId,
            weight_kg: kg,
            moisture_pct: Number(moisture),
            grade,
          })
        }}
      >
        <label className="flex flex-col gap-1 text-label font-semibold text-fg sm:col-span-2">
          Farmer
          <select
            className="field"
            value={contractId}
            onChange={event => setContractId(event.target.value)}
          >
            {candidates.map(r => (
              <option key={r.contract_id} value={r.contract_id}>
                {r.farmer_name} · {r.camp}
              </option>
            ))}
          </select>
        </label>
        {/* Before June the depot has nothing to weigh: the form folds to one line and the
            statement (the ledger so far) moves up into view. */}
        {!before && (
          <>
            <label className="flex flex-col gap-1 text-label font-semibold text-fg">
              Weight (kg)
              <input
                className="field tabular-nums"
                inputMode="numeric"
                value={weight}
                onChange={event => setWeight(event.target.value.replace(/[^\d]/g, ''))}
              />
            </label>
            <label className="flex flex-col gap-1 text-label font-semibold text-fg">
              Moisture (%)
              <input
                className="field tabular-nums"
                inputMode="decimal"
                value={moisture}
                onChange={event => setMoisture(event.target.value.replace(/[^\d.]/g, ''))}
              />
            </label>
            <fieldset className="sm:col-span-2">
              <legend className="text-label font-semibold text-fg">Grade</legend>
              <div className="toggle-group mt-1" role="group">
                {GRADES.map(g => (
                  <button
                    key={g}
                    type="button"
                    className="toggle !py-1.5"
                    aria-pressed={grade === g}
                    onClick={() => setGrade(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </fieldset>
            <p className="text-label text-fg-2 sm:col-span-2">
              {kg > 0 && price > 0
                ? `${(kg / 1000).toFixed(2)} t × ZMW ${price.toLocaleString('en-GB')} (grade ${grade}) = ${zmw((kg / 1000) * price)}`
                : 'Enter the weight to price it'}
            </p>
          </>
        )}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          {/* Once delivered the statement is final: no button left to read as an action. */}
          {!delivered && !before && (
            <button
              type="submit"
              className="btn-primary"
              disabled={record.isPending || before || !(kg > 0)}
            >
              {record.isPending ? (
                <LoaderCircle size={18} aria-hidden className="animate-spin" />
              ) : (
                <Truck size={18} aria-hidden />
              )}
              Record delivery
            </button>
          )}
          {before && (
            <span className="text-caption text-fg-2">
              Deliveries open in June (season day {seasonDate(p.today)})
            </span>
          )}
          {delivered && (
            <span className="text-caption text-fg-2">Delivered: the statement below is final</span>
          )}
        </div>
        {record.error && (
          <p className="text-label text-high-text sm:col-span-2">{record.error.message}</p>
        )}
      </form>

      <h3
        ref={heading}
        className="mt-6 scroll-mt-[4.75rem] lg:scroll-mt-[11.75rem] xl:scroll-mt-[9rem] text-section font-semibold text-fg"
      >
        {s ? `${s.farmer_name}'s statement` : 'Statement'}
      </h3>
      {!s ? (
        <SkeletonRows rows={4} lines={1} label="Loading the statement" />
      ) : (
        <StatementTable statement={s} />
      )}
    </section>
  )
}

function StatementTable({ statement: s }: { statement: Statement }) {
  const net = -s.balance_zmw
  return (
    <>
      <table className="mt-2 w-full text-left text-label">
        <tbody>
          {s.lines.map((l, i) => (
            <tr key={`${l.ref}-${i}`} className="border-b border-hairline">
              <td className="py-2 pr-3">
                <span className="text-fg">{l.label}</span>
                <span className="block text-caption text-fg-2">
                  {seasonDate(l.at)} · {l.note}
                  {/* The transfer's reference, so the row can be traced to the "sent" receipt. */}
                  {l.type === 'advance' && l.ref.startsWith('SIM-') ? ` · ref ${l.ref}` : ''}
                  {/* "simulated" only on money that moved: a transfer or a payout (invariant 5). */}
                  {l.simulated &&
                  ['advance', 'payout', 'insurance_payout'].includes(l.type) &&
                  !l.note.includes('simulated')
                    ? ' · simulated'
                    : ''}
                </span>
              </td>
              <td className="whitespace-nowrap py-2 text-right font-semibold tabular-nums text-fg">
                {l.amount_zmw < 0 ? zmw(-l.amount_zmw) : `less ${zmw(l.amount_zmw)}`}
              </td>
            </tr>
          ))}
          <tr id="net-due" className="border-t-[1.5px] border-fg">
            <td className="pt-3 font-semibold text-fg">
              {net >= 0 ? `Net due to ${s.farmer_name.split(' ')[0]}` : 'Still owed by the farmer'}
              <span className="block text-caption font-normal text-fg-2">
                {s.settled
                  ? net > 0
                    ? 'Paying it moves money, so it waits for approval'
                    : 'Carried to next season'
                  : 'Before harvest: what is owed so far'}
              </span>
            </td>
            <td className="serif whitespace-nowrap pt-3 text-right text-[1.6rem] font-semibold tabular-nums text-fg">
              <span className="mr-1 font-body text-[0.8rem] font-[650] text-fg-2">ZMW</span>
              {Math.abs(net).toLocaleString('en-GB')}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-label text-fg-2">{s.variance.text}</p>
      <p className="mt-1 text-caption text-fg-2">
        Every figure is summed from the ledger rows; nothing is stored twice.
      </p>
    </>
  )
}

const KIND: Record<VarianceKind, { label: string; className: string }> = {
  unexplained: {
    label: 'Unexplained',
    className: 'bg-well text-high-text shadow-[inset_0_0_0_1px_var(--hairline)]',
  },
  shock: { label: 'Shock, uncontrollable', className: 'bg-attention-tint text-attention-text' },
  verified_issue: {
    label: 'Verified problem',
    className: 'bg-well text-fg shadow-[inset_0_0_0_1px_var(--hairline)]',
  },
  none: { label: 'On projection', className: 'bg-signal-tint text-signal-text' },
}

function VarianceList({ data }: { data: Reconciliation | undefined }) {
  // Never cut silently: the first eight, then every row on request.
  const [all, setAll] = useState(false)
  return (
    <section
      aria-labelledby="variance"
      className="island px-[1.45rem] py-[1.3rem] md:px-[1.65rem] md:py-[1.55rem]"
    >
      <div className="grid items-start justify-items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <h2 id="variance" className="serif text-title font-semibold text-fg">
            Delivered against projected
          </h2>
          <p className="text-label text-fg-2">Shortfalls the credit team must look at first</p>
        </div>
      </div>
      {!data ? (
        <SkeletonRows rows={4} lines={2} label="Loading the deliveries" />
      ) : data.rows.length === 0 ? (
        <p className="mt-3 text-label text-fg-2">No deliveries yet: they open in June.</p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {(all ? data.rows : data.rows.slice(0, 8)).map(r => (
            <li key={r.contract_id} className="border-b border-hairline py-2.5 last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-label font-semibold text-fg">
                  {r.farmer_name} <span className="font-normal text-fg-2">· {r.camp}</span>
                </span>
                <span
                  className={`rounded-pill px-2.5 py-[0.15rem] text-caption font-semibold ${KIND[r.variance.kind].className}`}
                >
                  {KIND[r.variance.kind].label}
                </span>
              </div>
              <p className="mt-0.5 text-caption text-fg-2">{r.variance.text}</p>
              {/* The book in kwacha after this delivery: net_zmw > 0 is owed to the farmer. */}
              <p className="mt-0.5 text-caption font-semibold tabular-nums text-fg">
                {r.net_zmw > 0
                  ? `Net due to the farmer ${zmw(r.net_zmw)}`
                  : r.net_zmw < 0
                    ? `Still owes ${zmw(-r.net_zmw)}`
                    : 'Settled'}
              </p>
            </li>
          ))}
        </ul>
      )}
      {data && data.rows.length > 8 && (
        <button type="button" className="btn-quiet mt-3" onClick={() => setAll(v => !v)}>
          {all ? 'Show the first 8' : `Show all ${data.rows.length}`}
        </button>
      )}
    </section>
  )
}

function ClaimPack({ pack }: { pack: Reconciliation['claim_packs'][number] }) {
  const t = pack.trigger
  return (
    <section
      aria-label={`Claim pack, ${pack.camp}`}
      className="island px-[1.45rem] py-[1.3rem] md:px-[1.65rem] md:py-[1.55rem]"
    >
      {/* Brick, as the Fields map paints a drought-flagged camp. */}
      <div className="grid items-start justify-items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <h2 className="serif flex items-center gap-2 text-title font-semibold text-fg">
            <span aria-hidden className="swatch swatch-high" />
            {pack.camp}: drought trigger
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-label font-semibold text-high-text">
            <Sun size={16} aria-hidden className="shrink-0" />
            Claim pack for an insurer · the payout is simulated
          </p>
        </div>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5 text-label text-fg [&>li]:relative [&>li]:pl-4 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[0.55rem] [&>li]:before:h-[0.36rem] [&>li]:before:w-[0.36rem] [&>li]:before:rounded-full [&>li]:before:bg-high [&>li]:before:content-['']">
        <li>
          Rain over 30 days: {t.value} mm, below the {t.threshold} mm rule
        </li>
        <li>
          Camp median NDVI {t.ndvi.median_start?.toFixed(2)} to {t.ndvi.median_end?.toFixed(2)} ·{' '}
          {t.ndvi.fields_falling} of {t.ndvi.fields_total} fields falling
        </li>
        <li>Two independent sources agree: flag raised {seasonDate(t.evaluated_at)}</li>
        <li>
          {pack.contracts.length} contracts: shortfalls marked uncontrollable, advances paused
        </li>
        <li>
          Claim pack: the trigger data and {pack.contracts.length} contracts with their hectares; an
          insurer receives camp totals only, no names or field locations
        </li>
      </ul>
      <p className="mt-3 text-caption text-fg-2">
        Rain: {pack.rainfall_source}. Greenness: the camp median of the season&apos;s passes.
      </p>
    </section>
  )
}
