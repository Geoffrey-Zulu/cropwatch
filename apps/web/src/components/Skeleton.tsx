import { LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { PhytosLogo } from './PhytosLogo'

// The one loading state (patterns-v2.md, polish 30 Oct): shimmer blocks shaped like what will
// land, never "…" text and never a spinner in the middle of content. Blocks appear after 250 ms
// (style.css, .skeleton-bar).
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

// A list of rows like the rows they stand in for: a name line and `lines - 1` secondary lines.
export function SkeletonRows({
  rows = 5,
  lines = 2,
  label,
}: {
  rows?: number
  lines?: number
  label: string
}) {
  const widths = ['w-2/3', 'w-1/2', 'w-3/5', 'w-2/5', 'w-1/2', 'w-3/4']
  return (
    <Loading label={label}>
      <ul className="flex flex-col">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex flex-col gap-2 py-3">
            <Bar className={`h-3.5 ${widths[i % widths.length]}`} />
            {Array.from({ length: lines - 1 }, (_, j) => (
              <Bar key={j} className={`h-3 ${j % 2 ? 'w-1/2' : 'w-5/6'}`} />
            ))}
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

// The frame while the session starts: the header, the rail and a page.
export function AppSkeleton() {
  return (
    <Loading label="Starting Phytos">
      <div className="min-h-dvh">
        <div className="flex h-14 items-center border-b border-hairline bg-panel px-4">
          <PhytosLogo />
          <span className="ml-auto flex items-center gap-3">
            <Bar className="h-4 w-36" />
            <Bar className="h-8 w-8 rounded-full" />
          </span>
        </div>
        <div className="lg:flex">
          <div className="hidden bg-well lg:block lg:h-[calc(100dvh-56px)] lg:w-14" />
          <div className="flex flex-1 flex-col gap-5 px-4 py-6 lg:px-8">
            <Bar className="h-7 w-56" />
            <Bar className="h-20 w-full max-w-3xl" />
            <Bar className="h-[50vh] w-full" />
          </div>
        </div>
      </div>
    </Loading>
  )
}

// The only spinner: inside a button while its action runs, beside the button's own words.
export function ButtonSpinner() {
  return <LoaderCircle aria-hidden className="animate-spin" />
}
