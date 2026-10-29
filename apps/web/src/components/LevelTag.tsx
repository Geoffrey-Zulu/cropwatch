import type { RiskLevel } from '@repo/shared'
import { LEVEL_TEXT } from '../lib/copy'

const DOT: Record<RiskLevel, string> = {
  HIGH: 'bg-high',
  ELEVATED: 'bg-attention',
  LOW: 'bg-hairline-strong',
}

// The level inside tables and lists: a dot and the word, never a filled pill (patterns.md rule 7).
export function LevelDot({ level }: { level: RiskLevel }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-label text-fg">
      <span aria-hidden className={`h-2 w-2 rounded-full ${DOT[level]}`} />
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
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-high text-[11px] font-bold leading-none text-high-ink"
      >
        !
      </span>
    )
  if (level === 'ELEVATED')
    return <span aria-hidden className="h-4 w-4 shrink-0 rounded-full border-2 border-attention" />
  return <span aria-hidden className="mx-1 h-2 w-2 shrink-0 rounded-full bg-hairline-strong" />
}
