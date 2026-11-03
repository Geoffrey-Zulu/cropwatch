import type { ReactNode } from 'react'

// A case card: a white island on the haze, the report's facts in ruled rows, its status tag top
// right. The emphasised card (the report slip) sits a little higher off the ground.
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
      className={`rounded-card bg-panel px-5 pb-5 pt-4 ${emphasis ? 'shadow-island' : 'shadow-island-sm'}`}
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

// One ruled row on a case card: a quiet label and its value.
export function CaseField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-hairline py-2.5 last:border-b-0">
      <dt className="w-24 shrink-0 text-label text-fg-2">{label}</dt>
      <dd className="min-w-0 flex-1 text-body font-semibold">{children}</dd>
    </div>
  )
}
