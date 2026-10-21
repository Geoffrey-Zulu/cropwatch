import type { ManifestEntry } from './manifest'
import type { Source } from './sources'

export interface Outcome {
  source: Source
  status: 'fetched' | 'archived' | 'mirror' | 'manual' | 'cached' | 'pending' | 'failed'
  entry?: ManifestEntry
  // What failed before the saved copy was found.
  failures?: string[]
  reason?: string
}

// D4 proceeds only if at least this many of the priority documents landed.
export const PRIORITY_GATE = 6
// Below these, extraction is worth a human look: a page with little main content, or a PDF with
// little text per page (partly scanned, or text set as images).
const THIN_PAGE_CHARS = 1000
const SPARSE_PDF_CHARS_PER_PAGE = 500

export function extractionConcern(entry: ManifestEntry) {
  if (entry.needs_ocr) return 'scanned: needs OCR, not ingested'
  if (entry.format === 'md' && entry.text_chars < THIN_PAGE_CHARS) {
    return `thin page: ${entry.text_chars} characters of main content`
  }
  if (entry.pages && entry.text_chars / entry.pages < SPARSE_PDF_CHARS_PER_PAGE) {
    return `sparse text: ${Math.round(entry.text_chars / entry.pages)} characters a page`
  }
  return null
}

const describe = (o: Outcome) => {
  switch (o.status) {
    case 'fetched':
      return 'fetched'
    case 'archived':
      return `fetched via archive (${o.entry!.archive_url}); ${o.failures?.join('; ')}`
    case 'mirror':
      return `fetched from mirror <${o.entry!.fetched_url}>; ${o.failures?.join('; ')}`
    case 'manual':
      return `recorded from a hand download (${o.entry!.fetched_url})`
    case 'cached':
      return o.entry!.fetched_url === o.entry!.source_url
        ? 'unchanged'
        : `unchanged (copy from <${o.entry!.fetched_url}>)`
    case 'pending':
      return `pending: ${o.source.pending}`
    case 'failed':
      return `**FAILED**: ${o.reason}`
  }
}

export function renderReport(outcomes: Outcome[], annexCsv: string | null, at: string) {
  const landed = (o: Outcome) => o.entry !== undefined
  const priority = outcomes.filter(o => o.source.priority)
  const priorityLanded = priority.filter(landed)
  const gate = priorityLanded.length >= PRIORITY_GATE
  const ocr = outcomes.filter(o => o.entry?.needs_ocr)
  const concerns = outcomes.filter(o => o.entry && extractionConcern(o.entry))
  const notInGit = outcomes.filter(o => o.entry && !o.entry.redistribute)
  const failed = outcomes.filter(o => o.status === 'failed')
  const count = (status: Outcome['status']) => outcomes.filter(o => o.status === status).length

  const summary = [
    `${outcomes.length} sources: ${count('fetched')} fetched, ${count('archived')} via archive, ${count('mirror')} from a mirror, ${count('manual')} by hand, ${count('cached')} unchanged, ${count('pending')} pending, ${failed.length} FAILED.`,
    `Priority documents landed: ${priorityLanded.length}/${priority.length} (gate: ≥ ${PRIORITY_GATE}) → ${gate ? 'PASS' : 'FAIL'}.`,
    ocr.length
      ? `Needs OCR (not ingested): ${ocr.map(o => o.source.id).join(', ')}.`
      : 'No scanned PDFs detected.',
    concerns.length
      ? `Extraction worth a look: ${concerns.map(o => o.source.id).join(', ')}.`
      : 'Extraction looks sound for every saved document.',
    annexCsv
      ? `FAW annex candidates written to ${annexCsv} (review only).`
      : 'No FAW products annex found.',
  ].join('\n')

  const rows = outcomes.map(o =>
    [
      o.source.priority ? '★' : '',
      `\`${o.source.id}\``,
      o.source.tier,
      describe(o),
      o.entry ? `\`${o.entry.file}\`${o.entry.redistribute ? '' : ' (not in git)'}` : '—',
      (o.entry && extractionConcern(o.entry)) ?? '',
    ].join(' | ')
  )

  const markdown = [
    '# Corpus fetch report',
    '',
    `Generated ${at} by \`pnpm --filter @repo/corpus fetch-corpus\`. ★ = priority document (D4 gate).`,
    '',
    ...summary.split('\n').map(line => `- ${line}`),
    '',
    '| ★ | id | tier | outcome | file | extraction |',
    '| - | -- | ---- | ------- | ---- | ---------- |',
    ...rows.map(row => `| ${row} |`),
    '',
    ...(failed.length
      ? [
          '## To fetch by hand',
          '',
          'These failed live, in the Wayback Machine and on any mirror. Download each in a browser (or get it from the publisher), then record it; the fetcher checks the file and adds its manifest entry:',
          '',
          '    pnpm --filter @repo/corpus fetch-corpus --import <id> <downloaded file>',
          '',
          ...failed.map(
            o => `- \`${o.source.id}\`: ${o.source.title} — <${o.source.url}> (${o.reason})`
          ),
          '',
        ]
      : []),
    ...(notInGit.length
      ? [
          '## Not committed (licence)',
          '',
          'The repository is public, so these are fetched and ingested but kept out of git (`redistribute: false` in sources.yaml).',
          '',
          ...notInGit.map(
            o => `- \`${o.source.id}\`: ${o.entry!.licence ?? 'no licence statement'}`
          ),
          '',
        ]
      : []),
  ].join('\n')

  return { summary, markdown, gate }
}
