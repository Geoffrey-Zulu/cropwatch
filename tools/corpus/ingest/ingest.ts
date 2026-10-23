// Loads tools/corpus into the RAG Engine corpus (run infra/rag.sh once first):
//
//   pnpm --filter @repo/corpus ingest            upload new or changed documents and import them
//   pnpm --filter @repo/corpus ingest --dry-run  show what would change
//
// Re-ingestion after a re-fetch is the same command: documents whose sha256 changed are
// re-uploaded and their RagFile replaced; documents gone from the manifest are removed from the
// corpus. Scanned PDFs (needs_ocr) are never ingested. Finally writes
// gs://crop-watch01-knowledge/index.json, which the API reads for document metadata.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { KnowledgeIndexSchema } from '@repo/shared'
import { readManifest } from '../fetch/manifest'
import {
  CORPUS_NAME,
  KNOWLEDGE_BUCKET,
  gcsUri,
  knowledgeDocument,
  objectName,
  MIN_TEXT_CHARS,
  planIngest,
} from './plan'
import {
  deleteRagFile,
  findCorpus,
  importRagFiles,
  listRagFiles,
  uploadObject,
  uploadedHashes,
} from './rag'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const dryRun = process.argv.includes('--dry-run')
const IMPORT_BATCH = 1
const IMPORT_ROUNDS = 4
const RETRY_PAUSE_MS = 60_000

const manifest = readManifest(join(ROOT, 'manifest.json'))
if (manifest.length === 0) throw new Error('manifest.json is empty: run fetch-corpus first')

const corpus = await findCorpus(CORPUS_NAME)
if (!corpus) throw new Error(`No corpus named ${CORPUS_NAME}: run bash infra/rag.sh first`)

const plan = planIngest(
  manifest,
  await uploadedHashes(KNOWLEDGE_BUCKET, 'knowledge/'),
  await listRagFiles(corpus)
)

console.log(`Corpus ${corpus}`)
console.log(
  `${plan.upload.length} to upload, ${plan.import.length} to import, ${plan.remove.length} RagFiles to remove, ${plan.unchanged.length} unchanged, ${plan.needsOcr.length} waiting for OCR, ${plan.empty.length} without content`
)
for (const entry of plan.needsOcr) console.log(`  NEEDS OCR (not ingested): ${entry.file}`)
for (const entry of plan.empty) {
  console.log(`  NO CONTENT (not ingested, < ${MIN_TEXT_CHARS} characters): ${entry.file}`)
}
if (dryRun) {
  for (const entry of plan.import) console.log(`  import ${gcsUri(entry)}`)
  for (const file of plan.remove) console.log(`  remove ${file.gcsUri}`)
  process.exit(0)
}

for (const entry of plan.upload) {
  const bytes = readFileSync(join(ROOT, entry.file))
  const contentType = entry.format === 'pdf' ? 'application/pdf' : 'text/markdown'
  await uploadObject(KNOWLEDGE_BUCKET, objectName(entry), bytes, contentType, {
    sha256: entry.sha256,
    source_url: entry.source_url,
  })
  console.log(`  uploaded ${objectName(entry)}`)
}

for (const file of plan.remove) {
  await deleteRagFile(file.name)
  console.log(`  removed ${file.gcsUri}`)
}

// RAG Engine fails a file outright on an embedding 429 instead of waiting, so import one file
// at a time, paced below the quota (rag.ts), and retry whatever is still missing after a pause.
let pending = plan.import.map(gcsUri)
for (let round = 1; pending.length > 0 && round <= IMPORT_ROUNDS; round++) {
  if (round > 1) {
    console.log(`  ${pending.length} not imported yet; retrying in ${RETRY_PAUSE_MS / 1000} s`)
    await new Promise(resolve => setTimeout(resolve, RETRY_PAUSE_MS))
  }
  for (let i = 0; i < pending.length; i += IMPORT_BATCH) {
    const uris = pending.slice(i, i + IMPORT_BATCH)
    const result = await importRagFiles(corpus, uris)
    console.log(
      `  imported ${result.importedRagFilesCount ?? 0} of ${uris.length} (failed ${result.failedRagFilesCount ?? 0})`
    )
  }
  const present = new Set((await listRagFiles(corpus)).map(file => file.gcsUri))
  pending = pending.filter(uri => !present.has(uri))
}

// The index lists what is actually in the corpus now.
const inCorpus = new Set((await listRagFiles(corpus)).map(file => file.gcsUri))
const wanted = manifest.filter(entry => !entry.needs_ocr && entry.text_chars >= MIN_TEXT_CHARS)
const documents = wanted.filter(entry => inCorpus.has(gcsUri(entry))).map(knowledgeDocument)
const missing = wanted.filter(entry => !inCorpus.has(gcsUri(entry)))
for (const entry of missing) console.log(`  NOT IN CORPUS after import: ${entry.file}`)

const index = KnowledgeIndexSchema.parse({
  corpus,
  generated_at: new Date().toISOString(),
  documents,
})
await uploadObject(
  KNOWLEDGE_BUCKET,
  'index.json',
  Buffer.from(`${JSON.stringify(index, null, 2)}\n`),
  'application/json'
)
console.log(`\nindex.json: ${documents.length} documents in ${corpus}`)
if (missing.length > 0) process.exitCode = 1
