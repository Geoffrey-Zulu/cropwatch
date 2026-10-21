import { z } from '../zod'
import { CropSchema } from '../constants/crops'
import { IssueSchema, UNKNOWN_ISSUE, type Issue } from '../constants/issues'
import { SeverityBandSchema } from '../constants/severity'
import { ConfidenceBandSchema, EXPERT_REVIEW_CONFIDENCE_THRESHOLD } from '../constants/verification'
import { TimestampSchema } from './common'

const ModelConfidenceSchema = z.number().min(0).max(1)
const SeverityPctSchema = z.number().min(0).max(100)

export const EXPERT_REVIEW_REASONS = [
  'low_confidence',
  'unknown_issue',
  'invalid_model_output',
] as const
export const ExpertReviewReasonSchema = z
  .enum(EXPERT_REVIEW_REASONS)
  .openapi('ExpertReviewReason', {
    description: 'Why a diagnosis was routed to the officer queue instead of being trusted.',
  })
export type ExpertReviewReason = z.infer<typeof ExpertReviewReasonSchema>

// CLAUDE.md invariant 4: low confidence or an unknown issue goes to the officer queue.
export function expertReviewReason(d: {
  model_confidence: number
  suspected_issue: Issue
}): ExpertReviewReason | null {
  if (d.suspected_issue === UNKNOWN_ISSUE) return 'unknown_issue'
  if (d.model_confidence < EXPERT_REVIEW_CONFIDENCE_THRESHOLD) return 'low_confidence'
  return null
}

export function requiresExpertReview(d: { model_confidence: number; suspected_issue: Issue }) {
  return expertReviewReason(d) !== null
}

// Raw structured output from the model (technicaldoc.md §6). The model's own
// needs_expert_review is advisory only: the server applies expertReviewReason() before
// anything is stored.
export const DiagnosisModelOutputSchema = z.object({
  crop: CropSchema,
  suspected_issue: IssueSchema,
  model_confidence: ModelConfidenceSchema,
  severity_pct: SeverityPctSchema,
  growth_stage: z.string().nullable(),
  visible_symptoms: z.array(z.string()),
  needs_expert_review: z.boolean(),
  reasoning_summary: z.string(),
})
export type DiagnosisModelOutput = z.infer<typeof DiagnosisModelOutputSchema>

// observations/{obsId}.diagnosis. UI-bound (the app may listen to this document), so bands
// only: the numbers live in DiagnosisInternalSchema (CLAUDE.md invariant 3).
export const DiagnosisBaseSchema = z.object({
  suspected_issue: IssueSchema,
  confidence_band: ConfidenceBandSchema,
  // null when the model output was unusable.
  severity_band: SeverityBandSchema.nullable(),
  visible_symptoms: z.array(z.string()),
  needs_expert_review: z.boolean(),
  expert_review_reason: ExpertReviewReasonSchema.nullable(),
  model_id: z.string().min(1),
  prompt_version: z.string().min(1),
  diagnosed_at: TimestampSchema,
})

export const DiagnosisSchema = DiagnosisBaseSchema.refine(
  d =>
    d.needs_expert_review || (d.confidence_band !== 'low' && d.suspected_issue !== UNKNOWN_ISSUE),
  {
    message: 'A low band or an unknown issue requires needs_expert_review: true',
    path: ['needs_expert_review'],
  }
).refine(d => d.needs_expert_review === (d.expert_review_reason !== null), {
  message: 'expert_review_reason is set exactly when needs_expert_review is true',
  path: ['expert_review_reason'],
})
export type Diagnosis = z.infer<typeof DiagnosisSchema>

// observations/{obsId}/internal/diagnosis. Never client-readable (infra/firestore.rules has no
// match for it) and never part of any UI-bound shape.
export const DiagnosisInternalSchema = z.object({
  // null when the model output was unusable.
  model_confidence: ModelConfidenceSchema.nullable(),
  severity_pct: SeverityPctSchema.nullable(),
  reasoning_summary: z.string().nullable(),
  // What the model read from the photo, for accuracy scoring against the farmer's report.
  model_crop: CropSchema.nullable(),
  model_growth_stage: z.string().nullable(),
  // Raw text of the last unusable output, kept for prompt tuning.
  invalid_output: z.string().max(20000).nullable(),
  attempts: z.number().int().min(1),
  model_id: z.string().min(1),
  prompt_version: z.string().min(1),
  created_at: TimestampSchema,
})
export type DiagnosisInternal = z.infer<typeof DiagnosisInternalSchema>
