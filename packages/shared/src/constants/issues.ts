import { z } from 'zod'

// Controlled vocabulary for crop-health issues (technicaldoc.md §6). Never free-string an
// issue name anywhere: reference these slugs. Extend by appending only.
export const KNOWN_ISSUES = [
  'fall_armyworm',
  'tuta_absoluta',
  'late_blight',
  'early_blight',
  'diamondback_moth',
  'cassava_mosaic',
  'cassava_brown_streak',
  'maize_lethal_necrosis',
] as const

// 'unknown' is a valid diagnosis outcome and always routes to expert review (CLAUDE.md
// invariant 4). It is never a valid regulatory target, so registered products use
// KnownIssueSchema.
export const UNKNOWN_ISSUE = 'unknown' as const

export const ISSUES = [...KNOWN_ISSUES, UNKNOWN_ISSUE] as const

export const KnownIssueSchema = z.enum(KNOWN_ISSUES)
export type KnownIssue = z.infer<typeof KnownIssueSchema>

export const IssueSchema = z.enum(ISSUES)
export type Issue = z.infer<typeof IssueSchema>

export const ISSUE_LABELS: Record<Issue, string> = {
  fall_armyworm: 'Fall armyworm',
  tuta_absoluta: 'Tuta absoluta (tomato leafminer)',
  late_blight: 'Late blight',
  early_blight: 'Early blight',
  diamondback_moth: 'Diamondback moth',
  cassava_mosaic: 'Cassava mosaic disease',
  cassava_brown_streak: 'Cassava brown streak disease',
  maize_lethal_necrosis: 'Maize lethal necrosis',
  unknown: 'Unknown — needs expert review',
}
