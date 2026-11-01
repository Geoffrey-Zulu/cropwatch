import { useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  ClipboardList,
  Leaf,
  LocateFixed,
  MapPin,
  ShieldCheck,
  SlidersHorizontal,
  Sprout,
  Wallet,
  Wheat,
} from 'lucide-react'
import { CEIH_STEPS, type CeihStep, type Route } from '../hooks/useRoute'
import { currentPosition, type Point } from '../lib/location'
import { CEIH_EXAMPLE, ceihLedger, kwacha } from '../lib/ceih'
import { DemoBadge } from '../components/DemoBadge'

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

type DemoSeason = {
  checks: boolean[]
  percent: number
  amount: number
  approved: boolean
  sent: boolean
  reconciled: boolean
  provider: 'Airtel' | 'MTN'
}
const initial: DemoSeason = {
  checks: [false, false, false],
  percent: 15,
  amount: 5000,
  approved: false,
  sent: false,
  reconciled: false,
  provider: 'Airtel',
}
function readSeason(uid: string): DemoSeason {
  try {
    const saved = JSON.parse(localStorage.getItem(`phytos:ceih-demo:v1:${uid}`) ?? 'null')
    if (
      saved &&
      Array.isArray(saved.checks) &&
      saved.checks.length === 3 &&
      saved.checks.every((v: unknown) => typeof v === 'boolean') &&
      [10, 15, 20].includes(saved.percent) &&
      Number.isFinite(saved.amount) &&
      saved.amount >= 0 &&
      saved.amount <= 9600 &&
      ['Airtel', 'MTN'].includes(saved.provider) &&
      ['approved', 'sent', 'reconciled'].every(key => typeof saved[key] === 'boolean')
    )
      return saved
  } catch {
    /* A fresh walkthrough remains available if local storage is unavailable. */
  }
  return initial
}

