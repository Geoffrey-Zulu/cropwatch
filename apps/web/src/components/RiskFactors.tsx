import type { RiskLevel } from '@repo/shared'
import { ago } from '../lib/copy'
import { LevelTag } from './LevelTag'

// A district's prototype risk signal: the level never without its contributing factors.
export function RiskFactors({
  risk,
}: {
  risk: { level: RiskLevel; factors: string[]; computedAt: string }
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <LevelTag level={risk.level} />
        <span className="font-mono text-eyebrow text-ink-2">computed {ago(risk.computedAt)}</span>
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {risk.factors.map(f => (
          <li key={f} className="flex gap-2 text-label">
            <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 bg-copper" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  )
}
