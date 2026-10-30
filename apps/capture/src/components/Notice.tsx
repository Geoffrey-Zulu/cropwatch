import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

// A problem the farmer can act on, with the action beside it.
export function Notice({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-card bg-attention-tint p-4 text-fg shadow-island-sm"
    >
      <p className="flex gap-2 text-body font-semibold">
        <TriangleAlert
          size={24}
          strokeWidth={2}
          aria-hidden
          className="mt-0.5 shrink-0 text-attention-text"
        />
        <span>{children}</span>
      </p>
      {action}
    </div>
  )
}
