import { Sprout } from 'lucide-react'

export function LoadingState({
  title,
  detail,
  compact = false,
}: {
  title: string
  detail: string
  compact?: boolean
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`loading-state ${compact ? 'loading-state--compact' : ''}`}
    >
      <span className="loading-state__icon" aria-hidden>
        <Sprout size={22} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-label font-bold text-fg">{title}</p>
        <p className="mt-0.5 text-label text-fg-2">{detail}</p>
        <span className="loading-track mt-3" aria-hidden>
          <span />
        </span>
      </div>
    </div>
  )
}
