import { withoutEmDash } from '@repo/shared'
import manifest from '../data/knowledge-sources.json'

// Publishers by authority tier, short enough for a chip (TIER_NAMES has them in full).
export const TIER_SHORT: Record<number, string> = {
  1: 'MoA',
  2: 'ZARI',
  3: 'ZMD',
  4: 'FAO',
  5: 'CABI',
  6: 'Research',
}

const byUrl = new Map(manifest.sources.map(s => [s.url, s]))

// A cited source as a chip shows it: the original document's address (the advice cites the
// manifest's source_url; anything else is matched to the manifest by address), its cleaner
// manifest title where the manifest has it, and the publisher by tier.
export function sourceLink(uri: string, title: string, tier: number) {
  const known = byUrl.get(uri)
  const href = /^https?:\/\//.test(uri) ? uri : (known?.url ?? null)
  return {
    href,
    title: withoutEmDash(known?.title ?? title),
    publisher: TIER_SHORT[tier] ?? 'Source',
  }
}
