import { z } from '../zod'
import { CropSchema } from '../constants/crops'
import { KnownIssueSchema } from '../constants/issues'
import { AuthorityTierSchema } from './recommendation'

// gs://crop-watch01-knowledge/index.json, written by tools/corpus ingest and read by the API at
// startup: which corpus to query, and the curated metadata of every document in it
// (technicaldoc §7). Not part of the mobile contract.
export const KnowledgeDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  // Where RAG Engine imported it from; retrieved chunks carry this as their source.
  gcs_uri: z.string().startsWith('gs://'),
  // The publisher's URL, which citations show.
  source_url: z.string().url(),
  tier: AuthorityTierSchema,
  source: z.string().min(1),
  country: z.string().min(2),
  crop: z.array(CropSchema),
  issue: z.array(KnownIssueSchema),
  year: z.number().int(),
  licence: z.string().nullable(),
})
export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>

export const KnowledgeIndexSchema = z.object({
  // projects/{project}/locations/{region}/ragCorpora/{id}
  corpus: z.string().regex(/^projects\/[^/]+\/locations\/[^/]+\/ragCorpora\/[^/]+$/),
  generated_at: z.string().datetime(),
  documents: z.array(KnowledgeDocumentSchema).min(1),
})
export type KnowledgeIndex = z.infer<typeof KnowledgeIndexSchema>
