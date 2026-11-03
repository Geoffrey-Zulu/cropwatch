import { IMAGERY } from '../lib/imagery'

// One quiet source line per data card, never two (1 Nov convention): what the card's figures and
// pictures come from, in one style. Parts that apply are joined with a middle dot.
export const SOURCE = {
  imagery: IMAGERY.esri.attribution,
  greenness: (simulated: boolean) =>
    simulated ? 'Greenness: Sentinel-2 (simulated season)' : 'Greenness: Sentinel-2',
  rainfall: 'Rainfall series for the simulated season · live seasons read ZMD and CHIRPS',
} as const

export function SourceLine({
  parts,
  className = '',
}: {
  parts: (string | false | null | undefined)[]
  className?: string
}) {
  const shown = parts.filter(Boolean)
  if (!shown.length) return null
  return (
    <p className={`text-[0.72rem] leading-[1.45] text-fg-2 ${className}`}>{shown.join(' · ')}</p>
  )
}
