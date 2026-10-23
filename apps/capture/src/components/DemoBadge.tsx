// CLAUDE.md invariant 5: any view showing a simulated row says so.
export function DemoBadge({ rows }: { rows: { sim: boolean }[] }) {
  if (!rows.some(row => row.sim)) return null
  return (
    <p className="inline-block rounded-stamp border-2 border-ink bg-maize px-2 py-1 font-mono text-eyebrow font-semibold uppercase text-ink">
      Demo data — simulated
    </p>
  )
}
