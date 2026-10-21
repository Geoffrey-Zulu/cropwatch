// CLAUDE.md invariant 5: any view that displays a simulated row shows this badge.
export const DEMO_BADGE_TEXT = 'DEMO DATA — SIMULATED'

export function hasSimulatedRows(rows: readonly { sim: boolean }[]) {
  return rows.some(row => row.sim)
}

// Pass every row the view displays; renders nothing when none is simulated.
export function DemoBadge({ rows }: { rows: readonly { sim: boolean }[] }) {
  if (!hasSimulatedRows(rows)) return null
  return (
    <div
      role="status"
      className="inline-flex items-center rounded-md border-2 border-amber-600 bg-amber-100 px-3 py-1 text-sm font-bold uppercase tracking-wide text-amber-900"
    >
      {DEMO_BADGE_TEXT}
    </div>
  )
}
