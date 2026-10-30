import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

// A page is its title, then its content (polish 30 Oct: no question line under the title).
// Each page still answers one question; anything that does not serve it belongs in a drawer.
export function PageHeader({ title, aside }: { title: ReactNode; aside?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <h1 className="text-display font-semibold text-fg">{title}</h1>
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
    <details open={defaultOpen} className="group">
      <summary className="-mx-2 flex cursor-pointer list-none items-center gap-2 rounded-card px-2 py-2 text-section font-semibold text-fg hover:bg-well [&::-webkit-details-marker]:hidden">
        <ChevronRight
          size={16}

          aria-hidden
          className="shrink-0 transition-transform group-open:rotate-90"
        />
        {summary}
        {hint && <span className="ml-auto font-normal text-fg-2">{hint}</span>}
      </summary>
      <div className="pb-4 pl-6 pt-1">{children}</div>
    </details>
  )
}
