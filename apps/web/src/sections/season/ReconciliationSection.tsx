import {
  AlertTriangle,
  Banknote,
  ChevronsRight,
  CircleCheck,
  LoaderCircle,
  Play,
  Sun,
} from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { zmw, type Portfolio, type Reconciliation, type SettlementRow } from '@repo/shared'
import { SkeletonRows } from '../../components/Skeleton'
import { SOURCE, SourceLine } from '../../components/SourceLine'
import { useCountUp } from '../../hooks/useCountUp'
import { seasonDate, useSeasonRefresh } from '../../lib/season'
import { trpc } from '../../lib/trpc'

// Tab 3 (Geoffrey, 1 Nov): the harvest settled as a batch. "Start reconciliation" shows every
// farmer with a crop in the ground, ready (delivered, in the ledger) or not yet; the ready ones
// then resolve one by one: the crop at the contract price, less the inputs, less the advance and
// its fee, the net owed. The totals gather beside them, with the drought camp's shortfalls held
// as uncontrollable and the unexplained ones flagged. One request then pays them all. Every
// figure is the ledger's (packages/shared/src/ceih/views.ts, buildRoster): nothing is computed
// here but sums, and nothing is stored twice.

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const n = (v: number) => v.toLocaleString('en-GB')
const total = (rows: SettlementRow[], of: (r: SettlementRow) => number) =>
  rows.reduce((sum, r) => sum + of(r), 0)
// The whole run in about nine seconds, whatever the count; at most 160 ms a farmer.
const stepMs = (count: number) => Math.min(160, 9000 / Math.max(1, count))

export function ReconciliationSection({
  portfolio: p,
  commandCenter = false,
}: {
  portfolio: Portfolio
  // May move the simulated season's calendar (the gear's "Go to June").
  commandCenter?: boolean
}) {
  const reconciliation = trpc.season.reconciliation.useQuery(
    { orgId: p.org_id },
    { refetchInterval: 6000 }
  )
  return (
    <div className="flex flex-col gap-6">
      <Settlement portfolio={p} data={reconciliation.data} commandCenter={commandCenter} />
      {reconciliation.data?.claim_packs.map(pack => (
        <ClaimPack key={pack.trigger_id} pack={pack} />
      ))}
    </div>
  )
}

