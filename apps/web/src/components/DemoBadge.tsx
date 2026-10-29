// CLAUDE.md invariant 5: any view that displays a simulated row shows this badge.
export const DEMO_BADGE_TEXT = 'DEMO DATA · SIMULATED'

export function hasSimulatedRows(rows: readonly { sim: boolean }[]) {
  return rows.some(row => row.sim)
}

// Pass every row the view displays; renders nothing when none is simulated.
export function DemoBadge({ rows }: { rows: readonly { sim: boolean }[] }) {
  if (!hasSimulatedRows(rows)) return null
  return (
    <span
      role="status"
      className="inline-flex shrink-0 items-center rounded-tag border border-hairline-strong bg-well bg-hatch px-2 py-1 font-mono text-eyebrow font-semibold uppercase text-fg"
    >
      {DEMO_BADGE_TEXT}
    </span>
  )
}
