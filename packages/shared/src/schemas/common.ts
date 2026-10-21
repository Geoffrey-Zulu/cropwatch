import { z } from '../zod'
import { DISTRICT_SLUG_PATTERN } from '../constants/districts'

// Timestamps cross the wire as ISO-8601 strings; apps/functions converts to and from
// Firestore Timestamp at the data-access layer.
export const TimestampSchema = z.string().datetime({ offset: true })

// Calendar dates (planting_date, product expiry) as YYYY-MM-DD.
export const DateSchema = z.string().date()

export const GeoPointSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .openapi('GeoPoint')
export type GeoPoint = z.infer<typeof GeoPointSchema>

export const DistrictSlugSchema = z.string().regex(DISTRICT_SLUG_PATTERN).openapi('DistrictSlug', {
  description:
    'Normalised district: the aggregation key for clusters, alerts and FCM topics. Lowercase, a trailing " district" dropped, runs of other characters replaced by "-" ("Kapiri Mposhi" → "kapiri-mposhi").',
  example: 'kapiri-mposhi',
})
