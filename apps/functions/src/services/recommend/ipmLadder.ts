import {
  RecommendationSchema,
  type Issue,
  type Observation,
  type RegisteredProduct,
  type Recommendation,
} from '@repo/shared'
import { IPM_RUNGS, type KnowledgeLayer, type KnowledgeResult } from './knowledge'
import { filterChemicalCandidates, type FilterResult, type Rejection } from './regulatoryFilter'

// The chemical rung is always written here, never taken from retrieved text, so no model or
// document ever supplies a dose: doses appear only as label_dose on the listed products.
export const CHEMICAL_LAST_RESORT =
  'Chemical control, as a last resort: use one of the registered products listed below at its label dose, and keep to its pre-harvest interval.'
// The contract's officer-referral line (Recommendation.officer_referral).
export const OFFICER_REFERRAL = 'Consult an extension officer for chemical options.'

export type RecommendationOutcome =
  | { kind: 'recommendation'; recommendation: Recommendation; rejected: Rejection[] }
  // No cited evidence: a recommendation without a citation is never issued (buildplan §4.3).
  | { kind: 'insufficient_evidence' }
  // Nothing to recommend for until an officer names the issue.
  | { kind: 'unknown_issue' }

export function buildRecommendation({
  obsId,
  sim,
  now,
  knowledge,
  filtered,
}: {
  obsId: string
  sim: boolean
  now: string
  knowledge: KnowledgeResult
  filtered: FilterResult
}): RecommendationOutcome {
  const known = new Set(knowledge.sources.map(source => source.id))
  const steps = knowledge.steps
    .filter(
      step =>
        step.rung !== 'chemical' &&
        step.text.trim() !== '' &&
        step.source_ids.some(id => known.has(id))
    )
    .sort((a, b) => IPM_RUNGS.indexOf(a.rung) - IPM_RUNGS.indexOf(b.rung))
  if (steps.length === 0) return { kind: 'insufficient_evidence' }

  const cited = new Set(steps.flatMap(step => step.source_ids))
  const sources = knowledge.sources
    .filter(source => cited.has(source.id))
    .sort((a, b) => a.tier - b.tier || a.title.localeCompare(b.title))
    .map(({ title, tier, uri, chunk_ids }) => ({ title, tier, uri, chunk_ids }))

  const recommendation = RecommendationSchema.parse({
    obs_id: obsId,
    created_at: now,
    ipm_steps: [
      ...steps.map(step => step.text),
      filtered.options.length > 0 ? CHEMICAL_LAST_RESORT : OFFICER_REFERRAL,
    ],
    chemical_options: filtered.options,
    rag_sources: sources,
    regulatory_check: {
      passed: filtered.rejected.length === 0,
      rejected_products: filtered.rejected.map(r => `${r.candidate}: ${r.reason}`),
    },
    sim,
  })
  return { kind: 'recommendation', recommendation, rejected: filtered.rejected }
}

// Zambian calendar date, since label expiry dates are Zambian.
export const lusakaDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Africa/Lusaka' })

// /recommend scaffold: knowledge → regulatory filter → IPM ladder. D4 supplies the real
// knowledge layer and wires this into the pipeline.
export async function recommend(
  {
    knowledge,
    products,
    allowPlaceholders = false,
  }: { knowledge: KnowledgeLayer; products: RegisteredProduct[]; allowPlaceholders?: boolean },
  { obsId, observation, now }: { obsId: string; observation: Observation; now: string }
): Promise<RecommendationOutcome> {
  const issue: Issue | undefined =
    observation.verified_issue ?? observation.diagnosis?.suspected_issue
  if (!issue || issue === 'unknown') return { kind: 'unknown_issue' }

  const result = await knowledge.retrieve({
    crop: observation.crop,
    issue,
    growth_stage: observation.growth_stage,
    severity_band: observation.diagnosis?.severity_band ?? null,
    district: observation.district,
  })
  const filtered = filterChemicalCandidates({
    candidates: result.chemical_candidates,
    products,
    crop: observation.crop,
    issue,
    today: lusakaDate(now),
    allowPlaceholders,
  })
  return buildRecommendation({ obsId, sim: observation.sim, now, knowledge: result, filtered })
}
