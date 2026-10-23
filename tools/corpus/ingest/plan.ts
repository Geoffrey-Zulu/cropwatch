import type { KnowledgeDocument } from '@repo/shared'
import type { ManifestEntry } from '../fetch/manifest'

export const KNOWLEDGE_BUCKET = 'crop-watch01-knowledge'
export const CORPUS_NAME = 'cropwatch-knowledge'
// technicaldoc §7 layout: knowledge/zambia/moa/…, knowledge/international/fao/…
export const objectName = (entry: ManifestEntry) => `knowledge/${entry.file}`
export const gcsUri = (entry: ManifestEntry) => `gs://${KNOWLEDGE_BUCKET}/${objectName(entry)}`
// Less main content than this is a shell (a footer, a script-rendered page): retrieving it would
// only crowd out real guidance.
export const MIN_TEXT_CHARS = 200

export interface RagFile {
  name: string
  gcsUri: string
}

export interface IngestPlan {
  // Not in the bucket yet, or changed since the last upload (sha256 differs).
  upload: ManifestEntry[]
  // Into the corpus: new documents, and changed ones once their old RagFile is deleted.
  import: ManifestEntry[]
  // RagFiles to delete first: changed documents, and documents no longer in the manifest.
  remove: RagFile[]
  // Scanned PDFs: never ingested silently; they wait for OCR.
  needsOcr: ManifestEntry[]
  // Pages with no real content.
  empty: ManifestEntry[]
  unchanged: ManifestEntry[]
}

export function planIngest(
  manifest: ManifestEntry[],
  // sha256 of each object already uploaded, by object name.
  uploaded: Map<string, string>,
  ragFiles: RagFile[]
): IngestPlan {
  const plan: IngestPlan = {
    upload: [],
    import: [],
    remove: [],
    needsOcr: [],
    empty: [],
    unchanged: [],
  }
  const filesByUri = new Map(ragFiles.map(file => [file.gcsUri, file]))
  const wanted = new Set<string>()

  for (const entry of manifest) {
    if (entry.needs_ocr) {
      plan.needsOcr.push(entry)
      continue
    }
    if (entry.text_chars < MIN_TEXT_CHARS) {
      plan.empty.push(entry)
      continue
    }
    const uri = gcsUri(entry)
    wanted.add(uri)
    const changed = uploaded.get(objectName(entry)) !== entry.sha256
    const inCorpus = filesByUri.get(uri)
    if (changed) plan.upload.push(entry)
    if (changed && inCorpus) plan.remove.push(inCorpus)
    if (changed || !inCorpus) plan.import.push(entry)
    else plan.unchanged.push(entry)
  }
  for (const file of ragFiles) if (!wanted.has(file.gcsUri)) plan.remove.push(file)
  return plan
}

export function knowledgeDocument(entry: ManifestEntry): KnowledgeDocument {
  return {
    id: entry.id,
    title: entry.title,
    gcs_uri: gcsUri(entry),
    source_url: entry.source_url,
    tier: entry.tier,
    source: entry.source,
    country: entry.country,
    crop: entry.crop,
    issue: entry.issue,
    year: entry.year,
    licence: entry.licence,
  }
}