function Row({
  label,
  children,
  strong = false,
}: {
  label: string
  children: ReactNode
  strong?: boolean
}) {
  return (
    <div className={`ceih-row ${strong ? 'ceih-row--strong' : ''}`}>
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
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
  const [point, setPoint] = useState<Point | null>(null)
  const [gps, setGps] = useState<'idle' | 'locating' | 'error'>('idle')
  const [gpsError, setGpsError] = useState('')
  const index = CEIH_STEPS.indexOf(step)
  const meta = steps[index]
  const gross = CEIH_EXAMPLE.projectedKg * CEIH_EXAMPLE.pricePerKg
  const cap = (gross * season.percent) / 100
  const amount = Math.min(season.amount, cap)
  const checked = season.checks.every(Boolean)
  const ledger = ceihLedger(gross, CEIH_EXAMPLE.inputLoan, season.sent ? amount : 0)
  const preview = ceihLedger(gross, CEIH_EXAMPLE.inputLoan, amount)
  const completed = [checked, season.approved, season.sent, season.reconciled]
  const go = (next: CeihStep) => navigate({ page: 'ceih', step: next })
  const update = (patch: Partial<DemoSeason>) => {
    const next = { ...season, ...patch }
    setSeason(next)
    try {
      localStorage.setItem(`phytos:ceih-demo:v1:${uid}`, JSON.stringify(next))
    } catch {
      /* Keep the current walkthrough usable without storage. */
    }
  }
  const locate = async () => {
    setGps('locating')
    try {
      setPoint(await currentPosition())
      setGps('idle')
    } catch (error) {
      setGps('error')
      setGpsError(
        error instanceof Error
          ? error.message
          : 'Location unavailable. Allow location access and try again.'
      )
    }
  }

  return (
    <div className="ceih-app">
      <header className="ceih-header">
        <div className="ceih-header__inner">
          <a href="#/ceih/crop" className="ceih-wordmark">
            PHYTOS<span>outgrower</span>
          </a>
          <button className="ceih-reports" onClick={() => navigate({ page: 'home' })}>
            <ClipboardList size={18} aria-hidden /> Reports
          </button>
        </div>
      </header>

      <main className="ceih-main">
        <div className="ceih-season-label">
          <span>YOUR SEASON, CONNECTED</span>
          <span>0{index + 1} / 04</span>
        </div>
        <div className="ceih-season-bar" aria-label={`Step ${index + 1} of 4`}>
          {steps.map((s, i) => (
            <button
              key={s.id}
              aria-label={`Open ${s.label}`}
              aria-current={step === s.id ? 'step' : undefined}
              className={i <= index ? 'is-active' : ''}
              onClick={() => go(s.id)}
            >
              <span>{completed[i] ? <Check size={12} aria-hidden /> : s.letter}</span>
            </button>
          ))}
        </div>
        <div className="ceih-demo">
          <DemoBadge rows={[{ sim: true }]} />
          <span>CEIH walkthrough</span>
        </div>
        <div className="ceih-title">
          <p>
            {meta.month} <span>·</span> Step {index + 1} of 4
          </p>
          <h1>
            {
              [
                'A healthy crop.\nA stronger season.',
                'Know your\nadvance limit.',
                'Support for the\nmonths between.',
                'Your harvest.\nEvery Kwacha clear.',
              ][index]
            }
          </h1>
        </div>

        {step === 'crop' && (
          <>
            <section className="ceih-hero">
              <div className="ceih-hero__top">
                <span>EXAMPLE FARM</span>
                <Leaf size={24} strokeWidth={1.5} aria-hidden />
              </div>
              <h2>Given’s soybeans</h2>
              <p>
                <MapPin size={14} aria-hidden /> Monze, Southern Province
              </p>
              <div className="ceih-hero__numbers">
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
                  <span>Illustrative yield</span>
                </div>
              </div>
              <div className="ceih-hero__foot">
                <span className={checked ? 'ceih-dot ceih-dot--ready' : 'ceih-dot'} />
                {checked ? 'Demo crop check complete' : 'Ready for a demo crop check'}
              </div>
            </section>
            <section className="ceih-section">
              <div className="ceih-section-heading">
                <h2>Before an advance</h2>
                <span>{season.checks.filter(Boolean).length} of 3</span>
              </div>
              <p className="ceih-muted">Walk through the checks a field agent would record.</p>
              <div className="ceih-checks">
                {['Crop is planted', 'Field is weeded', 'Crop is viable'].map((label, i) => (
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
                    <span
                      className={season.checks[i] ? 'ceih-checkbox is-checked' : 'ceih-checkbox'}
                    >
                      {season.checks[i] && <Check size={16} aria-hidden />}
                    </span>
                    <span>{label}</span>
                    <span className="ceih-check-label">
                      {season.checks[i] ? 'Checked' : 'Tap to check'}
                    </span>
                  </button>
                ))}
              </div>
            </section>
            <section className="ceih-location">
              <div className="ceih-location__icon">
                <LocateFixed size={26} aria-hidden />
              </div>
              <h2>{point ? 'Your device location' : 'Put the visit on the map'}</h2>
              <p>
                {point
                  ? `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`
                  : 'Capture a real GPS point from this phone.'}
              </p>
              {point && (
                <p className="ceih-muted">
                  Device position only. This is not a verified farm boundary.
                </p>
              )}
              <button className="ceih-secondary" disabled={gps === 'locating'} onClick={locate}>
                {gps === 'locating'
                  ? 'Finding your location'
                  : point
                    ? 'Update GPS point'
                    : 'Capture GPS point'}
                <LocateFixed size={16} aria-hidden />
              </button>
              {point && (
                <a
                  className="ceih-map-link"
                  href={`https://maps.apple.com/?ll=${point.latitude},${point.longitude}&q=Captured%20device%20location`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View actual point in Maps <ArrowUpRight size={16} aria-hidden />
                </a>
              )}
              {gps === 'error' && (
                <p className="ceih-error" role="alert">
                  {gpsError}
                </p>
              )}
            </section>
            <p className="ceih-footnote">
              Satellite crop-health assessment is not connected. These demo checks do not certify
              yield.
            </p>
            <button className="ceih-primary" onClick={() => go('eligibility')}>
              Explore eligibility <ArrowRight size={20} aria-hidden />
            </button>
          </>
        )}

        {step === 'eligibility' && (
          <>
            <section className="ceih-hero">
              <div className="ceih-hero__top">
                <span>PROJECTED HARVEST VALUE</span>
                <SlidersHorizontal size={23} strokeWidth={1.5} aria-hidden />
              </div>
              <div className="ceih-big-money">{kwacha(gross)}</div>
              <p>4,800 kg of soybeans × K 10.00 per kg</p>
              <div className="ceih-hero__foot">Illustration, not a guaranteed harvest price</div>
            </section>
            <section className="ceih-section">
              <div className="ceih-section-heading">
                <h2>A conservative cap</h2>
                <strong className="ceih-percent">{season.percent}%</strong>
              </div>
              <p className="ceih-muted">
                Explore an advance between 10% and 20% of projected value.
              </p>
              <div className="ceih-segmented">
                {[10, 15, 20].map(percent => (
                  <button
                    key={percent}
                    aria-pressed={season.percent === percent}
                    disabled={season.sent}
                    className={season.percent === percent ? 'is-active' : ''}
                    onClick={() =>
                      update({
                        percent,
                        amount: Math.min(season.amount, (gross * percent) / 100),
                        approved: false,
                      })
                    }
                  >
                    {percent}%
                  </button>
                ))}
              </div>
              <Row label="Advance limit" strong>
                {kwacha(cap)}
              </Row>
              <div className="ceih-value-bar">
                <span style={{ width: `${season.percent}%` }} />
              </div>
              <div className="ceih-bar-key">
                <span>
                  <i /> Advance
                </span>
                <span>{100 - season.percent}% retained for harvest</span>
              </div>
            </section>
            <section className="ceih-section">
              <div className="ceih-section-heading">
                <label htmlFor="ceih-amount">Example advance</label>
                <strong>{kwacha(amount)}</strong>
              </div>
              <input
                id="ceih-amount"
                className="ceih-range"
                type="range"
                min="100"
                max={cap}
                step="100"
                value={amount}
                disabled={season.sent}
                onChange={e => update({ amount: Number(e.target.value), approved: false })}
              />
              <div className="ceih-range-labels">
                <span>K 100</span>
                <span>{kwacha(cap)}</span>
              </div>
              <Row label="Farmer fee · 5%">{kwacha(preview.fee)}</Row>
              <Row label="Deducted at harvest">{kwacha(amount + preview.fee)}</Row>
            </section>
            <div className="ceih-note">
              <ShieldCheck size={22} aria-hidden />
              <div>
                <h3>{checked ? 'Demo checks complete' : 'Crop check comes first'}</h3>
                <p>
                  {checked
                    ? 'You can review the example advance. This is not a credit approval.'
                    : 'Complete the three crop checks to unlock the demo advance.'}
                </p>
              </div>
            </div>
            <button
              className="ceih-primary"
              disabled={!checked}
              onClick={() => {
                update({ approved: true })
                go('advance')
              }}
            >
              Review demo advance <ArrowRight size={20} aria-hidden />
            </button>
            {!checked && (
              <button className="ceih-text-button" onClick={() => go('crop')}>
                Return to crop check
              </button>
            )}
          </>
        )}

        {step === 'advance' && (
          <>
            <section className="ceih-hero">
              <div className="ceih-hero__top">
                <span>
                  {season.sent ? 'DEMO TRANSFER RECORDED' : 'EXAMPLE MOBILE-MONEY ADVANCE'}
                </span>
                <Wallet size={24} strokeWidth={1.5} aria-hidden />
              </div>
              <div className="ceih-big-money">{kwacha(amount)}</div>
              <p>
                {season.sent
                  ? 'Simulated only. No money has moved.'
                  : 'For food, school fees and the season ahead.'}
              </p>
              <div className="ceih-hero__foot">
                <span className={season.sent ? 'ceih-dot ceih-dot--ready' : 'ceih-dot'} />
                {season.sent
                  ? 'Recorded in the demo ledger'
                  : season.approved
                    ? 'Demo eligibility reviewed'
                    : 'Eligibility review needed'}
              </div>
            </section>
            <section className="ceih-section">
              <div className="ceih-section-heading">
                <h2>Choose an example wallet</h2>
              </div>
              <div className="ceih-wallets">
                {(['Airtel', 'MTN'] as const).map(provider => (
                  <button
                    key={provider}
                    disabled={season.sent}
                    className={season.provider === provider ? 'is-active' : ''}
                    aria-pressed={season.provider === provider}
                    onClick={() => update({ provider })}
                  >
                    <span
                      className={`ceih-wallet-logo ceih-wallet-logo--${provider.toLowerCase()}`}
                    >
                      {provider === 'Airtel' ? 'a' : 'MTN'}
                    </span>
                    <span>{provider} Money</span>
                    {season.provider === provider && <Check size={18} aria-hidden />}
                  </button>
                ))}
              </div>
              <p className="ceih-footnote">
                Example wallet only. No phone number is collected and no payment provider is
                connected.
              </p>
            </section>
            <section className="ceih-section">
              <h2>What happens at harvest</h2>
              <Row label="Advance principal">{kwacha(amount)}</Row>
              <Row label="Farmer fee · 5%">{kwacha(preview.fee)}</Row>
              <Row label="Total advance deduction" strong>
                {kwacha(amount + preview.fee)}
              </Row>
              <p className="ceih-muted">
                The original input loan is deducted separately when the crop is delivered.
              </p>
            </section>
            <div className="ceih-note">
              <ShieldCheck size={22} aria-hidden />
              <div>
                <h3>Proposed weather cover</h3>
                <p>
                  Insurance terms, satellite triggers and insurer payouts are not connected. This
                  example has no active cover.
                </p>
              </div>
            </div>
            {season.sent ? (
              <button className="ceih-primary" onClick={() => go('harvest')}>
                View harvest ledger <ArrowRight size={20} aria-hidden />
              </button>
            ) : (
              <button
                className="ceih-primary"
                disabled={!season.approved || !checked}
                onClick={() => update({ sent: true })}
              >
                Simulate disbursement <ArrowRight size={20} aria-hidden />
              </button>
            )}
            {!season.approved && (
              <button className="ceih-text-button" onClick={() => go('eligibility')}>
                Review eligibility first
              </button>
            )}
            {season.sent && (
              <p className="ceih-success" role="status">
                <CheckCheck size={18} aria-hidden /> Demo advance saved on this device
              </p>
            )}
          </>
        )}

        {step === 'harvest' && (
          <>
            <section className="ceih-hero">
              <div className="ceih-hero__top">
                <span>
                  {season.reconciled ? 'DEMO HARVEST RECONCILED' : 'ILLUSTRATIVE NET PAYOUT'}
                </span>
                <Wheat size={24} strokeWidth={1.5} aria-hidden />
              </div>
              <div className="ceih-big-money">{kwacha(ledger.payout)}</div>
              <p>After the input loan and recorded advance costs.</p>
              <div className="ceih-hero__foot">Example delivery · 4,800 kg at K 10.00 / kg</div>
            </section>
            <section className="ceih-section">
              <div className="ceih-section-heading">
                <h2>Your harvest ledger</h2>
                <span>Kwacha · ZMW</span>
              </div>
              <Row label="Gross harvest value">{kwacha(ledger.gross)}</Row>
              <Row label="Input loan">− {kwacha(ledger.inputs)}</Row>
              <Row label={season.sent ? 'January advance' : 'Advance · not simulated'}>
                − {kwacha(ledger.advance)}
              </Row>
              <Row label="Advance fee · 5%">− {kwacha(ledger.fee)}</Row>
              <Row label="Farmer receives" strong>
                {kwacha(ledger.payout)}
              </Row>
              <p className="ceih-muted">
                Every deduction is shown. This is a model ledger, not a receipt or payment
                confirmation.
              </p>
            </section>
            <section className="ceih-company-fee">
              <h3>Paid by the agribusiness</h3>
              <p>
                The proposed 2% software fee is <strong>{kwacha(ledger.companyFee)}</strong> on this
                harvest. It is not deducted from the farmer’s payout above.
              </p>
            </section>
            <div className="ceih-note">
              <Wheat size={22} aria-hidden />
              <div>
                <h3>One season, one clear record</h3>
                <p>
                  Crop checks, eligibility and the example advance stay together through harvest.
                </p>
              </div>
            </div>
            <button
              className="ceih-primary"
              disabled={season.reconciled}
              onClick={() => update({ reconciled: true })}
            >
              {season.reconciled ? 'Demo reconciliation saved' : 'Reconcile demo harvest'}
              <Check size={20} aria-hidden />
            </button>
            {season.reconciled && (
              <p className="ceih-success" role="status">
                <CheckCheck size={18} aria-hidden /> No real payout has been sent
              </p>
            )}
            <button
              className="ceih-text-button"
              onClick={() => {
                update(initial)
                go('crop')
              }}
            >
              Start the walkthrough again
            </button>
          </>
        )}

        <div className="ceih-bottom-links">
          {index > 0 && (
            <button onClick={() => go(CEIH_STEPS[index - 1])}>
              <ArrowLeft size={16} aria-hidden /> {steps[index - 1].label}
            </button>
          )}
          <button onClick={() => navigate({ page: 'home' })}>
            Crop reports <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      </main>

      <nav className="ceih-nav" aria-label="CEIH season">
        <div>
          {steps.map(s => (
            <button
              key={s.id}
              aria-current={step === s.id ? 'page' : undefined}
              className={step === s.id ? 'is-active' : ''}
              onClick={() => go(s.id)}
            >
              <s.icon size={23} strokeWidth={step === s.id ? 2.2 : 1.7} aria-hidden />
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
