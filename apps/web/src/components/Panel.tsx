import type { ReactNode } from 'react'

// A sheet panel: eyebrow, serif title, optional actions, then content.
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
    <section className={`rounded-card border border-line bg-sheet p-4 ${className}`}>
      {(eyebrow || title || actions) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && (
              <h2 className="mt-0.5 font-display text-title font-semibold text-navy">{title}</h2>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

// A small figure: the number in serif, its label in data type.
export function Figure({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="min-w-0">
      <p className="font-display text-display font-semibold leading-none text-navy">{value}</p>
      <p className="eyebrow mt-1.5">{label}</p>
    </div>
  )
}

export function Muted({ children }: { children: ReactNode }) {
  return <p className="text-label text-ink-2">{children}</p>
}
