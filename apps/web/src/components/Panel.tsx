import type { ReactNode } from 'react'

// A section in mockup A's language: a white island with soft layered shadows, a quiet line and a
// Fraunces title, optional actions, then content.
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
    <section
      className={`island px-[1.45rem] py-[1.3rem] md:px-[1.65rem] md:py-[1.55rem] ${className}`}
    >
      {(eyebrow || title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && (
              <h2 className="serif mt-0.5 text-[1.35rem] font-semibold leading-[1.15] text-fg">
                {title}
              </h2>
            )}
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
