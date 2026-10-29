import type { ReactNode } from 'react'

// Loading states shaped like what will land (patterns-v2.md): grey bars where the text will be,
// never a spinner in the middle of content. Bars appear after 250 ms (style.css, .skeleton-bar).
export function Bar({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`skeleton-bar ${className}`} />
}

export function Loading({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-label={label} aria-busy="true">
      {children}
    </div>
  )
}

// A list of rows: a name line and a secondary line, like the rows they stand in for.
export function SkeletonRows({ rows = 5, label }: { rows?: number; label: string }) {
  const widths = ['w-2/3', 'w-1/2', 'w-3/5', 'w-2/5', 'w-1/2', 'w-3/4']
  return (
    <Loading label={label}>
      <ul className="flex flex-col">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex flex-col gap-2 py-3">
            <Bar className={`h-3.5 ${widths[i % widths.length]}`} />
            <Bar className="h-3 w-5/6" />
          </li>
        ))}
      </ul>
    </Loading>
  )
}

// The stat strip while numbers load.
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <Loading label="Loading figures">
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className="flex items-center gap-2">
            <Bar className="h-6 w-10" />
            <Bar className="h-3 w-24" />
          </span>
        ))}
      </div>
    </Loading>
  )
}
