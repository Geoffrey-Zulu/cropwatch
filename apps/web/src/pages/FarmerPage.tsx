import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Banknote, CircleCheck, MessageSquareText, Sprout } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  balance,
  CROP_LABELS,
  disbursedMessage,
  establishmentNdvi,
  feeFor,
  LEDGER_LABELS,
  zmw,
  type FieldCard,
  type Statement,
} from '@repo/shared'
import { NdviChart } from '../components/NdviChart'
import { PhytosLogo } from '../components/PhytosLogo'
import { SOURCE, SourceLine } from '../components/SourceLine'
import { SNAPSHOT } from '../farmer/snapshot'
import { firstName, seasonDate } from '../lib/dates'
import { IMAGERY } from '../lib/imagery'
import { SendMoneySection, type Sent } from '../sections/farmer/SendMoneySection'
import { LoanCheck } from '../sections/season/LoanCheck'

const cropWord = (crop: FieldCard['crop']) =>
  crop === 'soybean' ? 'soya' : CROP_LABELS[crop].toLowerCase()

// The farmer app (Geoffrey, 1 Nov): Given's phone. No sign-in and no live season: it boots into
// his snapshot and keeps every change in memory, so a refresh starts again. One dashboard in the
// field-airy kit, scaled to a farmer: his field on the imagery, his curve, his loan, and one
// action, "Check my advance": the same loan check the agribusiness runs, in his voice, ending on
// whether and how much he can get; "Get advance" then sends it.
export function FarmerPage() {
  const s = SNAPSHOT
  const card = s.card
  const first = firstName(card.farmer_name)
  const cap = card.eligibility.cap_zmw
  const fee = feeFor(cap, card.credit)
  const [checking, setChecking] = useState(false)
  const [sent, setSent] = useState<Sent | null>(null)
  // His statement: the snapshot's ledger lines, and the advance and its fee once sent.
  const lines = useMemo<Statement['lines']>(
    () =>
      sent
        ? [
            ...s.statement.lines,
            {
              at: s.today,
              type: 'advance',
              label: LEDGER_LABELS.advance,
              amount_zmw: sent.amount,
              ref: sent.ref,
              note: `To your ${s.wallet}`,
              simulated: true,
            },
            {
              at: s.today,
              type: 'advance_fee',
              label: LEDGER_LABELS.advance_fee,
              amount_zmw: sent.fee,
              ref: sent.ref,
              note: 'Shown before it was sent',
              simulated: true,
            },
          ]
        : s.statement.lines,
    [sent, s]
  )
  const owed = balance(lines)

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex h-[3.75rem] items-center gap-3 bg-panel px-4 shadow-[0_1px_0_rgb(27_41_32/0.06),0_10px_26px_-18px_rgb(27_41_32/0.3)] md:px-[1.6rem]">
        <PhytosLogo />
        {/* Which of the two apps the room is looking at. */}
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-well px-3 py-1 text-caption font-semibold text-fg shadow-[inset_0_0_0_1px_var(--hairline)]">
          <Sprout size={14} aria-hidden className="text-signal" />
          Farmer dashboard
        </span>
        <div className="ml-auto flex items-center gap-2.5">
          <span className="hidden text-right text-caption leading-tight text-fg-2 sm:block">
            <span className="block font-semibold text-fg">{card.farmer_name}</span>
            {card.camp} camp · {s.org}
          </span>
          <span
            aria-hidden
            className="grid h-9 w-9 place-items-center rounded-pill bg-signal-tint text-caption font-bold text-signal-text"
          >
            {card.farmer_name
              .split(' ')
              .map(w => w[0])
              .join('')}
          </span>
        </div>
      </header>

      <main className="canvas min-w-0 flex-1 px-4 py-5 md:px-[1.6rem] md:py-7">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
          <div className="contents lg:flex lg:flex-col lg:gap-6">
            <section
              aria-labelledby="your-field"
              className="island order-2 p-[1.2rem] md:p-[1.4rem]"
            >
              <h2 id="your-field" className="text-section font-semibold text-fg">
                Your field
              </h2>
              <p className="text-caption text-fg-2">
                {card.contracted_ha} ha {cropWord(card.crop)} · planted{' '}
                {seasonDate(card.planting_date)} · traced by your officer
              </p>
              {card.ring && <FarmMap ring={card.ring} label={`Imagery of ${first}'s field`} />}
              <SourceLine className="mt-2" parts={[SOURCE.imagery]} />
            </section>
            <section
              aria-labelledby="your-crop"
              className="island order-3 p-[1.2rem] md:p-[1.4rem]"
            >
              <h2 id="your-crop" className="text-section font-semibold text-fg">
                Your crop from space
              </h2>
              <p className="text-caption text-fg-2">
                {card.status_label} · a pass a week, against the {card.camp} camp
              </p>
              <div className="mt-3">
                <NdviChart
                  compact
                  height={190}
                  curve={card.curve}
                  plantingDate={card.planting_date}
                  today={card.today}
                  threshold={establishmentNdvi(card.crop)}
                  label={`${first}'s greenness against the ${card.camp} camp median: ${card.status_label}`}
                />
              </div>
              <SourceLine className="mt-2" parts={[SOURCE.greenness(card.sim)]} />
            </section>
          </div>

          <div className="contents lg:flex lg:flex-col lg:gap-6">
            <section
              aria-labelledby="hello"
              className="island order-1 px-[1.3rem] py-[1.3rem] md:px-[1.6rem] md:py-[1.5rem]"
            >
              <p className="meta">
                {s.org} · {card.camp} camp · {card.contracted_ha} ha {cropWord(card.crop)}
              </p>
              <h1
                id="hello"
                className="serif mt-0.5 text-[1.9rem] font-semibold leading-[1.1] tracking-[-0.015em] text-fg"
              >
                Hello, {first}
              </h1>
              {sent ? (
                <div className="lc-row mt-3">
                  <span className="inline-flex items-center gap-1 rounded-pill bg-signal-tint px-2.5 py-[0.18rem] text-caption font-semibold text-signal-text">
                    <CircleCheck size={14} aria-hidden />
                    Advance sent
                  </span>
                  <p className="serif mt-2 text-[2.2rem] font-semibold leading-none tabular-nums text-fg">
                    <span className="mr-1.5 font-body text-[0.95rem] font-[650] text-fg-2">
                      ZMW
                    </span>
                    {sent.amount.toLocaleString('en-GB')}
                  </p>
                  <p className="mt-1.5 text-label text-fg">
                    Sent to your {s.wallet} · {s.phone}
                    <span className="text-fg-2"> · simulated</span>
                  </p>
                  <p className="text-caption text-fg-2">
                    Fee {zmw(sent.fee)}. Both are deducted at harvest. Ref {sent.ref}.
                  </p>
                </div>
              ) : (
                <>
                  <p className="mt-2 text-label leading-[1.5] text-fg">
                    Your field is established and on track. In the hunger month you can take a cash
                    advance against your crop, up to your cap.
                  </p>
                  <button
                    type="button"
                    className="btn-primary mt-4 !h-12 w-full !text-[1.05rem] sm:w-auto sm:!px-7"
                    onClick={() => setChecking(true)}
                  >
                    <Banknote size={20} aria-hidden />
                    Check my advance
                  </button>
                  <p className="mt-2 text-caption text-fg-2">
                    Rules, not a score. The amount and the fee show before anything is sent.
                  </p>
                </>
              )}
            </section>

            <section
              aria-labelledby="your-loan"
              className="island order-4 px-[1.3rem] py-[1.2rem] md:px-[1.6rem] md:py-[1.4rem]"
            >
              <h2 id="your-loan" className="text-section font-semibold text-fg">
                Your loan
              </h2>
              <p className="text-caption text-fg-2">
                Your crop, projected: {zmw(card.projected_value_zmw)} at the contract price
              </p>
              <table className="mt-2 w-full text-left text-label">
                <tbody>
                  {lines.map((l, i) => (
                    <tr
                      key={`${l.ref}-${l.type}`}
                      className={`border-b border-hairline ${i >= s.statement.lines.length ? 'lc-row' : ''}`}
                    >
                      <td className="py-2 pr-3">
                        <span className="text-fg">{l.label}</span>
                        <span className="block text-caption text-fg-2">
                          {seasonDate(l.at)} ·{' '}
                          {l.type === 'input_loan' ? 'Seed and fertiliser' : l.note}
                          {l.type === 'advance' && l.simulated ? ' · simulated' : ''}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-2 text-right font-semibold tabular-nums text-fg">
                        {zmw(l.amount_zmw)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-[1.5px] border-fg">
                    <td className="pt-3 font-semibold text-fg">
                      Owed at harvest
                      <span className="block text-caption font-normal text-fg-2">
                        Deducted from your crop when you deliver
                      </span>
                    </td>
                    <td className="serif whitespace-nowrap pt-3 text-right text-[1.5rem] font-semibold tabular-nums text-fg">
                      <span className="mr-1 font-body text-[0.8rem] font-[650] text-fg-2">ZMW</span>
                      {owed.toLocaleString('en-GB')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>

            {sent && (
              <section
                aria-labelledby="messages"
                className="lc-row island order-5 px-[1.3rem] py-[1.2rem] md:px-[1.6rem]"
              >
                <h2
                  id="messages"
                  className="flex items-center gap-1.5 text-section font-semibold text-fg"
                >
                  <MessageSquareText size={18} aria-hidden className="text-fg-2" />
                  Messages
                </h2>
                <div className="mt-2 rounded-[1.1rem] rounded-tl-[0.35rem] bg-well px-4 py-3 shadow-[inset_0_0_0_1px_var(--hairline)]">
                  <p className="text-caption font-semibold text-fg-2">
                    Phytos · {seasonDate(s.today)}
                  </p>
                  <p className="mt-1 text-label leading-[1.45] text-fg">
                    {disbursedMessage({
                      amountZmw: sent.amount,
                      feeZmw: sent.fee,
                      wallet: s.wallet,
                      txRef: sent.ref,
                      simulated: false,
                    })}
                  </p>
                </div>
              </section>
            )}
          </div>
        </div>
      </main>

      {checking && (
        <LoanCheck
          card={card}
          voice="farmer"
          onClose={() => setChecking(false)}
          then={close => (
            <SendMoneySection
              amount={cap}
              fee={fee}
              feePct={card.credit.advance_fee_pct}
              owedAfter={owed + (sent ? 0 : cap + fee)}
              wallet={s.wallet}
              phone={s.phone}
              today={s.today}
              onSent={setSent}
              onDone={close}
            />
          )}
        />
      )}
    </div>
  )
}

// His field on real imagery, its traced outline on top: still, so a thumb scrolls the page.
function FarmMap({ ring, label }: { ring: [number, number][]; label: string }) {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!el.current) return
    const latlngs = ring.map(([lng, lat]) => L.latLng(lat, lng))
    const bounds = L.latLngBounds(latlngs).pad(0.9)
    const m = L.map(el.current, {
      zoomControl: false,
      // Credited in the card's one source line.
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      zoomSnap: 0.25,
    })
    L.tileLayer(IMAGERY.esri.url, {
      maxZoom: 19,
      maxNativeZoom: IMAGERY.esri.maxNativeZoom,
    }).addTo(m)
    m.fitBounds(bounds, { animate: false })
    L.polygon(latlngs, { className: 'lc-halo', interactive: false, fill: false }).addTo(m)
    L.polygon(latlngs, { className: 'lc-field', interactive: false }).addTo(m)
    // Phone to projector: keep the field fitted when the card changes width.
    const fit = new ResizeObserver(() => {
      m.invalidateSize()
      m.fitBounds(bounds, { animate: false })
    })
    fit.observe(el.current)
    return () => {
      fit.disconnect()
      m.remove()
    }
  }, [ring])
  return (
    <div
      ref={el}
      role="img"
      aria-label={label}
      className="lc-map isolate mt-3 h-[14rem] w-full overflow-hidden rounded-card bg-[var(--canvas-2)] lg:h-[16.5rem]"
    />
  )
}
