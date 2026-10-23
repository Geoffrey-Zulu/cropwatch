import type { ReactNode } from 'react'

// The field slip: a ruled paper tag with a punched notch. Status stamps sit top right.
export function Slip({
  eyebrow,
  stamp,
  children,
  raised = false,
}: {
  eyebrow?: ReactNode
  stamp?: ReactNode
  children: ReactNode
  raised?: boolean
}) {
  return (
    <section
      className={`relative rounded-slip border-2 border-ink bg-slip px-4 pb-4 pt-3 ${raised ? 'shadow-sign' : ''}`}
    >
      <span
        aria-hidden
        className="absolute left-3 top-3 h-3.5 w-3.5 rounded-full border-2 border-ink bg-paper"
      />
      {eyebrow || stamp ? (
        <div className="mb-2 flex min-h-8 items-start justify-between gap-3 pl-6">
          <div className="eyebrow pt-0.5">{eyebrow}</div>
          {stamp}
        </div>
      ) : (
        // No header row: keep the punched hole clear of the content.
        <div aria-hidden className="h-5" />
      )}
      {children}
    </section>
  )
}

// One ruled row on a slip: a mono label and its value.
export function SlipField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-rule py-2 last:border-b-0">
      <dt className="w-24 shrink-0 font-mono text-eyebrow font-semibold uppercase text-ink-2">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-body font-semibold">{children}</dd>
    </div>
  )
}
