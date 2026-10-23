import { createHash } from 'node:crypto'
import {
  CROP_LABELS,
  ISSUE_LABELS,
  type KnowledgeDocument,
  type KnowledgeIndex,
} from '@repo/shared'
import type { GenerateFn } from '../diagnosisModel'
import { render, type Prompt } from '../prompt'
import type {
  ChemicalCandidate,
  KnowledgeLayer,
  KnowledgeQuery,
  KnowledgeResult,
  KnowledgeSource,
  KnowledgeStep,
} from './knowledge'

// The knowledge layer on RAG Engine (technicaldoc §7): context-shaped retrieval from the
// curated corpus, then Gemini turns the retrieved excerpts into cited IPM steps. Everything the
// model returns is checked here: a step must cite an excerpt it was shown, and may not carry a
// dose or name a pesticide (those go to the regulatory filter as candidates, and doses only
// ever come from registered labels).

export interface RetrievedContext {
  sourceUri: string
  text: string
}

export type Retrieve = (corpus: string, query: string, topK: number) => Promise<RetrievedContext[]>

const TOP_K = 20
const MAX_EXCERPTS = 10
const MAX_PER_DOCUMENT = 3
const MAX_STEPS = 6
const MAX_STEP_CHARS = 400

export function retrievalQuery(query: KnowledgeQuery) {
  const issue = query.issue === 'unknown' ? 'unknown' : ISSUE_LABELS[query.issue]
  return [
    `crop=${query.crop} issue=${query.issue} growth_stage=${query.growth_stage ?? 'unknown'}`,
    `severity=${query.severity_band ?? 'unknown'} district=${query.district}`,
    `question="evidence-backed interventions appropriate to this situation, IPM-first:`,
    `scouting, cultural and biological control of ${issue} on ${CROP_LABELS[query.crop]}"`,
  ].join(' ')
}

export interface Excerpt {
  // S1, S2 … in the order the model sees them.
  ref: string
  document: KnowledgeDocument
  chunkId: string
  text: string
}

// A document is about this situation if it names the issue, or if it is a general guide to
// this crop (no issue tags). Anything else retrieved is off-topic.
export function relevant(document: KnowledgeDocument, query: KnowledgeQuery) {
  if (query.issue === 'unknown') return false
  if (document.issue.length > 0) return document.issue.includes(query.issue)
  return document.crop.includes(query.crop)
}

const chunkId = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 12)

// Keeps the most relevant on-topic excerpts (retrieval order), a few per document, then puts
// them in authority order so the model reads local sources first.
export function selectExcerpts(
  contexts: RetrievedContext[],
  index: KnowledgeIndex,
  query: KnowledgeQuery
): Excerpt[] {
  const byUri = new Map(index.documents.map(document => [document.gcs_uri, document]))
  const perDocument = new Map<string, number>()
  const seen = new Set<string>()
  const picked: { document: KnowledgeDocument; text: string; rank: number }[] = []

  contexts.forEach((context, rank) => {
    const document = byUri.get(context.sourceUri)
    const text = context.text.trim()
    if (!document || !text || !relevant(document, query) || seen.has(text)) return
    if (picked.length >= MAX_EXCERPTS) return
    const count = perDocument.get(document.id) ?? 0
    if (count >= MAX_PER_DOCUMENT) return
    perDocument.set(document.id, count + 1)
    seen.add(text)
    picked.push({ document, text, rank })
  })

  return picked
    .sort((a, b) => a.document.tier - b.document.tier || a.rank - b.rank)
    .map(({ document, text }, i) => ({ ref: `S${i + 1}`, document, chunkId: chunkId(text), text }))
}

// Gemini's reply shape (responseJsonSchema). The chemical rung is not here: CropWatch writes it.
export const COMPOSITION_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          rung: { type: 'string', enum: ['scout', 'cultural', 'biological'] },
          text: { type: 'string' },
          source_refs: { type: 'array', items: { type: 'string' } },
        },
        required: ['rung', 'text', 'source_refs'],
      },
    },
    chemical_candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          active_ingredient: { type: 'string' },
          source_refs: { type: 'array', items: { type: 'string' } },
        },
        required: ['active_ingredient', 'source_refs'],
      },
    },
  },
  required: ['steps', 'chemical_candidates'],
} as const

