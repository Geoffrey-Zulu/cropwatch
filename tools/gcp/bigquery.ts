import { gcpFetch, PROJECT_ID, REGION } from './auth'

// BigQuery REST. Bulk rows go in with load jobs, not streaming inserts: streamed rows sit in a
// buffer for ~30 min where DML cannot delete them, which would break re-seeding.

const API = `https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT_ID}`
const UPLOAD = `https://bigquery.googleapis.com/upload/bigquery/v2/projects/${PROJECT_ID}`

export interface TableSpec {
  dataset: string
  table: string
  fields: { name: string; type: string; mode: string }[]
  partitionField?: string
  clusterFields?: string[]
  description?: string
}

// Creates the table if missing, or appends columns the spec has gained (BigQuery only adds
// NULLABLE or REPEATED columns in place). Returns what it did.
export async function ensureTable(spec: TableSpec): Promise<'created' | 'extended' | 'exists'> {
  const url = `${API}/datasets/${spec.dataset}/tables`
  try {
    const table = (await (await gcpFetch(`${url}/${spec.table}`)).json()) as {
      schema: { fields: TableSpec['fields'] }
    }
    const have = new Set(table.schema.fields.map(field => field.name))
    const missing = spec.fields.filter(field => !have.has(field.name))
    if (missing.length === 0) return 'exists'
    if (missing.some(field => field.mode === 'REQUIRED'))
      throw new Error(`${spec.table}: cannot add REQUIRED columns to an existing table`)
    await gcpFetch(`${url}/${spec.table}`, {
      method: 'PATCH',
      body: JSON.stringify({ schema: { fields: [...table.schema.fields, ...missing] } }),
    })
    return 'extended'
  } catch (error) {
    if (!String(error).includes('HTTP 404')) throw error
  }
  await gcpFetch(url, {
    method: 'POST',
    body: JSON.stringify({
      tableReference: { projectId: PROJECT_ID, datasetId: spec.dataset, tableId: spec.table },
      description: spec.description,
      schema: { fields: spec.fields },
      ...(spec.partitionField && {
        timePartitioning: { type: 'DAY', field: spec.partitionField },
      }),
      ...(spec.clusterFields && { clustering: { fields: spec.clusterFields } }),
    }),
  })
  return 'created'
}

// Creates the view, or replaces its query when it has changed.
export async function ensureView(dataset: string, view: string, sql: string) {
  const url = `${API}/datasets/${dataset}/tables`
  const body = {
    tableReference: { projectId: PROJECT_ID, datasetId: dataset, tableId: view },
    view: { query: sql, useLegacySql: false },
  }
  try {
    const current = (await (await gcpFetch(`${url}/${view}`)).json()) as {
      view?: { query: string }
    }
    if (current.view?.query === sql) return 'exists'
    await gcpFetch(`${url}/${view}`, { method: 'PUT', body: JSON.stringify(body) })
    return 'updated'
  } catch (error) {
    if (!String(error).includes('HTTP 404')) throw error
  }
  await gcpFetch(url, { method: 'POST', body: JSON.stringify(body) })
  return 'created'
}

interface Job {
  jobReference: { jobId: string; location: string }
  status: { state: string; errorResult?: unknown; errors?: unknown[] }
  statistics?: { load?: { outputRows?: string }; query?: { numDmlAffectedRows?: string } }
}

async function waitForJob(job: Job): Promise<Job> {
  let current = job
  while (current.status.state !== 'DONE') {
    await new Promise(resolve => setTimeout(resolve, 1000))
    const { jobId, location } = current.jobReference
    current = (await (await gcpFetch(`${API}/jobs/${jobId}?location=${location}`)).json()) as Job
  }
  if (current.status.errorResult) {
    throw new Error(
      `BigQuery job failed: ${JSON.stringify(current.status.errors ?? current.status.errorResult)}`
    )
  }
  return current
}

// Standard SQL, e.g. DML. Returns the number of rows a DML statement affected.
export async function query(sql: string) {
  const response = await gcpFetch(`${API}/queries`, {
    method: 'POST',
    body: JSON.stringify({ query: sql, useLegacySql: false, location: REGION }),
  })
  const result = (await response.json()) as {
    jobComplete: boolean
    jobReference: Job['jobReference']
    numDmlAffectedRows?: string
  }
  if (result.jobComplete) return Number(result.numDmlAffectedRows ?? 0)
  const done = await waitForJob({ jobReference: result.jobReference, status: { state: 'RUNNING' } })
  return Number(done.statistics?.query?.numDmlAffectedRows ?? 0)
}

// multipart/related body for a load job: JSON metadata, then the newline-delimited JSON rows.
export function multipartBody(metadata: unknown, ndjson: string, boundary: string) {
  return [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/octet-stream',
    '',
    ndjson,
    `--${boundary}--`,
    '',
  ].join('\r\n')
}

// Appends rows with a load job and waits for it; returns the rows loaded.
export async function loadRows(dataset: string, table: string, rows: object[]) {
  if (rows.length === 0) return 0
  const boundary = `cropwatch-${Date.now()}`
  const metadata = {
    jobReference: { projectId: PROJECT_ID, location: REGION },
    configuration: {
      load: {
        destinationTable: { projectId: PROJECT_ID, datasetId: dataset, tableId: table },
        sourceFormat: 'NEWLINE_DELIMITED_JSON',
        writeDisposition: 'WRITE_APPEND',
      },
    },
  }
  const ndjson = rows.map(row => JSON.stringify(row)).join('\n')
  const response = await gcpFetch(`${UPLOAD}/jobs?uploadType=multipart`, {
    method: 'POST',
    headers: { 'content-type': `multipart/related; boundary=${boundary}` },
    body: multipartBody(metadata, ndjson, boundary),
  })
  const job = await waitForJob((await response.json()) as Job)
  return Number(job.statistics?.load?.outputRows ?? 0)
}
