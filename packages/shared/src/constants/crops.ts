import { z } from 'zod'

// Controlled vocabulary for crops (technicaldoc.md §4.1). Extend by appending only:
// the Gemini response schema, the regulatory DB and the dashboard all key off these slugs.
export const CROPS = ['maize', 'tomato', 'cabbage', 'cassava', 'soybean'] as const

export const CropSchema = z.enum(CROPS)
export type Crop = z.infer<typeof CropSchema>

export const CROP_LABELS: Record<Crop, string> = {
  maize: 'Maize',
  tomato: 'Tomato',
  cabbage: 'Cabbage',
  cassava: 'Cassava',
  soybean: 'Soybean',
}
