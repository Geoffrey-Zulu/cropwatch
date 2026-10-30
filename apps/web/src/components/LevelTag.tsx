import type { RiskLevel } from '@repo/shared'
import { LEVEL_TEXT } from '../lib/copy'

const SWATCH: Record<RiskLevel, string> = {
  HIGH: 'swatch-high',
  ELEVATED: 'swatch-elevated',
  LOW: 'swatch-low',
}
const WORD: Record<RiskLevel, string> = {
  HIGH: 'text-high-text',
  ELEVATED: 'text-attention-text',
  LOW: 'text-fg-2',
}

// The level inside tables and lists (mockup A): the field swatch (High solid brick, Elevated
// hatched maize, Low fallow) and the word in its colour, so it reads without colour too.
export function LevelDot({ level }: { level: RiskLevel }) {
  return (
    <span
      className={`inline-flex items-center gap-[0.4rem] whitespace-nowrap text-label font-[650] ${WORD[level]}`}
    >
      <span aria-hidden className={`swatch ${SWATCH[level]}`} />
      {LEVEL_TEXT[level]}
    </span>
  )
}

// The alert-row icon: shape as well as colour, so the level reads without colour vision
// (patterns-v2.md decision 7): High a filled circle with "!", Elevated an empty ring, Low a dot.
export function LevelIcon({ level }: { level: RiskLevel }) {
  if (level === 'HIGH')
    return (
      <span
        aria-hidden
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-high text-[0.7rem] font-bold leading-none text-high-ink"
      >
        !
      </span>
    )
  if (level === 'ELEVATED')
    return (
      <span
        aria-hidden
        className="h-4 w-4 shrink-0 rounded-full border-2 border-[var(--attention-stripe)]"
      />
    )
  return <span aria-hidden className="mx-1 h-2 w-2 shrink-0 rounded-full bg-hairline-strong" />
}

// The level at the end of a row: the same swatch and word, right-aligned in a list.
export function LevelPill({ level }: { level: RiskLevel }) {
  return <LevelDot level={level} />
}
