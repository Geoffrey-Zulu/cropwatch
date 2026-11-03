// The cropwatch BigQuery tables and view (technicaldoc §4.2), from the schemas in @repo/shared.
// Idempotent: creates what is missing, appends new nullable columns, refreshes the view.
// infra/setup.sh runs it; the seed runs it before loading.
//
//   pnpm --filter @repo/seed tables
import { pathToFileURL } from 'node:url'
import {
  OBSERVATION_ROW_BIGQUERY_SCHEMA,
  OBSERVATIONS_LATEST_VIEW,
  observationsLatestSql,
  RETRACTED_OBSERVATION_BIGQUERY_SCHEMA,
  RISK_SCORE_BIGQUERY_SCHEMA,
} from '@repo/shared'
import { ensureTable, ensureView, PROJECT_ID, type TableSpec } from '@repo/tools-gcp'

export const DATASET = 'cropwatch'

const TABLES: TableSpec[] = [
  {
    dataset: DATASET,
    table: 'observations',
    fields: OBSERVATION_ROW_BIGQUERY_SCHEMA,
    partitionField: 'created_at',
    clusterFields: ['district_slug', 'issue'],
    description:
      'One row per observation, including internal diagnosis numbers (contract condition 4). Loaded by the seed (sim rows).',
  },
  {
    dataset: DATASET,
    table: 'observation_events',
    fields: OBSERVATION_ROW_BIGQUERY_SCHEMA,
    partitionField: 'created_at',
    clusterFields: ['issue', 'district_slug'],
    description:
      'A snapshot of a report each time the API changes it (diagnosed, verified), stamped recorded_at. Streamed.',
  },
  {
    dataset: DATASET,
    table: 'retracted_observations',
    fields: RETRACTED_OBSERVATION_BIGQUERY_SCHEMA,
    description:
      'Reports deleted after the fact (E2E test runs); observations_latest leaves them out.',
  },
  {
    dataset: DATASET,
    table: 'risk_scores',
    fields: RISK_SCORE_BIGQUERY_SCHEMA,
    partitionField: 'computed_at',
    clusterFields: ['district_slug'],
    description: 'District risk (Risk Model v0): qualitative level and contributing factors.',
  },
]

export async function ensureAnalyticsTables() {
  const results: string[] = []
  for (const spec of TABLES) results.push(`${spec.table} ${await ensureTable(spec)}`)
  const view = await ensureView(
    DATASET,
    OBSERVATIONS_LATEST_VIEW,
    observationsLatestSql(PROJECT_ID, DATASET)
  )
  results.push(`${OBSERVATIONS_LATEST_VIEW} (view) ${view}`)
  return results
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  for (const line of await ensureAnalyticsTables()) console.log(`  ${DATASET}.${line}`)
}
