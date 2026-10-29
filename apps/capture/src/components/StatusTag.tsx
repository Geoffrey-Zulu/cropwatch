import { statusTagFor } from '../lib/copy'

const TONES = {
  outline: 'border-fg text-fg bg-transparent',
  attention: 'border-attention bg-attention-tint text-attention-text',
  guidance: 'border-leaf bg-signal-tint text-signal-text',
} as const

// A report's status. Keyed on the word, so a new status fades in once.
export function StatusTag({ status }: { status: string }) {
  const { word, tone, waiting } = statusTagFor(status)
  return (
    <span
      key={word}
      role="status"
      className={`inline-flex shrink-0 animate-tag items-center whitespace-nowrap rounded-tag border-1.5 px-2 py-1 font-mono text-eyebrow font-semibold uppercase ${TONES[tone]}`}
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
