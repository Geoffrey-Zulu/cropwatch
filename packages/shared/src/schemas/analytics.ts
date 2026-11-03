import { z } from '../zod'
import { CropSchema } from '../constants/crops'
import { IssueSchema } from '../constants/issues'
import { ProvinceSchema } from '../constants/provinces'
import { RoleSchema } from '../constants/roles'
import { SeverityBandSchema } from '../constants/severity'
import {
  ConfidenceBandSchema,
  VERIFICATION_WEIGHTS,
  VerificationStateSchema,
} from '../constants/verification'
import { DistrictSlugSchema, TimestampSchema } from './common'
import { ExpertReviewReasonSchema, type DiagnosisInternal } from './diagnosis'
import { ObservationStatusSchema, type Observation } from './observation'

// cropwatch.observations in BigQuery: one flattened row per observation, INCLUDING the internal
// diagnosis numbers for accuracy and calibration work (frozen contract condition 4). BigQuery
// is never UI-bound. No reporter id: analytics stays at observation and org level (invariant 6).
export const ObservationRowSchema = z.object({
  obs_id: z.string().min(1),
  created_at: TimestampSchema,
  reporter_role: RoleSchema,
  org_id: z.string().nullable(),
  // WKT "POINT(longitude latitude)", loaded as GEOGRAPHY.
  geo: z.string().regex(/^POINT\(-?\d+(\.\d+)? -?\d+(\.\d+)?\)$/),
  geohash: z.string().min(1),
  district: z.string().min(1),
  district_slug: DistrictSlugSchema,
  province: ProvinceSchema,
  camp: z.string().nullable(),
  crop: CropSchema,
  growth_stage: z.string().nullable(),
  status: ObservationStatusSchema,
  // The issue clusters count: the officer's verified issue, else the AI's.
  issue: IssueSchema.nullable(),
  suspected_issue: IssueSchema.nullable(),
  confidence_band: ConfidenceBandSchema.nullable(),
  severity_band: SeverityBandSchema.nullable(),
  needs_expert_review: z.boolean().nullable(),
  expert_review_reason: ExpertReviewReasonSchema.nullable(),
  model_id: z.string().nullable(),
  prompt_version: z.string().nullable(),
  model_confidence: z.number().min(0).max(1).nullable(),
  severity_pct: z.number().min(0).max(100).nullable(),
  diagnosis_attempts: z.number().int().nullable(),
  verification_state: VerificationStateSchema,
  // technicaldoc §4.3 v0 placeholder weight; the cluster rule counts rows with ≥ 0.5.
  verification_weight: z.number(),
  verified_issue: IssueSchema.nullable(),
  sim: z.boolean(),
  // When this snapshot was taken. Live observations are appended to observation_events at each
  // change (diagnosed, verified…), so readers take the latest snapshot per obs_id. Null on rows
  // loaded in bulk (the seed): one row per observation.
  recorded_at: TimestampSchema.nullable().default(null),
})
export type ObservationRow = z.infer<typeof ObservationRowSchema>

type BigQueryField = { name: keyof ObservationRow; type: string; mode: 'REQUIRED' | 'NULLABLE' }

const required = (name: keyof ObservationRow, type: string): BigQueryField => ({
  name,
  type,
  mode: 'REQUIRED',
})
const nullable = (name: keyof ObservationRow, type: string): BigQueryField => ({
  name,
  type,
  mode: 'NULLABLE',
})

export const OBSERVATION_ROW_BIGQUERY_SCHEMA: BigQueryField[] = [
  required('obs_id', 'STRING'),
  required('created_at', 'TIMESTAMP'),
  required('reporter_role', 'STRING'),
  nullable('org_id', 'STRING'),
  required('geo', 'GEOGRAPHY'),
  required('geohash', 'STRING'),
  required('district', 'STRING'),
  required('district_slug', 'STRING'),
  required('province', 'STRING'),
  nullable('camp', 'STRING'),
  required('crop', 'STRING'),
  nullable('growth_stage', 'STRING'),
  required('status', 'STRING'),
  nullable('issue', 'STRING'),
  nullable('suspected_issue', 'STRING'),
  nullable('confidence_band', 'STRING'),
  nullable('severity_band', 'STRING'),
  nullable('needs_expert_review', 'BOOLEAN'),
  nullable('expert_review_reason', 'STRING'),
  nullable('model_id', 'STRING'),
  nullable('prompt_version', 'STRING'),
  nullable('model_confidence', 'FLOAT'),
  nullable('severity_pct', 'FLOAT'),
  nullable('diagnosis_attempts', 'INTEGER'),
  required('verification_state', 'STRING'),
  required('verification_weight', 'FLOAT'),
  nullable('verified_issue', 'STRING'),
  required('sim', 'BOOLEAN'),
  nullable('recorded_at', 'TIMESTAMP'),
]

