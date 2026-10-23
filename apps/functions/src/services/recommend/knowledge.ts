import type { Crop, Issue, SeverityBand } from '@repo/shared'

// The IPM ladder, in the order advice is given (technicaldoc §7): chemical control comes last.
export const IPM_RUNGS = ['scout', 'cultural', 'biological', 'chemical'] as const
export type IpmRung = (typeof IPM_RUNGS)[number]

// Context-shaped retrieval, not chat (technicaldoc §7). District only, never coordinates.
export interface KnowledgeQuery {
  crop: Crop
  issue: Issue
  growth_stage: string | null
  severity_band: SeverityBand | null
  district: string
}

export interface KnowledgeSource {
  id: string
  title: string
  // 1 MoA … 6 research; lower wins on conflict.
  tier: number
  uri: string
  chunk_ids: string[]
}

export interface KnowledgeStep {
  rung: IpmRung
  text: string
  source_ids: string[]
}

// A chemical the evidence mentions. Never trusted as-is: the regulatory filter decides whether
// it may be shown, and the dose always comes from the registered label.
export interface ChemicalCandidate {
  registration_no?: string
  trade_name?: string
  active_ingredient?: string
  source_ids: string[]
}

export interface KnowledgeResult {
  steps: KnowledgeStep[]
  chemical_candidates: ChemicalCandidate[]
  sources: KnowledgeSource[]
  // How the result was reached (query, excerpts, dropped steps, model), for the internal record.
  trace?: Record<string, unknown>
}

export interface KnowledgeLayer {
  retrieve(query: KnowledgeQuery): Promise<KnowledgeResult>
}

// For tests and local runs without a corpus: refuses rather than inventing advice.
export const knowledgeNotReady: KnowledgeLayer = {
  async retrieve() {
    throw new Error('No knowledge layer configured')
  },
}
