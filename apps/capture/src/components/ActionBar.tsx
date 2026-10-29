import type { ReactNode } from 'react'

// The one primary action per screen, fixed at thumb height.
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Keeps page content clear of the fixed bar. */}
      <div aria-hidden className="h-28" />
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-hairline bg-ground pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto max-w-md px-4">{children}</div>
      </div>
    </>
  )
}
