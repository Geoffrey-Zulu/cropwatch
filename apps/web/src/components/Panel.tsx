import type { ReactNode } from 'react'

// A console panel: mono kicker, grotesque title, optional actions, then content.
export function Panel({
  eyebrow,
  title,
  actions,
  children,
  className = '',
}: {
  eyebrow?: ReactNode
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-card border border-hairline bg-panel p-4 ${className}`}>
      {(eyebrow || title || actions) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && (
              <h2 className="mt-1 font-display text-title font-semibold text-fg">{title}</h2>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

// A row of figures on hairline dividers. One figure per view carries `emphasis` (MASTER.md §2:
// the single loudest element); the rest stay quiet.
export function Figures({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-card border border-hairline bg-panel md:grid-cols-4 [&>*]:border-hairline [&>*]:px-4 [&>*]:py-3.5 max-md:[&>*:nth-child(even)]:border-l max-md:[&>*:nth-child(n+3)]:border-t md:[&>*:not(:first-child)]:border-l">
      {children}
    </div>
  )
}

// A figure: the number large in the grotesque, its label in mono.
export function Figure({
  value,
  label,
  emphasis = false,
}: {
  value: ReactNode
  label: string
  emphasis?: boolean
}) {
  return (
    <div className="min-w-0">
      <p
        className={`font-display font-semibold ${
          typeof value === 'string' && value.length > 8 ? 'text-display' : 'text-stat'
        } ${emphasis ? 'text-signal-text' : 'text-fg'}`}
      >
        {value}
      </p>
      <p className="eyebrow mt-1.5">{label}</p>
    </div>
  )
}

export function Muted({ children }: { children: ReactNode }) {
  return <p className="text-label text-fg-2">{children}</p>
}
