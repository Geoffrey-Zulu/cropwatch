import type { ReactNode } from 'react'

// The one primary action per screen, fixed at thumb height. The page fades into the haze
// behind it (.action-bar), with no hard edge.
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Keeps page content clear of the fixed bar. */}
      <div aria-hidden className="h-32" />
      <div className="action-bar fixed inset-x-0 bottom-0 z-20 pb-[max(14px,env(safe-area-inset-bottom))] pt-7">
        <div className="mx-auto max-w-md px-4">{children}</div>
      </div>
    </>
  )
}
