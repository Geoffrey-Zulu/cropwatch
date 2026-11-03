// Writes the dashboard's read-only Knowledge sources list (apps/web/src/data/knowledge-sources.json)
// from the corpus: every curated target in sources.yaml, what the fetcher saved (manifest.json),
// and what the API retrieves from (the knowledge index in Cloud Storage). Re-run after a fetch or
// an ingest:
//
//   pnpm --filter @repo/corpus sources-json
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadSources } from './sources'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const OUT = here('../../../apps/web/src/data/knowledge-sources.json')
const INDEX = 'gs://crop-watch01-knowledge/index.json'
const ACCOUNT = 'zulugeoffrey034@gmail.com'

interface ManifestEntry {
  id: string
  source_url: string
  licence: string | null
  retrieved_at: string
  pages?: number | null
}

const sources = loadSources(here('./sources.yaml'))
const manifest = new Map(
  (JSON.parse(readFileSync(here('../manifest.json'), 'utf8')) as ManifestEntry[]).map(m => [
    m.id,
    m,
  ])
)
// gcloud is a .cmd shim on Windows, hence a command string; nothing user-supplied reaches it.
const index = JSON.parse(
  execSync(`gcloud storage cat ${INDEX} --project=crop-watch01 --account=${ACCOUNT}`, {
    encoding: 'utf8',
  })
) as { generated_at: string; documents: { id: string }[] }
const retrievable = new Set(index.documents.map(d => d.id))

// The first sentence, without email addresses (a dashboard page does not need them).
const firstSentence = (text?: string) =>
  text
    ?.replace(/\s*\([^()]*@[^()]*\)/g, '')
    .replace(/\s+/g, ' ')
    .split(/(?<=\.)\s/)[0] ?? null

const rows = sources
  .map(s => {
    const saved = manifest.get(s.id)
    return {
      id: s.id,
      title: s.title,
      source: s.source,
      tier: s.tier,
      country: s.country,
      year: s.year,
      crop: s.crop,
      issue: s.issue,
      url: saved?.source_url ?? s.url,
      licence: saved?.licence ?? s.licence ?? null,
      status: retrievable.has(s.id)
        ? ('retrievable' as const)
        : saved
          ? ('fetched' as const)
          : s.pending
            ? ('pending' as const)
            : ('not_fetched' as const),
      note: s.pending ? firstSentence(s.pending) : (firstSentence(s.notes) ?? null),
      retrieved_at: saved?.retrieved_at ?? null,
    }
  })
  .sort((a, b) => a.tier - b.tier || a.title.localeCompare(b.title))

writeFileSync(
  OUT,
  `${JSON.stringify({ generated_at: new Date().toISOString(), index_generated_at: index.generated_at, sources: rows }, null, 2)}\n`
)
const count = (status: string) => rows.filter(r => r.status === status).length
console.log(
  `${rows.length} sources → ${OUT}: ${count('retrievable')} retrievable, ${count('fetched')} fetched only, ${count('pending')} pending, ${count('not_fetched')} not fetched`
)
