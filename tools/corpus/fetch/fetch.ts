// Fetches the curated corpus in fetch/sources.yaml into tools/corpus/<tier folder>/.
//
//   pnpm --filter @repo/corpus fetch-corpus                     fetch what is missing or changed
//   pnpm --filter @repo/corpus fetch-corpus --force             re-fetch everything
//   pnpm --filter @repo/corpus fetch-corpus --only <id,id>      just these sources
//   pnpm --filter @repo/corpus fetch-corpus --import <id> <file>
//                                     record a document downloaded by hand (a browser, an email)
//
// Live first (honest User-Agent, robots.txt, 1 request per 2 s per host, retry with backoff),
// then the newest good Wayback Machine snapshot, then any mirrors. Writes manifest.json,
// fetch-report.md and .gitignore (documents whose licence does not allow redistribution), and
// any FAW-annex candidate rows to tools/regulatory/faw-annex-candidate.csv (review only).
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { annexCsv, findAnnexRows, type AnnexRow } from './annex'
import { htmlToMarkdown, needsOcr, pdfText, withFrontmatter, type PdfText } from './extract'
import { FetchError, HostLimiter, isPdf, politeGet, RobotsCache, type Response } from './http'
import { readManifest, upsert, writeManifest, type ManifestEntry } from './manifest'
import { printToPdf } from './print'
import { renderReport, type Outcome } from './report'
import { loadSources, outputPath, type Source } from './sources'
import { findSnapshot, parseArchiveUrl, type Snapshot } from './wayback'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST = join(ROOT, 'manifest.json')
const ANNEX_CSV = join(ROOT, '..', 'regulatory', 'faw-annex-candidate.csv')

const args = process.argv.slice(2).filter(arg => arg !== '--')
const force = args.includes('--force')
const onlyArg = args.find(arg => arg.startsWith('--only'))
const importAt = args.indexOf('--import')
const manualImport = importAt >= 0 ? { id: args[importAt + 1], file: args[importAt + 2] } : null
if (manualImport && (!manualImport.id || !manualImport.file)) {
  throw new Error('Usage: --import <source id> <downloaded file>')
}
const only = manualImport
  ? new Set([manualImport.id])
  : onlyArg
    ? new Set(
        (onlyArg.includes('=') ? onlyArg.split('=')[1] : args[args.indexOf(onlyArg) + 1]).split(',')
      )
    : null

const allSources = loadSources(join(ROOT, 'fetch', 'sources.yaml'))
const sources = allSources.filter(s => !only || only.has(s.id))
if (only && sources.length !== only.size) {
  throw new Error(`Unknown source id in ${[...only].join(', ')}`)
}
const limiter = new HostLimiter()
const robots = new RobotsCache(limiter)
let manifest = readManifest(MANIFEST)
const outcomes: Outcome[] = []

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

function decode(response: Response) {
  const charset = /charset=([\w-]+)/i.exec(response.contentType)?.[1] ?? 'utf-8'
  try {
    return new TextDecoder(charset).decode(response.body)
  } catch {
    return new TextDecoder('utf-8').decode(response.body)
  }
}

interface Checked {
  response: Response
  // Extracted text, for PDFs.
  pdf: PdfText | null
}

// The right kind of content, or why not: a landing page or login wall where a PDF was promised,
// or a PDF that does not parse (archive captures are sometimes cut off at 1 MiB), is a failure,
// and the next copy is tried.
async function checkContent(source: Source, response: Response): Promise<Checked | string> {
  if (source.expect === 'html') {
    return isPdf(response.body) ? 'expected HTML, got a PDF' : { response, pdf: null }
  }
  if (!isPdf(response.body)) {
    return `expected a PDF, got ${response.contentType || 'unknown content'}`
  }
  try {
    return { response, pdf: await pdfText(response.body) }
  } catch (error) {
    const truncated = response.body.length === 1024 * 1024 ? ', likely a truncated capture' : ''
    return `PDF does not parse (${(error as Error).message}; ${response.body.length} bytes${truncated})`
  }
}