function Settlement({
  portfolio: p,
  data,
  commandCenter,
}: {
  portfolio: Portfolio
  data: Reconciliation | undefined
  commandCenter: boolean
}) {
  const refresh = useSeasonRefresh()
  const roster = data?.roster
  const ready = useMemo(() => roster?.filter(r => r.ready) ?? [], [roster])
  const waiting = useMemo(() => roster?.filter(r => !r.ready) ?? [], [roster])
  // Once the payout is requested the settlement is final: shown whole on every visit.
  const paid = ready.some(r => r.payout)
  const [started, setStarted] = useState(false)
  // When the run started: the count follows the clock, so a slow frame never stretches the run.
  const [startedAt, setStartedAt] = useState(0)
  const [resolved, setResolved] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const island = useRef<HTMLElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const pay = trpc.season.requestPayouts.useMutation({
    onSuccess: async () => {
      setConfirming(false)
      await refresh()
    },
  })
  const june = p.phase === 'june'
  // On the simulated season, before June, the one press moves the calendar to June (as the gear
  // does, and says so under the button), then runs: deliveries only exist from June.
  const toJune = trpc.season.demo.setPhase.useMutation()
  const canJump = commandCenter && p.sim && !june
  // The presenter's rerun (Geoffrey, 1 Nov): on the simulated season a refresh always opens on
  // "Start reconciliation", and Start clears the last run's payout rows before it plays.
  const rerun = commandCenter && p.sim
  const reset = trpc.season.demo.resetSettlement.useMutation()
  const busy = toJune.isPending || reset.isPending
  const shown = started || (paid && !rerun)
  const count = paid ? ready.length : Math.min(resolved, ready.length)
  const playing = started && !paid && count < ready.length
  const done = shown && count >= ready.length

  // The ready farmers resolve one after another, after a beat to read the roster.
  useEffect(() => {
    if (!playing) return
    const step = stepMs(ready.length)
    const t = setInterval(
      () => {
        const due = Math.floor((performance.now() - startedAt - 600) / step) + 1
        setResolved(Math.min(ready.length, Math.max(0, due)))
      },
      Math.max(30, step / 2)
    )
    return () => clearInterval(t)
  }, [playing, startedAt, ready.length])
  // The farmer just settled stays in the middle of the list (the list scrolls, not the page).
  useEffect(() => {
    const box = list.current
    if (!box || !playing || count === 0) return
    const row = box.querySelector<HTMLElement>(`[data-row="${count - 1}"]`)
    if (!row) return
    box.scrollTo({
      top: row.offsetTop - box.clientHeight / 2 + row.offsetHeight / 2,
      behavior: reduced() ? 'auto' : 'smooth',
    })
  }, [count, playing])

  // The roster, the totals and the payout button fill the screen under the header: once the
  // roster has rendered (after a move to June it arrives in the same render as the start).
  useEffect(() => {
    if (!started) return
    island.current?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' })
  }, [started])

  const start = () => {
    setStarted(true)
    setStartedAt(performance.now())
    // Reduced motion: everything at once (the count is capped at the ready rows).
    setResolved(reduced() ? Number.MAX_SAFE_INTEGER : 0)
  }

  return (
    <section
      ref={island}
      aria-labelledby="settlement"
      className="island min-w-0 scroll-mt-[7.6rem] px-[1.2rem] py-[1.3rem] md:px-[1.65rem] md:py-[1.45rem] lg:scroll-mt-[4.75rem]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="settlement" className="serif text-title font-semibold text-fg">
            Harvest settlement
          </h2>
          <p className="text-label text-fg-2">
            The crop at the contract price, less what was lent: every figure from the ledger
          </p>
        </div>
        {!shown && (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              className="btn-primary"
              disabled={!roster || busy || (!june && !canJump)}
              onClick={async () => {
                if (rerun) await reset.mutateAsync({ orgId: p.org_id })
                if (canJump) await toJune.mutateAsync({ orgId: p.org_id, phase: 'june' })
                // The June roster and figures in hand before the run starts.
                if (rerun) await refresh()
                start()
              }}
            >
              {busy ? (
                <LoaderCircle size={17} aria-hidden className="animate-spin" />
              ) : (
                <Play size={17} aria-hidden />
              )}
              Start reconciliation
            </button>
            {!june && (
              <span className="text-caption text-fg-2">
                {canJump
                  ? 'Moves the season to June, harvest'
                  : `Deliveries open in June (season day ${seasonDate(p.today)})`}
              </span>
            )}
            {(toJune.error ?? reset.error) && (
              <span className="text-caption text-high-text">
                {(toJune.error ?? reset.error)?.message}
              </span>
            )}
          </div>
        )}
        {playing && (
          <button
            type="button"
            className="btn-quiet !h-9"
            onClick={() => setResolved(ready.length)}
          >
            <ChevronsRight size={16} aria-hidden />
            Skip
          </button>
        )}
      </div>

      {!roster ? (
        <SkeletonRows rows={4} lines={1} label="Loading the season's deliveries" />
      ) : !shown ? (
        <p className="mt-3 text-label text-fg-2">
          {roster.length} farmers with a crop in the ground this season.
        </p>
      ) : (
        <div className="mt-4 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="min-w-0">
            <div
              aria-hidden
              className="hidden grid-cols-[minmax(0,1fr)_5.4rem_6.6rem_5.8rem_5.6rem_7.4rem_6.6rem] gap-x-3 border-b border-hairline px-2 pb-1.5 lg:grid"
            >
              {[
                'Farmer',
                'Status',
                'Delivered',
                'Value',
                'Less inputs',
                'Less advance, fee',
                'Net',
              ].map(h => (
                <span
                  key={h}
                  className={`th ${['Delivered', 'Farmer', 'Status'].includes(h) ? '' : 'text-right'}`}
                >
                  {h}
                </span>
              ))}
            </div>
            <div
              ref={list}
              role="list"
              aria-label="Farmers to settle"
              className="relative max-h-[24rem] overflow-y-auto overscroll-contain"
            >
              {ready.map((r, i) => (
                <Row
                  key={r.contract_id}
                  row={r}
                  index={i}
                  state={i < count ? (playing && i === count - 1 ? 'active' : 'done') : 'waiting'}
                />
              ))}
              {waiting.map(r => (
                <Row key={r.contract_id} row={r} state="not_yet" />
              ))}
            </div>
            <p className="mt-2 text-caption text-fg-2">
              {ready.length} ready · {waiting.length} not yet · amounts in ZMW · every figure is
              summed from the ledger rows; nothing is stored twice.
            </p>
          </div>
          <Summary
            ready={ready}
            settled={ready.slice(0, count)}
            done={done}
            confirming={confirming}
            setConfirming={setConfirming}
            pay={() => pay.mutate({ orgId: p.org_id })}
            paying={pay.isPending}
            error={pay.error?.message}
          />
        </div>
      )}
    </section>
  )
}

