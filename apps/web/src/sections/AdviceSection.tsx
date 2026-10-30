import { PRODUCT_SOURCE_LABELS, withoutEmDash, type Recommendation } from '@repo/shared'
import { Muted } from '../components/Panel'
import { SkeletonRows } from '../components/Skeleton'
import { SourceChips } from '../components/SourceChip'

// The advice the farmer received: IPM steps as a compact numbered list, chemicals last with
// their doses verbatim from the product list (CLAUDE.md invariant 1), and every guide it cites
// as a chip that opens the original document.
export function AdviceSection({
  recommendation,
}: {
  recommendation: Recommendation | null | undefined
}) {
  if (recommendation === undefined) return <SkeletonRows rows={4} label="Loading the advice" />
  if (recommendation === null)
    return <Muted>No advice was sent: the report is with an officer.</Muted>
  const last = recommendation.ipm_steps.length - 1
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-1.5">
        {recommendation.ipm_steps.map((step, i) => (
          <li key={step} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2 text-label">
            <span className="mt-px inline-flex h-5 w-5 items-center justify-center rounded-full bg-well text-[11px] font-semibold tabular-nums text-fg-2">
              {i === last ? 'C' : i + 1}
            </span>
            <span>{withoutEmDash(step)}</span>
          </li>
        ))}
      </ol>
      {recommendation.chemical_options.map(c => (
        <div key={c.registration_no} className="rounded-card bg-well px-3 py-2 text-label">
          <strong className="font-semibold">{c.trade_name}</strong> ({c.active_ingredient})
          <span className="block font-mono text-caption">
            {c.source === 'plantwise_pmdg'
              ? `Dose (from the guide): ${c.label_dose} · ${PRODUCT_SOURCE_LABELS.plantwise_pmdg}`
              : `Label dose: ${c.label_dose}`}
          </span>
        </div>
      ))}
      <div>
        <p className="mb-1.5 text-caption text-fg-2">Sources</p>
        <SourceChips sources={recommendation.rag_sources} />
      </div>
    </div>
  )
}
