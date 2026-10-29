import { PRODUCT_SOURCE_LABELS, withoutEmDash, type Recommendation } from '@repo/shared'
import { Muted } from '../components/Panel'
import { TIER_NAMES } from '../lib/copy'

// The advice the farmer received: IPM steps in order, chemicals last (label doses verbatim),
// and the guides it cites.
export function AdviceSection({
  recommendation,
}: {
  recommendation: Recommendation | null | undefined
}) {
  if (recommendation === undefined) return <Muted>Loading…</Muted>
  if (recommendation === null)
    return <Muted>No advice was sent: the report is with an officer.</Muted>
  const last = recommendation.ipm_steps.length - 1
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2">
        {recommendation.ipm_steps.map((step, i) => (
          <li key={step} className="flex gap-3 text-label">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-tag border-1.5 border-leaf font-mono text-eyebrow font-semibold text-signal-text">
              {i === last ? 'C' : i + 1}
            </span>
            <span>{withoutEmDash(step)}</span>
          </li>
        ))}
      </ol>
      {recommendation.chemical_options.map(c => (
        <div
          key={c.registration_no}
          className="rounded-card border border-hairline bg-ground p-3 text-label"
        >
          <strong className="font-semibold">{c.trade_name}</strong> ({c.active_ingredient})
          <span className="block font-mono text-caption">
            {c.source === 'plantwise_pmdg'
              ? `Dose (from the guide): ${c.label_dose} · ${PRODUCT_SOURCE_LABELS.plantwise_pmdg}`
              : `Label dose: ${c.label_dose}`}
          </span>
        </div>
      ))}
      <div>
        <p className="eyebrow mb-1">Cited guides</p>
        <ul className="flex flex-col gap-0.5">
          {recommendation.rag_sources.map(s => (
            <li key={s.uri} className="text-label">
              {s.title}
              <span className="ml-1.5 font-mono text-eyebrow uppercase text-attention-text">
                {TIER_NAMES[s.tier] ?? 'Source'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
