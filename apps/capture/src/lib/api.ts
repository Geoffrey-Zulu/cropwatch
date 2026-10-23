import {
  ObservationCreatedSchema,
  ObservationViewSchema,
  type CreateObservationRequest,
  type ObservationView,
} from '@repo/shared'

// The frozen REST v1 contract (packages/shared/src/contracts/openapi.json), used exactly as the
// mobile app uses it. No new endpoints.
export const API_URL: string =
  import.meta.env.VITE_API_URL ?? 'https://cropwatch-api-24960589333.europe-west1.run.app/api/v1'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

async function call(path: string, idToken: string, init: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${idToken}`, 'content-type': 'application/json' },
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = (body as { message?: string } | null)?.message
    throw new ApiError(response.status, message ?? `HTTP ${response.status}`)
  }
  return body
}

export async function createObservation(idToken: string, request: CreateObservationRequest) {
  return ObservationCreatedSchema.parse(
    await call('/observations', idToken, { method: 'POST', body: JSON.stringify(request) })
  )
}

export async function getObservation(idToken: string, obsId: string): Promise<ObservationView> {
  return ObservationViewSchema.parse(await call(`/observations/${obsId}`, idToken))
}
