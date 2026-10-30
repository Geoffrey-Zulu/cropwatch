// CLAUDE.md invariant 5: any view that displays a simulated row shows this badge.
export const DEMO_BADGE_TEXT = 'DEMO DATA · SIMULATED'

export function hasSimulatedRows(rows: readonly { sim: boolean }[]) {
  return rows.some(row => row.sim)
}

// A small quiet pill on the data it marks (the map's corner, the top of a list or a drawer),
// never in the chrome. The hatch swatch is the simulated-data texture (MASTER.md).
// Pass every row the view displays; renders nothing when none is simulated.
export function DemoBadge({
  rows,
  className = 'bg-well',
}: {
  rows: readonly { sim: boolean }[]
  className?: string
}) {
  if (!hasSimulatedRows(rows)) return null
  return (
    <span
      role="status"
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-4 tracking-[0.04em] text-fg-2 ${className}`}
    >
      <span
        aria-hidden
        className="h-2.5 w-3.5 rounded-[3px] border border-hairline-strong bg-hatch"
      />
      {DEMO_BADGE_TEXT}
    </span>
  )
}
