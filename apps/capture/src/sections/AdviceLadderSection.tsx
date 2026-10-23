import { UserCheck } from 'lucide-react'
import type { RecommendationView } from '@repo/shared'

// The IPM ladder: steps in the order the API gives them (scout → field practice → natural
// control), on a rail, with chemicals always the last rung. A chemical rung shows only
// registered products with their label dose verbatim; otherwise it is the officer referral.
export function AdviceLadderSection({ recommendation }: { recommendation: RecommendationView }) {
  const steps = recommendation.ipm_steps.slice(0, -1)
  const chemicalLine = recommendation.ipm_steps[recommendation.ipm_steps.length - 1]

  return (
    <ol aria-label="What to do, step by step" className="relative flex flex-col gap-4 pl-9">
      <span aria-hidden className="absolute bottom-2 left-[11px] top-2 w-1 bg-ink" />
      {steps.map((step, i) => (
        <Rung key={step} index={i} label={`Step ${i + 1}`}>
          <p className="text-body">{step}</p>
        </Rung>
      ))}
      <Rung index={steps.length} label="Chemicals">
        {recommendation.chemical_options.length > 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-body">{chemicalLine}</p>
            {recommendation.chemical_options.map(option => (
              <div
                key={option.registration_no}
                className="rounded-slip border-2 border-ink bg-slip p-3"
              >
                <p className="text-body font-extrabold">{option.trade_name}</p>
                <p className="text-label font-semibold text-ink-2">{option.active_ingredient}</p>
                <dl className="mt-2 flex flex-col gap-1 font-mono text-data">
                  <div>
                    <dt className="inline text-ink-2">Label dose: </dt>
                    <dd className="inline">{option.label_dose}</dd>
                  </div>
                  <div>
                    <dt className="inline text-ink-2">Wait before harvest: </dt>
                    <dd className="inline">{option.phi_days} days</dd>
                  </div>
                  <div>
                    <dt className="inline text-ink-2">Reg. no: </dt>
                    <dd className="inline">{option.registration_no}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-3 rounded-slip border-2 border-ink bg-maize p-3 text-ink">
            <UserCheck size={24} strokeWidth={2.25} aria-hidden className="mt-0.5 shrink-0" />
            <p className="text-body font-semibold">{chemicalLine}</p>
          </div>
        )}
      </Rung>
    </ol>
  )
}

function Rung({
  index,
  label,
  children,
}: {
  index: number
  label: string
  children: React.ReactNode
}) {
  return (
    <li className="relative animate-rung" style={{ animationDelay: `${index * 80}ms` }}>
      <span
        aria-hidden
        className="absolute -left-9 top-1 h-6 w-6 rounded-[3px] border-2 border-ink bg-slip shadow-sign-sm"
      />
      <p className="eyebrow mb-1">{label}</p>
      {children}
    </li>
  )
}

// While advice is being found: the empty rail, so the layout does not jump when it lands.
export function AdvicePending({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-body font-semibold text-ink-2">{text}…</p>
      <div aria-hidden className="relative flex flex-col gap-4 pl-9 opacity-50">
        <span className="absolute bottom-2 left-[11px] top-2 w-1 bg-ink" />
        {[0, 1, 2].map(i => (
          <div key={i} className="relative">
            <span className="absolute -left-9 top-1 h-6 w-6 rounded-[3px] border-2 border-ink bg-slip" />
            <div className="h-3 w-16 bg-rule" />
            <div className="mt-2 h-4 w-full bg-rule" />
            <div className="mt-1 h-4 w-3/4 bg-rule" />
          </div>
        ))}
      </div>
    </div>
  )
}
