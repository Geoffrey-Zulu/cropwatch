import { gcpFetch, PROJECT_ID, RAG_REGION } from '@repo/tools-gcp'
import type { RagFile } from './plan'

// RAG Engine and Cloud Storage over REST, as the authorized account (tools/gcp).
const AIP = `https://${RAG_REGION}-aiplatform.googleapis.com/v1`
const LOCATION = `projects/${PROJECT_ID}/locations/${RAG_REGION}`
const STORAGE = 'https://storage.googleapis.com/storage/v1'
const UPLOAD = 'https://storage.googleapis.com/upload/storage/v1'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

interface Operation {
  name: string
  done?: boolean
  error?: { message: string }
  response?: Record<string, unknown>
}

export async function waitOperation(name: string, timeoutMs = 30 * 60_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const op = (await (await gcpFetch(`${AIP}/${name}`)).json()) as Operation
    if (op.done) {
      if (op.error) throw new Error(`${name}: ${op.error.message}`)
      return op.response ?? {}
    }
    if (Date.now() > deadline) throw new Error(`${name} still running`)
    await sleep(5000)
  }
}

export async function findCorpus(displayName: string) {
  const body = (await (await gcpFetch(`${AIP}/${LOCATION}/ragCorpora`)).json()) as {
    ragCorpora?: { name: string; displayName: string }[]
  }
  return body.ragCorpora?.find(corpus => corpus.displayName === displayName)?.name ?? null
}

export async function listRagFiles(corpus: string): Promise<RagFile[]> {
  const files: RagFile[] = []
  let pageToken = ''
  do {
    const body = (await (
      await gcpFetch(
        `${AIP}/${corpus}/ragFiles?pageSize=100${pageToken ? `&pageToken=${pageToken}` : ''}`
      )
    ).json()) as {
      ragFiles?: { name: string; gcsSource?: { uris?: string[] } }[]
      nextPageToken?: string
    }
    for (const file of body.ragFiles ?? []) {
      const uri = file.gcsSource?.uris?.[0]
      if (uri) files.push({ name: file.name, gcsUri: uri })
    }
    pageToken = body.nextPageToken ?? ''
  } while (pageToken)
  return files
}

export async function deleteRagFile(name: string) {
  const op = (await (await gcpFetch(`${AIP}/${name}`, { method: 'DELETE' })).json()) as Operation
  if (op.name && !op.done) await waitOperation(op.name)
}

// Fixed-length chunks: about a page of a factsheet, with overlap so a step that straddles a
// boundary is still retrievable whole.
export async function importRagFiles(corpus: string, uris: string[]) {
  const op = (await (
    await gcpFetch(`${AIP}/${corpus}/ragFiles:import`, {
      method: 'POST',
      body: JSON.stringify({
        importRagFilesConfig: {
          gcsSource: { uris },
          ragFileTransformationConfig: {
            ragFileChunkingConfig: { fixedLengthChunking: { chunkSize: 512, chunkOverlap: 100 } },
          },
          // Below this project's text-embedding quota in the RAG region (about 7 requests a
          // minute for a new project): RAG Engine fails a file on the first 429 instead of
          // waiting. Raise both together if the quota is increased.
          maxEmbeddingRequestsPerMin: 5,
        },
      }),
    })
  ).json()) as Operation
  return (await waitOperation(op.name)) as {
    importedRagFilesCount?: string
    failedRagFilesCount?: string
    skippedRagFilesCount?: string
  }
}

export interface RetrievedContext {
  sourceUri: string
  text: string
  score?: number
}

export async function retrieveContexts(corpus: string, text: string, topK: number) {
  const body = (await (
    await gcpFetch(`${AIP}/${LOCATION}:retrieveContexts`, {
      method: 'POST',
      body: JSON.stringify({
        vertexRagStore: { ragResources: [{ ragCorpus: corpus }] },
        query: { text, ragRetrievalConfig: { topK } },
      }),
    })
  ).json()) as { contexts?: { contexts?: RetrievedContext[] } }
  return body.contexts?.contexts ?? []
}

// sha256 recorded on each uploaded object, by object name under the prefix.
export async function uploadedHashes(bucket: string, prefix: string) {
  const hashes = new Map<string, string>()
  let pageToken = ''
  do {
    const body = (await (
      await gcpFetch(
        `${STORAGE}/b/${bucket}/o?prefix=${encodeURIComponent(prefix)}&fields=items(name,metadata),nextPageToken${pageToken ? `&pageToken=${pageToken}` : ''}`
      )
    ).json()) as {
      items?: { name: string; metadata?: { sha256?: string } }[]
      nextPageToken?: string
    }
    for (const item of body.items ?? []) hashes.set(item.name, item.metadata?.sha256 ?? '')
    pageToken = body.nextPageToken ?? ''
  } while (pageToken)
  return hashes
}

export async function uploadObject(
  bucket: string,
  name: string,
  bytes: Buffer,
  contentType: string,
  metadata: Record<string, string> = {}
) {
  const boundary = `cropwatch-${Date.now()}`
  const head = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify({ name, contentType, metadata }),
    `--${boundary}`,
    `Content-Type: ${contentType}`,
    '',
    '',
  ].join('\r\n')
  await gcpFetch(`${UPLOAD}/b/${bucket}/o?uploadType=multipart`, {
    method: 'POST',
    headers: { 'content-type': `multipart/related; boundary=${boundary}` },
    body: Buffer.concat([Buffer.from(head), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]),
  })
}
