import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { z } from 'zod'
import { CropSchema, KnownIssueSchema } from '@repo/shared'

// One curated corpus target (technicaldoc §7). The fetcher only ever requests these URLs, plus
// their robots.txt and Wayback snapshots: it is not a crawler.
export const SourceSchema = z.object({
  // Also the file name: kebab-case ending in the year, e.g. fao-faw-ffs-guide-2018.
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*-\d{4}$/, 'kebab-case ending in -YYYY'),
  title: z.string().min(1),
  url: z.string().url(),
  // 1 MoA, 2 ZARI, 3 ZMD, 4 FAO, 5 CABI, 6 research. Lower wins on conflict.
  tier: z.number().int().min(1).max(6),
  source: z.string().min(1),
  country: z.string().min(2),
  crop: z.array(CropSchema),
  issue: z.array(KnownIssueSchema),
  year: z.number().int().min(1990).max(2100),
  expect: z.enum(['pdf', 'html']),
  // One of the eight documents the D4 gate counts.
  priority: z.boolean().default(false),
  // HTML pages only: 'pdf' prints the page with headless Chromium, for pages whose layout
  // (tables) carries meaning; otherwise the main content becomes markdown.
  render: z.enum(['markdown', 'pdf']).default('markdown'),
  // A known-good Wayback snapshot to use if the live URL fails.
  wayback: z.string().url().optional(),
  // Other hosts of the same document (publisher partners, mirrors), tried in order after the
  // official URL and its Wayback snapshot. Used where the official host blocks automated
  // fetching; the manifest records which copy was saved.
  mirrors: z.array(z.string().url()).default([]),
  licence: z.string().optional(),
  // false keeps the file out of git (the repository is public): set it when the licence does
  // not allow redistribution. The document is still fetched and ingested.
  redistribute: z.boolean().default(true),
  notes: z.string().optional(),
})
export type Source = z.infer<typeof SourceSchema>

const SourcesFileSchema = z
  .object({ sources: z.array(SourceSchema).min(1) })
  .refine(f => new Set(f.sources.map(s => s.id)).size === f.sources.length, {
    message: 'Source ids must be unique',
  })

export function parseSources(text: string): Source[] {
  return SourcesFileSchema.parse(parse(text)).sources
}

export function loadSources(path: string) {
  return parseSources(readFileSync(path, 'utf8'))
}

// technicaldoc §7 corpus layout.
export const TIER_FOLDERS: Record<number, string> = {
  1: 'zambia/moa',
  2: 'zambia/zari',
  3: 'zambia/zmd',
  4: 'international/fao',
  5: 'international/cabi',
  6: 'research',
}

export function outputPath(source: Source, format: 'pdf' | 'md') {
  return `${TIER_FOLDERS[source.tier]}/${source.id}.${format}`
}