type RowState = 'waiting' | 'active' | 'done' | 'not_yet'

// Memoised: a step re-renders the two rows whose state changed, not the whole roster.
const Row = memo(function Row({
  row: r,
  index,
  state,
}: {
  row: SettlementRow
  index?: number
  state: RowState
}) {
  const settled = state === 'done' || state === 'active'
  const chip =
    state === 'not_yet' ? (
      <span className="inline-flex shrink-0 items-center rounded-pill bg-well px-2.5 py-[0.12rem] text-caption font-semibold text-fg-2 shadow-[inset_0_0_0_1px_var(--hairline)]">
        Not yet
      </span>
    ) : (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-signal-tint px-2.5 py-[0.12rem] text-caption font-semibold text-signal-text">
        {settled && <CircleCheck size={13} aria-hidden />}
        Ready
      </span>
    )
  const delivered =
    r.weight_kg !== null ? `${(r.weight_kg / 1000).toFixed(2)} t · grade ${r.grade}` : ''
  return (
    <div
      role="listitem"
      data-row={index}
      className={`border-b border-hairline px-2 py-2 transition-colors duration-300 ease-out last:border-b-0 ${state === 'active' ? 'bg-signal-tint' : ''}`}
    >
      {/* Wide: one line, the arithmetic in columns. */}
      <div className="hidden grid-cols-[minmax(0,1fr)_5.4rem_6.6rem_5.8rem_5.6rem_7.4rem_6.6rem] items-center gap-x-3 text-label lg:grid">
        <span className="truncate">
          <span className="font-semibold text-fg">{r.farmer_name}</span>
          <span className="text-fg-2"> · {r.camp}</span>
        </span>
        <span>{chip}</span>
        {state === 'not_yet' ? (
          <span className="col-span-5 text-caption text-fg-2">Not delivered yet</span>
        ) : settled ? (
          <>
            <span className="lc-row tabular-nums text-fg">{delivered}</span>
            <Fig className="text-right" value={r.value_zmw} />
            <Fig className="text-right text-fg-2" value={r.input_loan_zmw} />
            <Fig className="text-right text-fg-2" value={r.advance_zmw + r.fee_zmw} />
            <Net row={r} />
          </>
        ) : (
          <>
            {[0, 1, 2, 3, 4].map(k => (
              <span
                key={k}
                className={`h-3 rounded bg-well ${k === 0 ? 'w-16' : 'ml-auto w-12'}`}
              />
            ))}
          </>
        )}
      </div>
      {/* Narrow: the name and the net, the arithmetic under them. */}
      <div className="flex flex-col gap-0.5 lg:hidden">
        <div className="flex items-center justify-between gap-2 text-label">
          <span className="min-w-0 truncate">
            <span className="font-semibold text-fg">{r.farmer_name}</span>
            <span className="text-fg-2"> · {r.camp}</span>
          </span>
          {settled ? <Net row={r} /> : chip}
        </div>
        {state === 'not_yet' ? (
          <span className="text-caption text-fg-2">Not delivered yet</span>
        ) : (
          settled && (
            <span className="lc-row text-caption tabular-nums text-fg-2">
              {delivered}: {n(r.value_zmw)}, less {n(r.input_loan_zmw)} inputs, less{' '}
              {n(r.advance_zmw + r.fee_zmw)} advance and fee
            </span>
          )
        )}
      </div>
      {settled && r.payout && (
        <p className="lc-row mt-1 flex items-center gap-1.5 text-caption text-fg-2">
          <Banknote size={14} aria-hidden className="shrink-0 text-signal" />
          Payout {zmw(r.payout.amount_zmw)} requested {seasonDate(r.payout.at)} · ref {r.payout.ref}{' '}
          · simulated
        </p>
      )}
    </div>
  )
})

