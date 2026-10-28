// CLAUDE.md invariant 5: any view showing a simulated row says so.
export function DemoBadge({ rows }: { rows: { sim: boolean }[] }) {
  if (!rows.some(row => row.sim)) return null
  return (
    <p className="inline-block rounded-tag border border-copper-deep bg-copper-tint bg-hatch px-2 py-1 font-mono text-eyebrow font-semibold uppercase text-copper-deep">
      Demo data · simulated
    </p>
  )
}
