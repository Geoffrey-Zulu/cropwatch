import { z } from '../zod'
import { describeLabels } from './describeLabels'

// Controlled vocabulary for crops (technicaldoc.md §4.1). Extend by appending only:
// the Gemini response schema, the regulatory DB and the dashboard all key off these slugs.
export const CROPS = ['maize', 'tomato', 'cabbage', 'cassava', 'soybean'] as const

export const CROP_LABELS: Record<(typeof CROPS)[number], string> = {
  maize: 'Maize',
  tomato: 'Tomato',
  cabbage: 'Cabbage',
  cassava: 'Cassava',
  soybean: 'Soybean',
}

export const CropSchema = z.enum(CROPS).openapi('Crop', {
  description: `Controlled vocabulary, append-only. Labels: ${describeLabels(CROP_LABELS)}.`,
})
export type Crop = z.infer<typeof CropSchema>