export function compositionRequest(prompt: Prompt, query: KnowledgeQuery, excerpts: Excerpt[]) {
  return {
    system: prompt.system,
    user: render(prompt.user, {
      crop: CROP_LABELS[query.crop],
      issue: query.issue === 'unknown' ? 'unknown' : ISSUE_LABELS[query.issue],
      growth_stage: query.growth_stage ?? 'not given',
      severity: query.severity_band ?? 'not given',
      district: query.district,
      excerpts: excerpts
        .map(
          e =>
            `[${e.ref}] tier ${e.document.tier} · ${e.document.source} · ${e.document.title} (${e.document.year})\n${e.text}`
        )
        .join('\n\n'),
    }),
    photos: [],
  }
}

// Quantities of anything (rates, concentrations, intervals) and pre-harvest/re-entry intervals.
// A step that carries one is dropped, never edited: doses come only from registered labels.
const DOSE =
  /\d+(?:[.,]\d+)?\s*(?:ml|mls|millilit(?:re|er)s?|l|lit(?:re|er)s?|g|grams?|kg|mg|cc|%|ppm|tablespoons?|teaspoons?|cups?)\b|\bper\s+(?:\d+\s*)?(?:lit(?:re|er)|ha\b|hectare|knapsack|acre|plant)|\b(?:PHI|REI)\b|pre-?harvest interval/i

// Pesticides belong to the regulatory filter, not to step text: common active ingredients in
// the corpus, plus microbial and generic product words.
const PESTICIDE =
  /\b(?:emamectin|chlorantraniliprole|spinetoram|spinosad|flubendiamide|indoxacarb|lambda-?cyhalothrin|cypermethrin|deltamethrin|bifenthrin|abamectin|imidacloprid|thiamethoxam|acetamiprid|chlorpyrifos|dimethoate|profenofos|lufenuron|novaluron|methomyl|carbaryl|mancozeb|chlorothalonil|metalaxyl|mefenoxam|azoxystrobin|difenoconazole|propineb|cymoxanil|copper (?:oxychloride|hydroxide|sulphate|sulfate)|copper-based|bacillus thuringiensis|\bBt\b|beauveria|metarhizium|azadirachtin|insecticides?|fungicides?|pesticides?|acaricides?)\b/i

export interface CompositionCheck {
  result: KnowledgeResult
  // Steps the model wrote that broke a rule, with the rule, for the internal record.
  dropped: { text: string; reason: string }[]
}

interface RawComposition {
  steps?: { rung?: unknown; text?: unknown; source_refs?: unknown }[]
  chemical_candidates?: { active_ingredient?: unknown; source_refs?: unknown }[]
}

