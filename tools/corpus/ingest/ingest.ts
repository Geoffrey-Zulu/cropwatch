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
// RAG Engine accepts up to 25 URIs per import request.
const IMPORT_BATCH = 25

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
  `${plan.upload.length} to upload, ${plan.import.length} to import, ${plan.remove.length} RagFiles to remove, ${plan.unchanged.length} unchanged, ${plan.needsOcr.length} waiting for OCR`
)
for (const entry of plan.needsOcr) console.log(`  NEEDS OCR (not ingested): ${entry.file}`)
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

let failed = 0
for (let i = 0; i < plan.import.length; i += IMPORT_BATCH) {
  const uris = plan.import.slice(i, i + IMPORT_BATCH).map(gcsUri)
  const result = await importRagFiles(corpus, uris)
  failed += Number(result.failedRagFilesCount ?? 0)
  console.log(
    `  imported ${result.importedRagFilesCount ?? 0} of ${uris.length} (skipped ${result.skippedRagFilesCount ?? 0}, failed ${result.failedRagFilesCount ?? 0})`
  )
}

// The index lists what is actually in the corpus now.
const inCorpus = new Set((await listRagFiles(corpus)).map(file => file.gcsUri))
const documents = manifest
  .filter(entry => !entry.needs_ocr && inCorpus.has(gcsUri(entry)))
  .map(knowledgeDocument)
const missing = manifest.filter(entry => !entry.needs_ocr && !inCorpus.has(gcsUri(entry)))
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
if (failed > 0 || missing.length > 0) process.exitCode = 1
