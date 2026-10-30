// CLAUDE.md invariant 5: any view showing a simulated row says so. A's hatched DEMO pill.
export function DemoBadge({ rows }: { rows: { sim: boolean }[] }) {
  if (!rows.some(row => row.sim)) return null
  return (
    <p className="demo-pill">
      <svg viewBox="0 0 24 24" aria-hidden className="h-[15px] w-[15px] shrink-0">
        <path
          d="M9 3h6M10 3v6L4.6 18.2A1.9 1.9 0 0 0 6.3 21h11.4a1.9 1.9 0 0 0 1.7-2.8L14 9V3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M7.5 15h9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
      Demo data · simulated
    </p>
  )
}
