import { z } from 'zod'

export const FieldGeometrySchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z
    .array(
      z
        .array(z.tuple([z.number().finite(), z.number().finite()]))
        .min(4)
        .max(301)
    )
    .length(1),
})
export const FieldInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  crop: z.enum(['soybean', 'maize', 'tomato']),
  season: z.string().regex(/^20\d{2}\/\d{2}$/),
  planting_date: z
    .string()
    .regex(/^20\d{2}-\d{2}-\d{2}$/)
    .nullable(),
  capture_method: z.enum(['gps', 'imported']),
  geometry: FieldGeometrySchema,
})
export type FieldInput = z.infer<typeof FieldInputSchema>
export const FieldRecordSchema = FieldInputSchema.extend({
  id: z.string(),
  area_ha: z.number(),
  boundary_status: z.literal('claimed'),
  created_at: z.string(),
})
export type FieldRecord = z.infer<typeof FieldRecordSchema>
export const SatelliteSceneSchema = z.object({
  id: z.string(),
  acquired_at: z.string(),
  scene_cloud_pct: z.number().nullable(),
  preview_url: z.string().nullable(),
})
export const VegetationReadingSchema = z.object({
  from: z.string(),
  to: z.string(),
  ndvi: z.number(),
  valid_pixel_pct: z.number(),
  valid_pixels: z.number(),
})
export const FieldEvidenceSchema = z.object({
  field_id: z.string().nullable(),
  scope: z.enum(['field', 'regional']),
  retrieved_at: z.string(),
  catalogue_source: z.literal('Sentinel-2 L2A / Earth Search'),
  scenes: z.array(SatelliteSceneSchema),
  catalogue_status: z.enum(['ok', 'unavailable']),
  vegetation_source: z.literal('Copernicus Sentinel Hub Statistical API'),
  vegetation_status: z.enum([
    'ok',
    'not_configured',
    'authorization_failed',
    'unavailable',
    'no_usable_pixels',
  ]),
  readings: z.array(VegetationReadingSchema),
  review_status: z.literal('officer_review_required'),
})
export type FieldEvidence = z.infer<typeof FieldEvidenceSchema>
export type VegetationReading = z.infer<typeof VegetationReadingSchema>
