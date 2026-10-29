import { ArrowLeft, ClipboardList } from 'lucide-react'

// The header in the day exposure: the wordmark on its dark chip (as on the pitch PDF), the
// district in mono, and (on the camera screen) the way to my reports and alerts.
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
    <header className="sticky top-0 z-20 border-b border-hairline bg-ground text-fg">
      <div className="mx-auto flex h-14 max-w-md items-center gap-3 px-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="-ml-2 inline-flex h-12 w-12 items-center justify-center rounded-card text-fg active:bg-well"
          >
            <ArrowLeft size={24} strokeWidth={2} aria-hidden />
          </button>
        )}
        <a href="#/" className="flex items-center" aria-label="Phytos, new report">
          <span className="rounded-tag bg-chip px-2.5 py-1.5 font-display text-[18px] font-extrabold uppercase leading-none tracking-[0.16em] text-chip-fg">
            Phytos
          </span>
        </a>
        <div className="ml-auto flex min-w-0 items-center gap-3">
          {district && <span className="text-label text-fg-2">{district}</span>}
          {onReports && (
            <button
              type="button"
              onClick={onReports}
              className="-mr-1 inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-card px-2 text-label font-semibold text-fg active:bg-well"
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
