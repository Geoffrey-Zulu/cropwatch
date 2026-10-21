import { z } from 'zod'
import { CropSchema } from '../constants/crops'
import { IssueSchema, UNKNOWN_ISSUE, type Issue } from '../constants/issues'
import { ConfidenceBandSchema, EXPERT_REVIEW_CONFIDENCE_THRESHOLD } from '../constants/verification'

const ModelConfidenceSchema = z.number().min(0).max(1)
const SeverityPctSchema = z.number().min(0).max(100)

// CLAUDE.md invariant 4: low confidence or an unknown issue goes to the officer queue.
export function requiresExpertReview(d: { model_confidence: number; suspected_issue: Issue }) {
  return (
    d.model_confidence < EXPERT_REVIEW_CONFIDENCE_THRESHOLD || d.suspected_issue === UNKNOWN_ISSUE
  )
}

// Raw structured output from the model (technicaldoc.md §6). The model's own
// needs_expert_review is advisory only: the server applies requiresExpertReview() before
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

// Stored at observations/{obsId}.diagnosis (technicaldoc.md §4.1).
export const DiagnosisSchema = z
  .object({
    suspected_issue: IssueSchema,
    // INTERNAL. The UI renders confidence_band only, never this number (invariant 3).
    model_confidence: ModelConfidenceSchema,
    confidence_band: ConfidenceBandSchema,
    severity_pct: SeverityPctSchema,
    visible_symptoms: z.array(z.string()),
    needs_expert_review: z.boolean(),
    model_id: z.string().min(1),
    prompt_version: z.string().min(1),
  })
  .refine(d => d.needs_expert_review || !requiresExpertReview(d), {
    message: 'Low confidence or an unknown issue requires needs_expert_review: true',
    path: ['needs_expert_review'],
  })
export type Diagnosis = z.infer<typeof DiagnosisSchema>
