import type { RiskLevel } from '@repo/shared'
import { LEVEL_TEXT } from '../lib/copy'

// High is the only filled level (red-gold); Elevated is gold on its tint; Low stays quiet.
const TONE: Record<RiskLevel, string> = {
  HIGH: 'border-high bg-high text-high-ink',
  ELEVATED: 'border-attention bg-attention-tint text-attention-text',
  LOW: 'border-hairline-strong text-fg-2',
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