// cropwatch.observation_events: the same row, streamed by the API each time a report changes
// (diagnosed, verified), stamped with recorded_at. Seed rows load into cropwatch.observations
// with recorded_at null. The view reads the latest state of each report across both, leaving
// out retracted ones (test reports cleaned up by the E2E tools).
export const OBSERVATIONS_LATEST_VIEW = 'observations_latest'

export function observationsLatestSql(project: string, dataset: string) {
  const columns = OBSERVATION_ROW_BIGQUERY_SCHEMA.map(field => field.name).join(', ')
  const table = (name: string) => '`' + `${project}.${dataset}.${name}` + '`'
  return `SELECT * EXCEPT (rn) FROM (
  SELECT *, ROW_NUMBER() OVER (
    PARTITION BY obs_id ORDER BY COALESCE(recorded_at, created_at) DESC) AS rn
  FROM (
    SELECT ${columns} FROM ${table('observations')}
    UNION ALL
    SELECT ${columns} FROM ${table('observation_events')}
  )
)
WHERE rn = 1
  AND obs_id NOT IN (SELECT obs_id FROM ${table('retracted_observations')})`
}

// cropwatch.retracted_observations: reports deleted after the fact (E2E test runs). Rows are
// never removed from the history tables; the view drops these.
export const RETRACTED_OBSERVATION_BIGQUERY_SCHEMA = [
  { name: 'obs_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'retracted_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
  { name: 'reason', type: 'STRING', mode: 'NULLABLE' },
]

// cropwatch.risk_scores: one row per district risk computation (Risk Model v0), for trends and
// later calibration. The qualitative level and its factors only (CLAUDE.md invariant 2).
export const RISK_SCORE_BIGQUERY_SCHEMA = [
  { name: 'district_slug', type: 'STRING', mode: 'REQUIRED' },
  { name: 'district', type: 'STRING', mode: 'REQUIRED' },
  { name: 'level', type: 'STRING', mode: 'REQUIRED' },
  { name: 'contributing_factors', type: 'STRING', mode: 'REPEATED' },
  { name: 'computed_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
  { name: 'sim', type: 'BOOLEAN', mode: 'REQUIRED' },
]

export function toObservationRow(
  obsId: string,
  observation: Observation,
  internal: DiagnosisInternal | null,
  recordedAt: string | null = null
): ObservationRow {
  const { diagnosis, location } = observation
  return ObservationRowSchema.parse({
    obs_id: obsId,
    created_at: observation.created_at,
    reporter_role: observation.reporter_role,
    org_id: observation.org_id,
    geo: `POINT(${location.longitude} ${location.latitude})`,
    geohash: observation.geohash,
    district: observation.district,
    district_slug: observation.district_slug,
    province: observation.province,
    camp: observation.camp,
    crop: observation.crop,
    growth_stage: observation.growth_stage,
    status: observation.status,
    issue: observation.verified_issue ?? diagnosis?.suspected_issue ?? null,
    suspected_issue: diagnosis?.suspected_issue ?? null,
    confidence_band: diagnosis?.confidence_band ?? null,
    severity_band: diagnosis?.severity_band ?? null,
    needs_expert_review: diagnosis?.needs_expert_review ?? null,
    expert_review_reason: diagnosis?.expert_review_reason ?? null,
    model_id: diagnosis?.model_id ?? null,
    prompt_version: diagnosis?.prompt_version ?? null,
    model_confidence: internal?.model_confidence ?? null,
    severity_pct: internal?.severity_pct ?? null,
    diagnosis_attempts: internal?.attempts ?? null,
    verification_state: observation.verification_state,
    verification_weight: VERIFICATION_WEIGHTS[observation.verification_state],
    verified_issue: observation.verified_issue,
    sim: observation.sim,
    recorded_at: recordedAt,
  })
}
