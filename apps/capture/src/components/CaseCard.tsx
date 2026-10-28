import type { ReactNode } from 'react'

// A case card: the report's facts in ruled rows, its status tag top right.
export function CaseCard({
  eyebrow,
  tag,
  children,
  emphasis = false,
}: {
  eyebrow?: ReactNode
  tag?: ReactNode
  children: ReactNode
  emphasis?: boolean
}) {
  return (
    <section
      className={`rounded-card border bg-sheet px-4 pb-4 pt-3 ${emphasis ? 'border-navy border-t-[3px]' : 'border-line'}`}
    >
      {(eyebrow || tag) && (
        <div className="mb-2 flex min-h-8 items-start justify-between gap-3">
          <div className="eyebrow pt-1">{eyebrow}</div>
          {tag}
        </div>
      )}
      {children}
    </section>
  )
}

// One ruled row on a case card: a data-type label and its value.
export function CaseField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-line py-2 last:border-b-0">
      <dt className="w-24 shrink-0 font-mono text-eyebrow font-semibold uppercase text-ink-2">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-body font-semibold">{children}</dd>
    </div>
  )
}
