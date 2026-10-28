import { ArrowLeft, ClipboardList } from 'lucide-react'

// The navy header: the serif wordmark with its copper marker, the district in data type, and
// (on the camera screen) the way to my reports and alerts.
export function AppHeader({
  district,
  onBack,
  onReports,
}: {
  district?: string | null
  onBack?: () => void
  onReports?: () => void
}) {
  return (
    <header className="sticky top-0 z-20 bg-navy text-white">
      <div className="mx-auto flex h-14 max-w-md items-center gap-3 px-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="-ml-2 inline-flex h-12 w-12 items-center justify-center rounded-card text-white"
          >
            <ArrowLeft size={24} strokeWidth={2} aria-hidden />
          </button>
        )}
        <a href="#/" className="flex items-center gap-2" aria-label="Phytos, new report">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-copper-light" />
          <span className="font-display text-[22px] font-semibold uppercase leading-none tracking-[0.14em]">
            Phytos
          </span>
        </a>
        <div className="ml-auto flex min-w-0 items-center gap-3">
          {district && (
            <span className="truncate font-mono text-eyebrow font-semibold uppercase text-white">
              {district}
            </span>
          )}
          {onReports && (
            <button
              type="button"
              onClick={onReports}
              className="-mr-1 inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-card px-2 text-label font-semibold text-white"
            >
              <ClipboardList size={20} strokeWidth={2} aria-hidden />
              My reports
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
