import { GoogleAuth } from 'google-auth-library'

// BigQuery over REST as the service account: streaming inserts for live snapshots, and
// parameterised queries for the cluster rule and risk counts. Streamed rows go only to tables
// nothing ever deletes from (observation_events, risk_scores), so re-seeding never hits the
// streaming buffer.

export type QueryParam = string | number | boolean | { timestamp: string }

export interface BigQuery {
  insert(table: string, rows: { insertId: string; json: object }[]): Promise<void>
  query<T = Record<string, unknown>>(sql: string, params?: Record<string, QueryParam>): Promise<T[]>
}

interface Field {
  name: string
  type: string
  mode?: string
  fields?: Field[]
}

type Cell = { v: unknown }

function decode(value: unknown, field: Field): unknown {
  if (value === null || value === undefined) return null
  if (field.mode === 'REPEATED') {
    return (value as Cell[]).map(item => decode(item.v, { ...field, mode: 'NULLABLE' }))
  }
  switch (field.type) {
    case 'INTEGER':
    case 'INT64':
    case 'FLOAT':
    case 'FLOAT64':
    case 'NUMERIC':
      return Number(value)
    case 'BOOLEAN':
    case 'BOOL':
      return value === 'true' || value === true
    case 'TIMESTAMP':
      // Seconds since the epoch, as a string.
      return new Date(Number(value) * 1000).toISOString()
    case 'RECORD':
    case 'STRUCT':
      return decodeRow((value as { f: Cell[] }).f, field.fields ?? [])
    default:
      return value
  }
}

const decodeRow = (cells: Cell[], fields: Field[]) =>
  Object.fromEntries(fields.map((field, i) => [field.name, decode(cells[i]?.v, field)]))

function parameter(name: string, value: QueryParam) {
  if (typeof value === 'object') {
    return {
      name,
      parameterType: { type: 'TIMESTAMP' },
      parameterValue: { value: value.timestamp },
    }
  }
  const type =
    typeof value === 'boolean'
      ? 'BOOL'
      : typeof value === 'number'
        ? Number.isInteger(value)
          ? 'INT64'
          : 'FLOAT64'
        : 'STRING'
  return { name, parameterType: { type }, parameterValue: { value: String(value) } }
}

export function bigQueryRest(
  { projectId, location, dataset }: { projectId: string; location: string; dataset: string },
  auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' })
): BigQuery {
  const api = `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}`

  return {
    async insert(table, rows) {
      if (rows.length === 0) return
      const client = await auth.getClient()
      const response = await client.request<{ insertErrors?: unknown[] }>({
        url: `${api}/datasets/${dataset}/tables/${table}/insertAll`,
        method: 'POST',
        data: { rows, skipInvalidRows: false, ignoreUnknownValues: false },
        timeout: 15_000,
      })
      if (response.data.insertErrors?.length) {
        throw new Error(
          `insertAll ${table}: ${JSON.stringify(response.data.insertErrors).slice(0, 500)}`
        )
      }
    },

    async query<T>(sql: string, params: Record<string, QueryParam> = {}) {
      const client = await auth.getClient()
      type Page = {
        jobComplete: boolean
        jobReference: { jobId: string; location: string }
        schema?: { fields: Field[] }
        rows?: { f: Cell[] }[]
        pageToken?: string
      }
      let page = (
        await client.request<Page>({
          url: `${api}/queries`,
          method: 'POST',
          data: {
            query: sql,
            useLegacySql: false,
            parameterMode: 'NAMED',
            queryParameters: Object.entries(params).map(([name, value]) => parameter(name, value)),
            location,
            timeoutMs: 20_000,
          },
          timeout: 30_000,
        })
      ).data
      const { jobId } = page.jobReference
      const rows: T[] = []
      for (;;) {
        if (page.jobComplete) {
          for (const row of page.rows ?? []) rows.push(decodeRow(row.f, page.schema!.fields) as T)
          if (!page.pageToken) return rows
        }
        const token = page.jobComplete && page.pageToken ? `&pageToken=${page.pageToken}` : ''
        page = (
          await client.request<Page>({
            url: `${api}/queries/${jobId}?location=${location}&timeoutMs=20000${token}`,
            timeout: 30_000,
          })
        ).data
      }
    },
  }
}
