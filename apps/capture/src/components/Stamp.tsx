import { stampFor } from '../lib/copy'

const TONES = {
  outline: 'border-ink text-ink bg-transparent',
  maize: 'border-ink bg-maize text-ink',
  leaf: 'border-leaf bg-leaf text-slip',
} as const

// A rubber stamp on the slip. Keyed on the word, so a new status presses in once.
export function Stamp({ status }: { status: string }) {
  const { word, tone, waiting } = stampFor(status)
  return (
    <span
      key={word}
      role="status"
      className={`inline-flex shrink-0 -rotate-3 animate-stamp items-center whitespace-nowrap rounded-stamp border-2.5 px-2.5 py-1 font-stencil text-[19px] font-extrabold uppercase leading-none tracking-wide ${TONES[tone]}`}
    >
      {word}
      {waiting && (
        <span aria-hidden className="ml-0.5 inline-flex">
          <span className="animate-dots">.</span>
          <span className="animate-dots [animation-delay:150ms]">.</span>
          <span className="animate-dots [animation-delay:300ms]">.</span>
        </span>
      )}
    </span>
  )
}
