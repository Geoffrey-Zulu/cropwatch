import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Leaf,
  LocateFixed,
  MapPin,
  ReceiptText,
  ShieldCheck,
  SlidersHorizontal,
  Sprout,
  Wallet,
  Wheat,
  X,
} from 'lucide-react'
import { findDistrict } from '@repo/shared'
import { CEIH_STEPS, type CeihStep, type Route } from '../hooks/useRoute'
import { currentPosition, type Point } from '../lib/location'
import { CEIH_EXAMPLE, ceihLedger, kwacha } from '../lib/ceih'
import { DemoBadge } from '../components/DemoBadge'
import { TownMap } from '../components/TownMap'
import './ceih.css'

const steps = [
  { id: 'crop', letter: 'C', label: 'Crop check', icon: Sprout, month: 'December' },
  {
    id: 'eligibility',
    letter: 'E',
    label: 'Eligibility',
    icon: SlidersHorizontal,
    month: 'December',
  },
  { id: 'advance', letter: 'I', label: 'Advance', icon: Wallet, month: 'January' },
  { id: 'harvest', letter: 'H', label: 'Harvest', icon: Wheat, month: 'June' },
] as const

type Season = {
  checks: boolean[]
  percent: number
  amount: number
  approved: boolean
  sent: boolean
  reconciled: boolean
  provider: 'Airtel' | 'MTN'
}
const initial: Season = {
  checks: [false, false, false],
  percent: 15,
  amount: 5000,
  approved: false,
  sent: false,
  reconciled: false,
  provider: 'Airtel',
}
function readSeason(uid: string): Season {
  try {
    const saved = JSON.parse(localStorage.getItem(`phytos:ceih-demo:v1:${uid}`) ?? 'null')
    if (
      saved &&
      Array.isArray(saved.checks) &&
      saved.checks.length === 3 &&
      saved.checks.every((v: unknown) => typeof v === 'boolean') &&
      [10, 15, 20].includes(saved.percent) &&
      Number.isFinite(saved.amount) &&
      saved.amount >= 100 &&
      saved.amount <= 9600 &&
      ['Airtel', 'MTN'].includes(saved.provider) &&
      ['approved', 'sent', 'reconciled'].every(k => typeof saved[k] === 'boolean')
    )
      return saved
  } catch {
    /* The walkthrough can run without local storage. */
  }
  return initial
}
function readPoint(uid: string): Point | null {
  try {
    const p = JSON.parse(localStorage.getItem(`phytos:ceih-visit:${uid}`) ?? 'null')
    if (
      p &&
      Number.isFinite(p.latitude) &&
      Math.abs(p.latitude) <= 90 &&
      Number.isFinite(p.longitude) &&
      Math.abs(p.longitude) <= 180
    )
      return p
  } catch {
    /* GPS capture remains available if storage is unavailable. */
  }
  return null
}
function Money({ amount, large = false }: { amount: number; large?: boolean }) {
  return (
    <span className={large ? 'season-money season-money--large' : 'season-money'}>
      {kwacha(amount)}
    </span>
  )
}
function Line({
  label,
  children,
  total = false,
}: {
  label: string
  children: ReactNode
  total?: boolean
}) {
  return (
    <div className={`statement-line ${total ? 'statement-line--total' : ''}`}>
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  )
}
function CapabilityNote({ children }: { children: ReactNode }) {
  return (
    <details className="season-scope">
      <summary>About this demo</summary>
      <p>
        {children} Example records stay on this device. No credit decision or real payment is made.
      </p>
    </details>
  )
}

