import type { RiskLevel } from '@repo/shared'
import { LEVEL_TEXT } from '../lib/copy'

const TONE: Record<RiskLevel, string> = {
  HIGH: 'border-copper-deep bg-copper-deep text-white',
  ELEVATED: 'border-copper-deep bg-copper-tint text-copper-deep',
  LOW: 'border-line-strong bg-sheet text-ink',
}

// Risk Model v0 level: a prototype signal, shown with its factors wherever it appears.
export function LevelTag({ level }: { level: RiskLevel }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-tag border px-1.5 py-0.5 font-mono text-eyebrow font-semibold uppercase ${TONE[level]}`}
    >
      {LEVEL_TEXT[level]}
    </span>
  )
}

export const LEVEL_FILL: Record<RiskLevel, string> = {
  HIGH: 'var(--copper-deep)',
  ELEVATED: 'var(--copper-tint)',
  LOW: 'var(--sheet)',
}
