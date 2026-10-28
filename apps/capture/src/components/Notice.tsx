import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

// A problem the farmer can act on, with the action beside it.
export function Notice({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-card border border-copper-deep border-l-4 bg-copper-tint p-4 text-ink"
    >
      <p className="flex gap-2 text-body font-semibold">
        <TriangleAlert
          size={24}
          strokeWidth={2}
          aria-hidden
          className="mt-0.5 shrink-0 text-copper-deep"
        />
        <span>{children}</span>
      </p>
      {action}
    </div>
  )
}