export function CeihPage({
  uid,
  step,
  navigate,
}: {
  uid: string
  step: CeihStep
  navigate: (route: Route) => void
}) {
  const [season, setSeason] = useState(() => readSeason(uid))
  const [point, setPoint] = useState(() => readPoint(uid))
  const [gps, setGps] = useState<'idle' | 'locating' | 'error'>('idle')
  const [gpsError, setGpsError] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [input, setInput] = useState<'pointer' | 'keyboard'>('pointer')
  const [online, setOnline] = useState(() => navigator.onLine)
  const sheet = useRef<HTMLDialogElement>(null)
  const index = CEIH_STEPS.indexOf(step)
  const meta = steps[index]
  const checkedCount = season.checks.filter(Boolean).length
  const checked = checkedCount === 3
  const gross = CEIH_EXAMPLE.projectedKg * CEIH_EXAMPLE.pricePerKg
  const cap = (gross * season.percent) / 100
  const amount = Math.min(season.amount, cap)
  const preview = ceihLedger(gross, CEIH_EXAMPLE.inputLoan, amount)
  const ledger = ceihLedger(gross, CEIH_EXAMPLE.inputLoan, season.sent ? amount : 0)
  const completed = [checked, season.approved, season.sent, season.reconciled]
  const monze = findDistrict('Monze')!.center
  const go = (next: CeihStep) => navigate({ page: 'ceih', step: next })
  const update = (patch: Partial<Season>) => {
    const next = { ...season, ...patch }
    setSeason(next)
    try {
      localStorage.setItem(`phytos:ceih-demo:v1:${uid}`, JSON.stringify(next))
    } catch {
      /* Keep the walkthrough usable without storage. */
    }
  }
  useEffect(() => {
    const dialog = sheet.current
    if (!dialog) return
    if (reviewOpen && !dialog.open) dialog.showModal()
    if (!reviewOpen && dialog.open) dialog.close()
    if (!reviewOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [reviewOpen])
  useEffect(() => {
    setReviewOpen(false)
  }, [step])
  useEffect(() => {
    const refresh = () => setOnline(navigator.onLine)
    window.addEventListener('online', refresh)
    window.addEventListener('offline', refresh)
    return () => {
      window.removeEventListener('online', refresh)
      window.removeEventListener('offline', refresh)
    }
  }, [])
  const locate = async () => {
    setGps('locating')
    try {
      const position = await currentPosition()
      setPoint(position)
      setGps('idle')
      try {
        localStorage.setItem(`phytos:ceih-visit:${uid}`, JSON.stringify(position))
      } catch {
        /* The point stays available for this session. */
      }
    } catch (error) {
      setGps('error')
      setGpsError(error instanceof Error ? error.message : 'Allow location access and try again.')
    }
  }

  return (
    <div
      className="season-app"
      data-input={input}
      onPointerDownCapture={() => setInput('pointer')}
      onKeyDownCapture={() => setInput('keyboard')}
    >
      <header className="season-header">
        <div className="season-header-inner">
          <a className="season-brand" href="#/ceih/crop">
            <span className="season-brand-mark">
              <Leaf size={19} strokeWidth={1.8} aria-hidden />
            </span>
            <strong>phytos</strong>
            <span className="season-brand-divider" />
            <small>Outgrower</small>
          </a>
          <button
            className="season-icon-button"
            aria-label="Open crop reports"
            onClick={() => navigate({ page: 'home' })}
          >
            <ClipboardList size={21} strokeWidth={1.7} aria-hidden />
          </button>
        </div>
      </header>
      <main className="season-main">
        <div className="season-account">
          <div className="season-avatar" aria-hidden>
            G
          </div>
          <div>
            <strong>Given’s season</strong>
            <span>Soybeans · Monze · 2026/27</span>
          </div>
          <div className="season-demo-mode">
            <DemoBadge rows={[{ sim: true }]} />
          </div>
        </div>
        <div className="season-stage-heading">
          <div>
            <p>
              {meta.letter} <span>/</span> {meta.month}
            </p>
            <h1>
              {['Crop check', 'Eligible advance', 'Your advance', 'Harvest statement'][index]}
            </h1>
          </div>
          <span className="season-stage-count">
            0{index + 1}
            <span> / 04</span>
          </span>
        </div>

        {step === 'crop' && (
          <>
            <section className="field-panel" aria-label="Example soybean field">
              <div className="field-map">
                <TownMap center={monze} online={online} />
                <span className="field-map-label">
                  <MapPin size={13} aria-hidden /> Monze town overview
                </span>
                <a
                  className="field-map-open"
                  href={`https://www.openstreetmap.org/#map=13/${monze.latitude}/${monze.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open map <ArrowUpRight size={14} aria-hidden />
                </a>
              </div>
              <div className="field-panel-body">
                <div>
                  <p className="season-overline">EXAMPLE FIELD · CW-001</p>
                  <h2>Soybean plot</h2>
                </div>
                <span className={`season-tag ${checked ? 'season-tag--green' : ''}`}>
                  {checked ? 'Checks recorded' : 'Visit due'}
                </span>
              </div>
              <div className="field-measures">
                <div>
                  <strong>
                    2.4 <small>ha</small>
                  </strong>
                  <span>Area planted</span>
                </div>
                <div>
                  <strong>
                    4,800 <small>kg</small>
                  </strong>
                  <span>Expected harvest</span>
                </div>
                <div>
                  <strong>K 10.00</strong>
                  <span>Example price / kg</span>
                </div>
              </div>
            </section>
            <section className="season-section">
              <div className="season-section-title">
                <h2>Field verification</h2>
                <span>{checkedCount} of 3 complete</span>
              </div>
              <div className="field-check-list">
                {[
                  ['Crop established', 'Planting and crop establishment checked'],
                  ['Field maintained', 'Weeding and field management checked'],
                  ['Crop viable', 'Visible crop condition checked'],
                ].map(([label, hint], i) => (
                  <button
                    key={label}
                    role="checkbox"
                    aria-checked={season.checks[i]}
                    disabled={season.sent}
                    onClick={() =>
                      update({
                        checks: season.checks.map((v, n) => (n === i ? !v : v)),
                        approved: false,
                      })
                    }
                  >
                    <span className={`field-checkbox ${season.checks[i] ? 'is-checked' : ''}`}>
                      <Check size={15} strokeWidth={2.7} aria-hidden />
                    </span>
                    <span>
                      <strong>{label}</strong>
                      <small>{hint}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
            <section className="visit-location">
              <LocateFixed size={21} aria-hidden />
              <div>
                <h3>{point ? 'Visit point saved' : 'Add a visit point'}</h3>
                <p>
                  {point
                    ? `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`
                    : 'Capture this phone’s GPS position, even offline.'}
                </p>
                {point && <span>Device position only, not a farm boundary.</span>}
              </div>
              <button
                className="season-small-button"
                disabled={gps === 'locating'}
                onClick={locate}
              >
                {gps === 'locating' ? 'Locating' : point ? 'Update' : 'Capture'}
              </button>
            </section>
            {point && (
              <a
                className="season-map-link"
                href={`https://maps.apple.com/?ll=${point.latitude},${point.longitude}&q=Captured%20device%20position`}
                target="_blank"
                rel="noreferrer"
              >
                Open saved point in Maps <ExternalLink size={14} aria-hidden />
              </a>
            )}
            {gps === 'error' && (
              <p className="season-error" role="alert">
                {gpsError}
              </p>
            )}
            <button className="season-tool-row" onClick={() => navigate({ page: 'diagnose' })}>
              <span className="season-tool-icon">
                <Leaf size={19} aria-hidden />
              </span>
              <span>
                <strong>Crop diagnosis</strong>
                <small>Photograph symptoms and get crop advice</small>
              </span>
              <ChevronRight size={17} aria-hidden />
            </button>
            <div className="season-next">
              <p>
                {checked
                  ? 'Crop checks recorded in this demo.'
                  : 'Complete the field checks before reviewing eligibility.'}
              </p>
              <button className="season-primary" onClick={() => go('eligibility')}>
                View eligibility <ArrowRight size={18} aria-hidden />
              </button>
            </div>
            <CapabilityNote>
              The map is a real town overview. Field checks and yield are illustrative; satellite
              crop-health verification is not connected.
            </CapabilityNote>
          </>
        )}

        {step === 'eligibility' && (
          <>
            <section className="eligibility-balance">
              <div className="eligibility-balance-top">
                <span className={`season-tag ${checked ? 'season-tag--green' : ''}`}>
                  <span className="season-status-dot" />
                  {checked ? 'Crop checks complete' : 'Crop checks needed'}
                </span>
                <span className="season-currency">ZMW</span>
              </div>
              <p className="balance-caption">Available in this example</p>
              <Money amount={cap} large />
              <p className="balance-description">
                {season.percent}% of your projected harvest value
              </p>
              <div className="capital-allocation">
                <span style={{ transform: `scaleX(${season.percent / 100})` }} />
              </div>
              <div className="capital-legend">
                <span>
                  <i />
                  Advance limit
                </span>
                <span>{100 - season.percent}% reserved for harvest</span>
              </div>
            </section>
            <section className="season-section">
              <div className="season-section-title">
                <h2>Choose an amount</h2>
                <span>Within your cap</span>
              </div>
              <div className="amount-selector">
                <Money amount={amount} />
                <span>Zambian Kwacha</span>
                <input
                  aria-label="Example advance amount"
                  type="range"
                  min="100"
                  max={cap}
                  step="100"
                  value={amount}
                  disabled={season.sent}
                  onChange={e => update({ amount: Number(e.target.value), approved: false })}
                />
                <div>
                  <span>K 100</span>
                  <span>{kwacha(cap)}</span>
                </div>
              </div>
            </section>
            <section className="season-panel">
              <h2>Repayment at harvest</h2>
              <Line label="Advance principal">
                <Money amount={amount} />
              </Line>
              <Line label="Convenience fee · 5%">
                <Money amount={preview.fee} />
              </Line>
              <Line label="Total to repay" total>
                <Money amount={amount + preview.fee} />
              </Line>
            </section>
            <details className="cap-policy">
              <summary>
                <SlidersHorizontal size={17} aria-hidden />
                <span>Example cap policy</span>
                <strong>{season.percent}%</strong>
                <ChevronRight size={15} aria-hidden />
              </summary>
              <p>
                Explore the proposed 10–20% advance range. A live limit would be set by the lender.
              </p>
              <div className="policy-options" role="group" aria-label="Example advance cap">
                {[10, 15, 20].map(percent => (
                  <button
                    key={percent}
                    aria-pressed={season.percent === percent}
                    disabled={season.sent}
                    onClick={() =>
                      update({
                        percent,
                        amount: Math.min(amount, (gross * percent) / 100),
                        approved: false,
                      })
                    }
                  >
                    {percent}%
                  </button>
                ))}
              </div>
              <Line label="Projected harvest value">
                <Money amount={gross} />
              </Line>
            </details>
            <button
              className="season-primary"
              disabled={!checked}
              onClick={() => {
                update({ approved: true })
                go('advance')
              }}
            >
              Continue to wallet <ArrowRight size={18} aria-hidden />
            </button>
            {!checked && (
              <button className="season-text-button" onClick={() => go('crop')}>
                Complete the crop checks
              </button>
            )}
            <CapabilityNote>
              The advance cap, projected price and eligibility state are an interactive model, not a
              lending approval.
            </CapabilityNote>
          </>
        )}

        {step === 'advance' && (
          <>
            <section className={`advance-card ${season.sent ? 'advance-card--sent' : ''}`}>
              <div className="advance-card-top">
                <span>
                  <Wallet size={18} aria-hidden />
                  Season advance
                </span>
                <span>JAN</span>
              </div>
              <p>{season.sent ? 'Demo transfer recorded' : 'Amount to receive'}</p>
              <Money amount={amount} large />
              <div className="advance-card-bottom">
                <span>
                  {season.sent ? (
                    <CheckCheck size={16} aria-hidden />
                  ) : (
                    <ShieldCheck size={16} aria-hidden />
                  )}
                  {season.sent ? 'Saved to this device' : 'Deducted from harvest proceeds'}
                </span>
                <span>CW-001</span>
              </div>
            </section>
            {season.sent ? (
              <div className="transfer-success" role="status">
                <span>
                  <Check size={19} aria-hidden />
                </span>
                <div>
                  <strong>Demo advance saved</strong>
                  <p>No money moved. The harvest ledger now includes this advance.</p>
                </div>
              </div>
            ) : (
              <div className="season-inline-note">
                Support between planting and harvest. Review the amount and fees before confirming
                the example.
              </div>
            )}
            <section className="season-section">
              <div className="season-section-title">
                <h2>Receive with mobile money</h2>
                <span>Demo wallets</span>
              </div>
              <div className="wallet-options">
                {(['Airtel', 'MTN'] as const).map(provider => (
                  <button
                    key={provider}
                    aria-pressed={season.provider === provider}
                    disabled={season.sent}
                    onClick={() => update({ provider })}
                  >
                    <span className={`wallet-provider wallet-provider--${provider.toLowerCase()}`}>
                      {provider === 'Airtel' ? 'A' : 'M'}
                    </span>
                    <span>
                      <strong>{provider === 'Airtel' ? 'Airtel Money' : 'MTN MoMo'}</strong>
                      <small>Example wallet · ••• 4201</small>
                    </span>
                    <span className="wallet-radio">
                      <span />
                    </span>
                  </button>
                ))}
              </div>
            </section>
            <section className="season-panel advance-cost">
              <h2>Advance breakdown</h2>
              <Line label="You receive">
                <Money amount={amount} />
              </Line>
              <Line label="Fee, paid at harvest">
                <Money amount={preview.fee} />
              </Line>
              <Line label="Harvest deduction" total>
                <Money amount={amount + preview.fee} />
              </Line>
            </section>
            <div className="weather-cover">
              <ShieldCheck size={20} aria-hidden />
              <div>
                <h3>Weather-index protection</h3>
                <p>Proposed cover, subject to insurer terms.</p>
              </div>
              <span>Not active</span>
            </div>
            {season.sent ? (
              <button className="season-primary" onClick={() => go('harvest')}>
                Open harvest statement <ArrowRight size={18} aria-hidden />
              </button>
            ) : (
              <button
                className="season-primary"
                disabled={!season.approved || !checked}
                onClick={() => setReviewOpen(true)}
              >
                Review demo transfer <ArrowRight size={18} aria-hidden />
              </button>
            )}
            {!season.approved && (
              <button className="season-text-button" onClick={() => go('eligibility')}>
                Review eligibility first
              </button>
            )}
            <CapabilityNote>
              Mobile-money providers and weather insurance are not connected. Example wallets cannot
              receive real funds.
            </CapabilityNote>
          </>
        )}

        {step === 'harvest' && (
          <>
            <div className="harvest-status">
              <span className="statement-icon">
                <ReceiptText size={25} strokeWidth={1.6} aria-hidden />
              </span>
              <div>
                <h2>{season.reconciled ? 'Statement reconciled' : 'Ready to reconcile'}</h2>
                <p>Example delivery · June 2027</p>
              </div>
              <span className={`season-tag ${season.reconciled ? 'season-tag--green' : ''}`}>
                {season.reconciled ? 'Saved' : 'Draft'}
              </span>
            </div>
            <section className="harvest-receipt">
              <div className="receipt-heading">
                <span>PHYTOS / HARVEST LEDGER</span>
                <span>CW-001</span>
              </div>
              <div className="receipt-payee">
                <span>Given’s soybean season</span>
                <p>4,800 kg × K 10.00 per kg</p>
              </div>
              <Line label="Gross crop value">
                <Money amount={gross} />
              </Line>
              <div className="receipt-deductions">
                <p>DEDUCTIONS</p>
                <Line label="Input loan">
                  <span>− </span>
                  <Money amount={ledger.inputs} />
                </Line>
                <Line label={season.sent ? 'January cash advance' : 'Cash advance · not recorded'}>
                  <span>− </span>
                  <Money amount={ledger.advance} />
                </Line>
                <Line label="Advance fee · 5%">
                  <span>− </span>
                  <Money amount={ledger.fee} />
                </Line>
              </div>
              <div className="receipt-net">
                <div>
                  <span>Net farmer payout</span>
                  <span>ZMW</span>
                </div>
                <Money amount={ledger.payout} large />
                <p>
                  {season.reconciled
                    ? 'Recorded in the demo ledger'
                    : 'Calculated from the example above'}
                </p>
              </div>
              <div className="receipt-bottom">
                <ShieldCheck size={15} aria-hidden />A model statement, not a payment receipt
              </div>
            </section>
            <div className="business-fee">
              <span className="business-fee-icon">
                <ArrowDownLeft size={18} aria-hidden />
              </span>
              <div>
                <strong>Agribusiness software fee</strong>
                <p>
                  2% of harvest value · <Money amount={ledger.companyFee} />
                </p>
                <small>Paid by the agribusiness. Excluded from farmer deductions.</small>
              </div>
            </div>
            <button
              className="season-primary"
              disabled={season.reconciled}
              onClick={() => update({ reconciled: true })}
            >
              {season.reconciled ? 'Demo reconciliation saved' : 'Reconcile demo harvest'}
              <Check size={18} aria-hidden />
            </button>
            {season.reconciled && (
              <p className="season-saved-status" role="status">
                No real payout has been sent
              </p>
            )}
            <button
              className="season-text-button"
              onClick={() => {
                update(initial)
                go('crop')
              }}
            >
              Reset example season
            </button>
            <CapabilityNote>
              The ledger calculates deductions locally. Depot intake, live pricing and payout
              settlement are not connected.
            </CapabilityNote>
          </>
        )}
      </main>
      <nav className="season-nav" aria-label="CEIH season">
        <div>
          {steps.map((s, i) => (
            <button
              key={s.id}
              aria-current={step === s.id ? 'page' : undefined}
              onClick={() => go(s.id)}
            >
              <span className="season-nav-icon">
                <s.icon size={22} strokeWidth={step === s.id ? 2 : 1.6} aria-hidden />
                {completed[i] && <i />}
              </span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </nav>
      <dialog
        ref={sheet}
        className="transfer-sheet"
        aria-labelledby="transfer-review-title"
        onClose={() => setReviewOpen(false)}
        onClick={e => {
          if (e.target === e.currentTarget) setReviewOpen(false)
        }}
        data-input={input}
      >
        <div className="transfer-sheet-body">
          <div className="sheet-handle" />
          <button
            className="season-icon-button sheet-close"
            aria-label="Close transfer review"
            onClick={() => setReviewOpen(false)}
          >
            <X size={21} aria-hidden />
          </button>
          <span className="sheet-wallet">
            <Wallet size={27} strokeWidth={1.6} aria-hidden />
          </span>
          <h2 id="transfer-review-title">Review demo transfer</h2>
          <p className="sheet-description">This records an example advance. No money will move.</p>
          <Money amount={amount} large />
          <div className="sheet-destination">
            <span className={`wallet-provider wallet-provider--${season.provider.toLowerCase()}`}>
              {season.provider === 'Airtel' ? 'A' : 'M'}
            </span>
            <div>
              <strong>{season.provider === 'Airtel' ? 'Airtel Money' : 'MTN MoMo'}</strong>
              <span>Example wallet · ••• 4201</span>
            </div>
          </div>
          <Line label="Fee due at harvest">
            <Money amount={preview.fee} />
          </Line>
          <Line label="Total harvest deduction" total>
            <Money amount={amount + preview.fee} />
          </Line>
          <button
            className="season-primary"
            onClick={() => {
              update({ sent: true })
              setReviewOpen(false)
            }}
          >
            Confirm demo transfer <Check size={18} aria-hidden />
          </button>
          <button className="season-text-button" onClick={() => setReviewOpen(false)}>
            Go back
          </button>
        </div>
      </dialog>
    </div>
  )
}
