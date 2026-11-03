import { statusTagFor } from '../lib/copy'

// Pills (Field-airy): in progress is quiet ink, an officer's attention is maize, advice is green.
const TONES = {
  outline: 'bg-well text-fg',
  attention: 'bg-attention-tint text-attention-text',
  guidance: 'bg-signal-tint text-signal-text',
} as const

// A report's status, a dot and a word. Keyed on the word, so a new status fades in once.
export function StatusTag({ status }: { status: string }) {
  const { word, tone, waiting } = statusTagFor(status)
  return (
    <span
      key={word}
      role="status"
      className={`inline-flex shrink-0 animate-tag items-center whitespace-nowrap rounded-tag py-1 pl-2.5 pr-3 text-[14px] font-semibold leading-5 before:mr-1.5 before:h-2 before:w-2 before:rounded-full before:bg-current before:content-[''] ${TONES[tone]}`}
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
