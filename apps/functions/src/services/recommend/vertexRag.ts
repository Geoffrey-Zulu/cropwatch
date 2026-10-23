import { GoogleAuth } from 'google-auth-library'
import { KnowledgeIndexSchema, type KnowledgeIndex } from '@repo/shared'
import type { RetrievedContext, Retrieve } from './ragKnowledge'

const RETRIEVE_TIMEOUT_MS = 15_000
// Re-read so a re-ingest (a new document, the MoA manual when it arrives) is picked up without
// a redeploy.
const INDEX_TTL_MS = 10 * 60_000

// RAG Engine retrieveContexts over REST as the service account. The endpoint's region comes
// from the corpus name (europe-west4: infra/lib.sh explains the exception).
export function vertexRetrieve(
  auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' })
): Retrieve {
  return async (corpus, text, topK) => {
    const [, project, , location] = corpus.split('/')
    const client = await auth.getClient()
    const response = await client.request<{ contexts?: { contexts?: RetrievedContext[] } }>({
      url: `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}:retrieveContexts`,
      method: 'POST',
      data: {
        vertexRagStore: { ragResources: [{ ragCorpus: corpus }] },
        query: { text, ragRetrievalConfig: { topK } },
      },
      timeout: RETRIEVE_TIMEOUT_MS,
    })
    return (response.data.contexts?.contexts ?? []).map(c => ({
      sourceUri: c.sourceUri,
      text: c.text,
    }))
  }
}

const statusOf = (error: unknown) => {
  const e = error as { status?: unknown; response?: { status?: unknown } } | null
  const status = e?.response?.status ?? e?.status
  return typeof status === 'number' ? status : null
}

// Each retrieval embeds the query, and the embedding quota in the RAG region is small (about 7
// requests a minute for a new project), so a burst of reports can hit 429: wait and retry
// (4 s, 8 s, 16 s) rather than fail the recommendation.
export function withRetrieveRetry(
  retrieve: Retrieve,
  {
    retries = 3,
    baseDelayMs = 4000,
    sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
  } = {}
): Retrieve {
  return async (corpus, text, topK) => {
    for (let retry = 0; ; retry++) {
      try {
        return await retrieve(corpus, text, topK)
      } catch (error) {
        const status = statusOf(error)
        const transient = status === 429 || (status !== null && status >= 500)
        if (retry >= retries || !transient) throw error
        await sleep(baseDelayMs * 2 ** retry)
      }
    }
  }
}

// gs://…/index.json, written by tools/corpus ingest. A failed reload keeps the last good index.
export function cachedIndex(
  read: () => Promise<Buffer>,
  now: () => number = Date.now
): () => Promise<KnowledgeIndex> {
  let cached: { index: KnowledgeIndex; at: number } | null = null
  return async () => {
    if (cached && now() - cached.at < INDEX_TTL_MS) return cached.index
    try {
      const index = KnowledgeIndexSchema.parse(JSON.parse((await read()).toString('utf8')))
      cached = { index, at: now() }
      return index
    } catch (error) {
      if (cached) return cached.index
      throw error
    }
  }
}

export function parseGcsUri(uri: string) {
  const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(uri)
  if (!match) throw new Error(`Not a gs:// URI: ${uri}`)
  return { bucket: match[1], object: match[2] }
}
