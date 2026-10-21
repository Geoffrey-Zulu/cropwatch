import { z } from '../zod'

// Zambia's ten provinces, the top-level aggregation key.
export const PROVINCES = [
  'Central',
  'Copperbelt',
  'Eastern',
  'Luapula',
  'Lusaka',
  'Muchinga',
  'Northern',
  'North-Western',
  'Southern',
  'Western',
] as const

export const ProvinceSchema = z.enum(PROVINCES).openapi('Province')
export type Province = z.infer<typeof ProvinceSchema>