export function checkComposition(raw: unknown, excerpts: Excerpt[]): CompositionCheck {
  const reply = (raw ?? {}) as RawComposition
  const byRef = new Map(excerpts.map(e => [e.ref, e]))
  const refsOf = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((r): r is string => typeof r === 'string' && byRef.has(r))
      : []
  const dropped: CompositionCheck['dropped'] = []
  const cited = new Set<string>()

  const steps: KnowledgeStep[] = []
  const texts = new Set<string>()
  for (const step of reply.steps ?? []) {
    const text = typeof step.text === 'string' ? step.text.replace(/\s+/g, ' ').trim() : ''
    const rung = step.rung
    const refs = refsOf(step.source_refs)
    if (rung !== 'scout' && rung !== 'cultural' && rung !== 'biological') continue
    if (!text || texts.has(text)) continue
    const reason =
      refs.length === 0
        ? 'no valid citation'
        : DOSE.test(text)
          ? 'dose or interval in step text'
          : PESTICIDE.test(text)
            ? 'pesticide named in step text'
            : text.length > MAX_STEP_CHARS
              ? 'too long'
              : null
    if (reason) {
      dropped.push({ text, reason })
      continue
    }
    if (steps.length >= MAX_STEPS) continue
    texts.add(text)
    refs.forEach(ref => cited.add(ref))
    steps.push({
      rung,
      text,
      source_ids: [...new Set(refs.map(ref => byRef.get(ref)!.document.id))],
    })
  }

  const candidates: ChemicalCandidate[] = []
  const names = new Set<string>()
  for (const candidate of reply.chemical_candidates ?? []) {
    const name =
      typeof candidate.active_ingredient === 'string' ? candidate.active_ingredient.trim() : ''
    const refs = refsOf(candidate.source_refs)
    if (!name || refs.length === 0 || names.has(name.toLowerCase())) continue
    names.add(name.toLowerCase())
    candidates.push({
      active_ingredient: name,
      source_ids: [...new Set(refs.map(ref => byRef.get(ref)!.document.id))],
    })
  }

  // Sources: the documents behind the excerpts the steps cite, with those excerpts' chunk ids.
  const sources = new Map<string, KnowledgeSource>()
  for (const ref of cited) {
    const { document, chunkId } = byRef.get(ref)!
    const source = sources.get(document.id) ?? {
      id: document.id,
      title: document.title,
      tier: document.tier,
      uri: document.source_url,
      chunk_ids: [],
    }
    if (!source.chunk_ids.includes(chunkId)) source.chunk_ids.push(chunkId)
    sources.set(document.id, source)
  }

  return {
    result: { steps, chemical_candidates: candidates, sources: [...sources.values()] },
    dropped,
  }
}

export interface RagKnowledgeTrace extends Record<string, unknown> {
  query: string
  retrieved: number
  excerpts: { ref: string; document_id: string; tier: number; chunk_id: string }[]
  dropped: CompositionCheck['dropped']
  model_id: string
  prompt_version: string
  retrieve_ms: number
  compose_ms: number
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export function ragKnowledge({
  loadIndex,
  retrieve,
  compose,
  prompt,
  modelId,
  now = () => Date.now(),
}: {
  loadIndex: () => Promise<KnowledgeIndex>
  retrieve: Retrieve
  compose: GenerateFn
  prompt: Prompt
  modelId: string
  now?: () => number
}): KnowledgeLayer {
  const empty = (trace: RagKnowledgeTrace): KnowledgeResult => ({
    steps: [],
    chemical_candidates: [],
    sources: [],
    trace,
  })

  return {
    async retrieve(query) {
      const index = await loadIndex()
      const text = retrievalQuery(query)
      const t0 = now()
      const contexts = await retrieve(index.corpus, text, TOP_K)
      const t1 = now()
      const excerpts = selectExcerpts(contexts, index, query)
      const trace: RagKnowledgeTrace = {
        query: text,
        retrieved: contexts.length,
        excerpts: excerpts.map(e => ({
          ref: e.ref,
          document_id: e.document.id,
          tier: e.document.tier,
          chunk_id: e.chunkId,
        })),
        dropped: [],
        model_id: modelId,
        prompt_version: prompt.version,
        retrieve_ms: t1 - t0,
        compose_ms: 0,
      }
      if (excerpts.length === 0) return empty(trace)

      // One retry on an unusable reply; after that, no steps (officer referral), never a guess.
      let check: CompositionCheck | null = null
      for (let attempt = 1; attempt <= 2 && !check; attempt++) {
        const reply = await compose(compositionRequest(prompt, query, excerpts))
        trace.model_id = reply.modelVersion || modelId
        const parsed = parseJson(reply.text)
        if (parsed && typeof parsed === 'object') check = checkComposition(parsed, excerpts)
      }
      trace.compose_ms = now() - t1
      if (!check) return empty(trace)
      trace.dropped = check.dropped
      return { ...check.result, trace }
    },
  }
}
