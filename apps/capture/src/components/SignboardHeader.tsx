import { ArrowLeft } from 'lucide-react'

// The header board: stencilled wordmark with the copper rule, the district in slip data type.
export function SignboardHeader({
  district,
  onBack,
}: {
  district?: string | null
  onBack?: () => void
}) {
  return (
    <header className="sticky top-0 z-20 bg-signboard text-paper">
      <div className="mx-auto flex h-14 max-w-md items-center gap-3 px-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="-ml-2 inline-flex h-12 w-12 items-center justify-center rounded-input text-paper"
          >
            <ArrowLeft size={24} strokeWidth={2.25} aria-hidden />
          </button>
        )}
        <a href="#/" className="flex flex-col leading-none">
          <span className="font-stencil text-[30px] font-extrabold uppercase tracking-wide">
            CropWatch
          </span>
          <span aria-hidden className="mt-0.5 h-1 w-full bg-copper-bright" />
        </a>
        {district && (
          <span className="ml-auto truncate font-mono text-eyebrow font-semibold uppercase text-paper">
            {district}
          </span>
        )}
      </div>
    </header>
  )
}
