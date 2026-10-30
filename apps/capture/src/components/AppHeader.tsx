import { ArrowLeft, ClipboardList } from 'lucide-react'

// The header (Field-airy): a white bar on the haze with A's lockup, the green leaf mark and
// "Phytos" in Fraunces, the district, and (on the camera screen) the way to my reports and alerts.
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
    <header className="sticky top-0 z-20 bg-panel text-fg shadow-header">
      <div className="mx-auto flex h-14 max-w-md items-center gap-2 px-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-fg transition-colors duration-300 ease-out hover:bg-[var(--hover)] active:bg-well"
          >
            <ArrowLeft size={24} strokeWidth={2} aria-hidden />
          </button>
        )}
        <a href="#/" className="flex items-center gap-2.5" aria-label="Phytos, new report">
          <BrandMark />
          <span className="font-display text-[23px] font-semibold leading-none tracking-[-0.012em] [font-variation-settings:'SOFT'_100,'WONK'_1,'opsz'_72]">
            Phytos
          </span>
        </a>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {district && <span className="text-label text-fg-2">{district}</span>}
          {onReports && (
            <button
              type="button"
              onClick={onReports}
              className="-mr-2 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-label font-semibold text-fg transition-colors duration-300 ease-out hover:bg-[var(--hover)] active:bg-well"
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

// A's mark: a leaf on a field-green rounded square.
function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className="h-[30px] w-[30px] shrink-0">
      <rect width="32" height="32" rx="10" fill="#2D5B39" />
      <path d="M8.5 23.5C8.2 14.6 13.6 8.6 23.7 8.3c.3 10-5.5 15.6-15.2 15.2Z" fill="#E4EDCF" />
      <path d="M9.6 22.4 19.6 12.4" stroke="#2D5B39" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
