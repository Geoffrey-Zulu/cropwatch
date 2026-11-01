import { CapacitorHttp } from '@capacitor/core'
import { FieldEvidenceSchema, FieldRecordSchema, type FieldInput } from '@repo/shared'
import { auth } from './firebase'
import { isNativeApp } from './native'

const FIELD_API = import.meta.env.VITE_FIELD_API_URL ?? 'https://phytos-api.samuelkaoma.dev'
async function request(path: string, method = 'GET', data?: unknown) {
  const user = auth.currentUser
  if (!user) throw new Error('Sign in before opening field evidence.')
  const headers = {
    authorization: `Bearer ${await user.getIdToken()}`,
    'content-type': 'application/json',
  }
  if (isNativeApp()) {
    const response = await CapacitorHttp.request({
      url: FIELD_API + path,
      method,
      headers,
      ...(data ? { data } : {}),
      connectTimeout: 15000,
      readTimeout: 90000,
    })
    if (response.status < 200 || response.status >= 300)
      throw new Error(response.data?.message ?? 'Field evidence request failed.')
    return response.data
  }
  const response = await fetch(FIELD_API + path, {
    method,
    headers,
    ...(data ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(90000),
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.message ?? 'Field evidence request failed.')
  return body
}
export const fieldApi = {
  list: async () => {
    const data = await request('/v1/fields')
    return FieldRecordSchema.array().parse(data.fields)
  },
  create: async (input: FieldInput) =>
    FieldRecordSchema.parse(await request('/v1/fields', 'POST', input)),
  context: async () => FieldEvidenceSchema.parse(await request('/v1/satellite/context')),
  report: async (id: string) => {
    const data = await request(`/v1/fields/${id}/evidence`)
    return data.report ? FieldEvidenceSchema.parse(data.report) : null
  },
  refresh: async (id: string) =>
    FieldEvidenceSchema.parse(await request(`/v1/fields/${id}/evidence`, 'POST')),
}
