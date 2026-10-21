import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { Crop, KnownIssue } from '@repo/shared'

// tools/corpus/manifest.json: one entry per saved file, with the curated metadata RAG
// ingestion attaches (technicaldoc §7) and where and when the bytes came from.
export interface ManifestEntry {
  id: string
  title: string
  // Relative to tools/corpus.
  file: string
  format: 'pdf' | 'md'
  // The official URL from sources.yaml.
  source_url: string
  // Where the saved bytes actually came from: the official URL, a Wayback snapshot or a mirror.
  fetched_url: string
  archive_url: string | null
  retrieved_at: string
  sha256: string
  bytes: number
  tier: number
  source: string
  country: string
  crop: Crop[]
  issue: KnownIssue[]
  year: number
  licence: string | null
  // false: kept out of git (tools/corpus/.gitignore), re-fetched on a fresh clone.
  redistribute: boolean
  pages: number | null
  text_chars: number
  // Image-only PDF: not ingested until someone runs OCR on it.
  needs_ocr: boolean
}

export function readManifest(path: string): ManifestEntry[] {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as ManifestEntry[]) : []
}

// Replaces the entry with the same id, keeping the file sorted so diffs stay readable.
export function upsert(entries: ManifestEntry[], entry: ManifestEntry) {
  return [...entries.filter(e => e.id !== entry.id), entry].sort((a, b) => a.id.localeCompare(b.id))
}

export function writeManifest(path: string, entries: ManifestEntry[]) {
  writeFileSync(path, `${JSON.stringify(entries, null, 2)}\n`)
}