// A usable copy, or why not.
async function get(source: Source, url: string): Promise<Checked | string> {
  try {
    return await checkContent(source, await politeGet(url, limiter))
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

interface Got extends Checked {
  status: 'fetched' | 'archived' | 'mirror' | 'manual'
  url: string
  snapshot: Snapshot | null
  // What failed before this copy was found.
  failures: string[]
}

// The official URL, then its newest good Wayback snapshot, then mirrors in order. A URL that
// robots.txt disallows is neither fetched nor taken from the archive.
async function obtain(source: Source): Promise<Got> {
  const failures: string[] = []
  const verdict = await robots.check(source.url)
  if (verdict === 'disallowed') {
    failures.push('live: robots.txt disallows (so no archive copy either)')
  } else {
    const live =
      verdict === 'unreachable'
        ? 'site unreachable (robots.txt fetch failed)'
        : await get(source, source.url)
    if (typeof live !== 'string') {
      return { status: 'fetched', url: source.url, ...live, snapshot: null, failures }
    }
    failures.push(`live: ${live}`)
    const snapshot = source.wayback
      ? parseArchiveUrl(source.wayback)
      : await findSnapshot(source.url, limiter)
    if (!snapshot) {
      failures.push('archive: no snapshot')
    } else {
      const archived = await get(source, snapshot.rawUrl)
      if (typeof archived !== 'string') {
        return { status: 'archived', url: snapshot.rawUrl, ...archived, snapshot, failures }
      }
      failures.push(`archive: ${archived}`)
    }
  }
  for (const mirror of source.mirrors) {
    const host = new URL(mirror).host
    const mirrorVerdict = await robots.check(mirror)
    if (mirrorVerdict === 'disallowed') {
      failures.push(`mirror ${host}: robots.txt disallows`)
      continue
    }
    const copy = mirrorVerdict === 'unreachable' ? 'site unreachable' : await get(source, mirror)
    if (typeof copy !== 'string') {
      return { status: 'mirror', url: mirror, ...copy, snapshot: null, failures }
    }
    failures.push(`mirror ${host}: ${copy}`)
  }
  throw new FetchError(failures.join('; '))
}

// A document someone downloaded by hand, checked like any fetched copy.
async function fromFile(source: Source, file: string): Promise<Got> {
  const body = readFileSync(resolve(process.env.INIT_CWD ?? process.cwd(), file))
  const checked = await checkContent(source, {
    status: 200,
    contentType: isPdf(body) ? 'application/pdf' : 'text/html',
    finalUrl: source.url,
    body,
  })
  if (typeof checked === 'string') throw new FetchError(`${basename(file)}: ${checked}`)
  return {
    status: 'manual',
    url: `manual:${basename(file)}`,
    ...checked,
    snapshot: null,
    failures: [],
  }
}

async function save(source: Source, got: Got): Promise<ManifestEntry> {
  const { response, snapshot } = got
  const retrieved_at = new Date().toISOString()
  let format: 'pdf' | 'md'
  let bytes: Buffer
  let pdf: PdfText | null = null
  let text: string[]
  let title = source.title

  if (source.expect === 'pdf' || source.render === 'pdf') {
    format = 'pdf'
    const file = join(ROOT, outputPath(source, 'pdf'))
    mkdirSync(dirname(file), { recursive: true })
    if (source.expect === 'html') {
      // Layout carries meaning: print the page itself.
      await printToPdf(got.url, file)
      bytes = readFileSync(file)
      pdf = await pdfText(bytes)
    } else {
      bytes = response.body
      pdf = got.pdf!
      writeFileSync(file, bytes)
    }
    text = pdf.text
  } else {
    format = 'md'
    const page = htmlToMarkdown(decode(response), response.finalUrl)
    title = page.title || source.title
    const markdown = withFrontmatter(page, {
      source_url: source.url,
      retrieved_at,
      archive_url: snapshot?.archiveUrl ?? null,
      fetched_url: got.status === 'mirror' || got.status === 'manual' ? got.url : null,
    })
    bytes = Buffer.from(markdown, 'utf8')
    const file = join(ROOT, outputPath(source, 'md'))
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, bytes)
    text = [page.markdown]
  }

  return {
    id: source.id,
    title,
    file: outputPath(source, format),
    format,
    source_url: source.url,
    fetched_url: got.url,
    archive_url: snapshot?.archiveUrl ?? null,
    retrieved_at,
    sha256: sha256(bytes),
    bytes: bytes.length,
    tier: source.tier,
    source: source.source,
    country: source.country,
    crop: source.crop,
    issue: source.issue,
    year: source.year,
    licence: source.licence ?? null,
    redistribute: source.redistribute,
    pages: pdf?.pages ?? null,
    text_chars: text.join('').replace(/\s+/g, '').length,
    needs_ocr: pdf ? needsOcr(pdf) : false,
  }
}

for (const source of sources) {
  const existing = manifest.find(e => e.id === source.id)
  if (
    !force &&
    !manualImport &&
    existing &&
    existsSync(join(ROOT, existing.file)) &&
    sha256(readFileSync(join(ROOT, existing.file))) === existing.sha256
  ) {
    // Licence and tags may have been corrected in sources.yaml since the fetch.
    const entry: ManifestEntry = {
      ...existing,
      title: existing.format === 'pdf' ? source.title : existing.title,
      tier: source.tier,
      source: source.source,
      country: source.country,
      crop: source.crop,
      issue: source.issue,
      year: source.year,
      licence: source.licence ?? null,
      redistribute: source.redistribute,
    }
    manifest = upsert(manifest, entry)
    outcomes.push({ source, status: 'cached', entry })
    continue
  }

  process.stdout.write(`${source.id} … `)
  try {
    const got = manualImport ? await fromFile(source, manualImport.file) : await obtain(source)
    const entry = await save(source, got)
    manifest = upsert(manifest, entry)
    outcomes.push({ source, status: got.status, entry, failures: got.failures })
    console.log(`${got.status}${entry.needs_ocr ? ', NEEDS OCR' : ''} → ${entry.file}`)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    outcomes.push({ source, status: 'failed', reason })
    console.log(`FAILED: ${reason}`)
  }
}

// Entries whose source was removed from sources.yaml (or renamed) are dropped; their files are
// left for the operator to delete.
const known = new Set(allSources.map(s => s.id))
for (const entry of manifest.filter(e => !known.has(e.id))) {
  console.log(`Dropped manifest entry ${entry.id} (no longer in sources.yaml); file ${entry.file}`)
}
manifest = manifest.filter(e => known.has(e.id))
writeManifest(MANIFEST, manifest)

// The repository is public: documents whose licence does not allow redistribution stay out of
// git. They remain in manifest.json and are re-fetched on a fresh clone.
writeFileSync(
  join(ROOT, '.gitignore'),
  [
    '# Generated by fetch/fetch.ts from sources.yaml (redistribute: false): licences that do not',
    '# allow redistribution in a public repository. Re-fetch with fetch-corpus.',
    ...manifest.filter(e => !e.redistribute).map(e => `/${e.file}`),
    '',
  ].join('\n')
)

if (manualImport) {
  console.log(outcomes[0].status === 'failed' ? '\nNot recorded.' : '\nRecorded in manifest.json.')
} else {
  // Ministry documents: look for the FAW manual's products annex.
  const annexRows: AnnexRow[] = []
  for (const outcome of outcomes) {
    if (outcome.source.tier !== 1 || !outcome.entry) continue
    const file = join(ROOT, outcome.entry.file)
    const pages =
      outcome.entry.format === 'pdf'
        ? (await pdfText(readFileSync(file))).text
        : [readFileSync(file, 'utf8')]
    annexRows.push(...findAnnexRows(outcome.entry.file, pages).rows)
  }
  if (annexRows.length) writeFileSync(ANNEX_CSV, `${annexCsv(annexRows)}\n`)

  const report = renderReport(
    outcomes,
    annexRows.length ? ANNEX_CSV : null,
    new Date().toISOString()
  )
  writeFileSync(join(ROOT, 'fetch-report.md'), report.markdown)
  console.log(`\n${report.summary}`)
}
