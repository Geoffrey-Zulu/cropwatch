import type { ReactNode } from 'react'

// A panel: mono kicker, grotesque title, optional actions, then content. 24 px padding on the
// 8 px grid.
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
    <section className={`rounded-card border border-hairline bg-panel p-6 ${className}`}>
      {(eyebrow || title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-4">
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

// The stat row, as on the pitch PDF: a hairline above, then each figure as a large Bricolage
// number in deep leaf with a two-line small label beside it. No boxes.
export function Figures({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-4 border-t border-hairline pt-4 sm:grid-cols-2 xl:grid-cols-4">
      {children}
    </div>
  )
}

export function Figure({ value, label }: { value: ReactNode; label: string }) {
  const word = typeof value === 'string' && value.length > 8
  return (
    // A word (an issue name) stacks its label underneath instead of squeezing it.
    <div className={`flex min-w-0 gap-3 ${word ? 'flex-col gap-1' : 'items-center'}`}>
      <p
        className={`shrink-0 font-display font-bold leading-none text-signal-text ${
          word ? 'text-[26px]' : 'text-[40px]'
        }`}
      >
        {value}
      </p>
      <p
        className={`text-caption leading-[18px] text-fg-2 ${word ? 'max-w-[16rem]' : 'max-w-[9.5rem]'}`}
      >
        {label}
      </p>
    </div>
  )
}

export function Muted({ children }: { children: ReactNode }) {
  return <p className="text-label text-fg-2">{children}</p>
}
