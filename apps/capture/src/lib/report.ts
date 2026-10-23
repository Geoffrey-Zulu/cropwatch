import {
  CreateObservationRequestSchema,
  findDistrict,
  type CreateObservationRequest,
  type Crop,
} from '@repo/shared'

// A report id the app generates (ObservationIdSchema: 16–64 url-safe characters).
export function newObsId() {
  const bytes = crypto.getRandomValues(new Uint8Array(15))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// Storage rules bind photos to their uploader: observations/{uid}/{obsId}/{n}.jpg.
export const photoPath = (uid: string, obsId: string, n = 0) =>
  `observations/${uid}/${obsId}/${n}.jpg`

// The short reference a farmer can read out to an officer.
export const reportNumber = (obsId: string) => obsId.slice(0, 4).toUpperCase()

export interface ReportForm {
  obsId: string
  uid: string
  crop: Crop
  district: string
  location: { latitude: number; longitude: number }
  plantingDate: string | null
  description: string
}

// The POST /observations body, validated against the frozen contract before it leaves.
export function buildReport(form: ReportForm): CreateObservationRequest {
  const district = findDistrict(form.district)
  if (!district) throw new Error(`Unknown district ${form.district}`)
  return CreateObservationRequestSchema.parse({
    obs_id: form.obsId,
    crop: form.crop,
    location: form.location,
    district: district.name,
    province: district.province,
    planting_date: form.plantingDate || null,
    photo_paths: [photoPath(form.uid, form.obsId)],
    farmer_description: form.description.trim() || null,
  })
}
