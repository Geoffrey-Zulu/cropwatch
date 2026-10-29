import type { ReactNode } from 'react'

// A section: a quiet line, a title, optional actions, then content. No box: whitespace and the
// title do the grouping (patterns-v2.md decision 3).
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
    <section className={className}>
      {(eyebrow || title || actions) && (
        <header className="mb-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <h2 className="text-section font-semibold text-fg">{title}</h2>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Muted({ children }: { children: ReactNode }) {
  return <p className="text-label text-fg-2">{children}</p>
}