// A figure that counts up from zero as its row settles.
function Fig({ value, className = '' }: { value: number; className?: string }) {
  const shown = useCountUp(value, 420, 0)
  return <span className={`lc-row tabular-nums text-fg ${className}`}>{n(shown)}</span>
}

// What is owed to the farmer, or the shortfall, marked by what explains it.
function Net({ row: r }: { row: SettlementRow }) {
  const shown = useCountUp(Math.abs(r.net_zmw), 420, 0)
  const kind = r.variance.kind
  const Mark = kind === 'shock' ? Sun : kind === 'unexplained' ? AlertTriangle : null
  const tone =
    r.net_zmw >= 0
      ? 'text-fg'
      : kind === 'shock'
        ? 'text-attention-text'
        : kind === 'unexplained'
          ? 'text-high-text'
          : 'text-fg'
  return (
    <span
      className={`lc-row inline-flex items-center justify-end gap-1 whitespace-nowrap text-right font-semibold tabular-nums ${tone}`}
      title={r.variance.text}
    >
      {Mark && <Mark size={14} aria-hidden className="shrink-0" />}
      {r.net_zmw < 0 ? `short ${n(shown)}` : n(shown)}
    </span>
  )
}

function Summary({
  ready,
  settled,
  done,
  confirming,
  setConfirming,
  pay,
  paying,
  error,
}: {
  ready: SettlementRow[]
  settled: SettlementRow[]
  done: boolean
  confirming: boolean
  setConfirming: (on: boolean) => void
  pay: () => void
  paying: boolean
  error: string | undefined
}) {
  const gross = useCountUp(
    total(settled, r => r.value_zmw),
    250
  )
  const recovered = useCountUp(
    total(settled, r => r.recovered_zmw),
    250
  )
  const due = useCountUp(
    total(
      settled.filter(r => r.net_zmw > 0),
      r => r.net_zmw
    ),
    250
  )
  const shock = settled.filter(r => r.variance.kind === 'shock')
  const unexplained = settled.filter(r => r.variance.kind === 'unexplained')
  const shockCamps = [...new Set(shock.map(r => r.camp))].join(', ')
  const payees = ready.filter(r => r.net_zmw > 0 && !r.payout)
  const sent = ready.filter(r => r.payout)
  return (
    <aside
      aria-label="Settlement totals"
      className="rounded-card bg-ground px-4 py-3.5 shadow-[inset_0_0_0_1px_var(--hairline)] xl:sticky xl:top-[5.5rem]"
    >
      <dl className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1.5 text-label">
        <dt className="text-fg-2">Farmers settled</dt>
        <dd className="text-right font-semibold tabular-nums text-fg">
          {settled.length} of {ready.length}
        </dd>
        <dt className="text-fg-2">Gross value</dt>
        <dd className="text-right font-semibold tabular-nums text-fg">{zmw(gross)}</dd>
        <dt className="text-fg-2">Recovered</dt>
        <dd className="text-right font-semibold tabular-nums text-fg">{zmw(recovered)}</dd>
      </dl>
      <div className="mt-3 border-t border-hairline pt-3">
        <p className="text-label font-semibold text-fg">Total payouts due</p>
        <p className="serif text-[1.9rem] font-semibold leading-none tabular-nums text-fg">
          <span className="mr-1 font-body text-[0.85rem] font-[650] text-fg-2">ZMW</span>
          {due.toLocaleString('en-GB')}
        </p>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5 text-caption text-fg">
        {shock.length > 0 && (
          <li className="flex items-start gap-1.5">
            <Sun size={14} aria-hidden className="mt-0.5 shrink-0 text-attention-text" />
            <span>
              {shockCamps} drought: {shock.length} short{' '}
              {shock.length === 1 ? 'delivery' : 'deliveries'}, uncontrollable
            </span>
          </li>
        )}
        {unexplained.length > 0 && (
          <li className="flex items-start gap-1.5">
            <AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0 text-high-text" />
            <span>
              {unexplained.length} unexplained{' '}
              {unexplained.length === 1 ? 'shortfall' : 'shortfalls'}, flagged for the credit team:{' '}
              {unexplained.map(r => r.farmer_name).join(', ')}
            </span>
          </li>
        )}
      </ul>

      {done && (
        <div className="mt-3 border-t border-hairline pt-3">
          {sent.length > 0 ? (
            <div className="lc-row">
              <p className="flex items-center gap-1.5 text-label font-semibold text-signal-text">
                <CircleCheck size={17} aria-hidden className="shrink-0" />
                Bulk payment request sent to Phytos · simulated
              </p>
              <p className="mt-0.5 text-caption tabular-nums text-fg-2">
                {sent.length} farmers · {zmw(total(sent, r => r.payout?.amount_zmw ?? 0))} · one
                ledger row each
              </p>
            </div>
          ) : payees.length === 0 ? (
            <p className="text-caption text-fg-2">Nothing owed to a farmer yet.</p>
          ) : confirming ? (
            <div className="lc-row rounded-card bg-panel px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--hairline)]">
              <p className="text-label font-semibold text-fg">
                Pay {payees.length} farmers {zmw(total(payees, r => r.net_zmw))}?
              </p>
              <p className="mt-0.5 text-caption text-fg-2">
                Each to their mobile money, what the ledger says is owed. One ledger row a farmer.
              </p>
              <div className="mt-2.5 grid gap-2">
                <button
                  type="button"
                  className="btn-primary justify-center"
                  disabled={paying}
                  onClick={pay}
                >
                  {paying ? (
                    <LoaderCircle size={17} aria-hidden className="animate-spin" />
                  ) : (
                    <Banknote size={17} aria-hidden />
                  )}
                  Send bulk payment
                </button>
                <button
                  type="button"
                  className="btn-quiet justify-center"
                  disabled={paying}
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn-primary w-full justify-center"
              onClick={() => setConfirming(true)}
            >
              <Banknote size={17} aria-hidden />
              Request bulk payment
            </button>
          )}
          {error && <p className="mt-2 text-caption text-high-text">{error}</p>}
        </div>
      )}
    </aside>
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
      <SourceLine
        className="mt-3"
        parts={[
          pack.sim ? SOURCE.rainfall : `Rain: ${pack.rainfall_source}`,
          SOURCE.greenness(pack.sim),
        ]}
      />
    </section>
  )
}
