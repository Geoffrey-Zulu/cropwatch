import { FlaskConical } from 'lucide-react'

// CLAUDE.md invariant 5: any view that displays a simulated row shows this badge.
export const DEMO_BADGE_TEXT = 'DEMO DATA · SIMULATED'

export function hasSimulatedRows(rows: readonly { sim: boolean }[]) {
  return rows.some(row => row.sim)
}

// Mockup A's DEMO pill: white, hatched, with an ink rim, on the data it marks (a corner of the
// map, the top of a list or a drawer), never in the chrome. `small` for drawers and phones.
// Pass every row the view displays; renders nothing when none is simulated.
export function DemoBadge({
  rows,
  small = false,
}: {
  rows: readonly { sim: boolean }[]
  small?: boolean
}) {
  if (!hasSimulatedRows(rows)) return null
  return (
    <span
      role="status"
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-pill font-bold tracking-[0.07em] text-fg shadow-[var(--raise-sm),inset_0_0_0_1.5px_rgb(27_41_32/0.6)] ${
        small
          ? 'gap-[0.4rem] py-[0.3rem] pl-[0.6rem] pr-[0.7rem] text-[0.7rem]'
          : 'gap-2 py-2 pl-[0.8rem] pr-[0.95rem] text-[0.8rem] max-lg:gap-[0.4rem] max-lg:py-[0.35rem] max-lg:pl-[0.6rem] max-lg:pr-[0.7rem] max-lg:text-[0.7rem]'
      }`}
      style={{ background: 'var(--hatch), #FFFFFF' }}
    >
      <FlaskConical
        aria-hidden
        className={
          small
            ? 'h-[0.85rem] w-[0.85rem]'
            : 'h-[0.95rem] w-[0.95rem] max-lg:h-[0.85rem] max-lg:w-[0.85rem]'
        }
      />
      {DEMO_BADGE_TEXT}
    </span>
  )
}
