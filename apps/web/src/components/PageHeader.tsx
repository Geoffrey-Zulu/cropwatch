import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

// Every page answers one question, stated under its title (patterns-v2.md). Anything on the
// page that does not serve that question belongs in a drawer or nowhere.
export function PageHeader({
  title,
  question,
  aside,
}: {
  title: ReactNode
  question: string
  aside?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <h1 className="text-display font-semibold tracking-tight text-fg">{title}</h1>
        <p className="mt-1 text-body-sm text-fg-2">{question}</p>
      </div>
      {aside && <div className="flex shrink-0 items-center gap-2">{aside}</div>}
    </header>
  )
}

// One level down: detail that the default view does not need, behind a labelled expander.
export function Disclosure({
  summary,
  hint,
  defaultOpen = false,
  children,
}: {
  summary: ReactNode
  hint?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details open={defaultOpen} className="group border-t border-hairline">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-3 text-label font-semibold text-fg hover:text-signal-text [&::-webkit-details-marker]:hidden">
        <ChevronRight
          size={16}
          strokeWidth={2}
          aria-hidden
          className="shrink-0 transition-transform group-open:rotate-90"
        />
        {summary}
        {hint && <span className="ml-auto font-normal text-fg-2">{hint}</span>}
      </summary>
      <div className="pb-4 pl-6">{children}</div>
    </details>
  )
}
