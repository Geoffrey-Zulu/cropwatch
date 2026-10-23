import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { OFFICER_REFERRAL } from '@repo/shared'
import { CANNED, cannedRecommendation, SOURCES } from './recommendations'

const manifest = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'corpus', 'manifest.json'),
    'utf8'
  )
) as { id: string; tier: number; source_url: string; needs_ocr: boolean }[]

describe('canned recommendations', () => {
  it('cite real corpus documents, with their tier and URL', () => {
    for (const [id, source] of Object.entries(SOURCES)) {
      const entry = manifest.find(e => e.id === id)
      expect(entry, id).toBeDefined()
      expect({ tier: source.tier, uri: source.uri }).toEqual({
        tier: entry!.tier,
        uri: entry!.source_url,
      })
      expect(entry!.needs_ocr).toBe(false)
    }
  })

  it('follow the live rules: no doses or pesticide names in any step', () => {
    for (const steps of Object.values(CANNED)) {
      for (const { text } of steps!) {
        expect(text).not.toMatch(/\d+(?:[.,]\d+)?\s*(?:ml|l|g|kg|mg|%)\b|\bPHI\b|\bREI\b/i)
        expect(text).not.toMatch(
          /emamectin|chlorantraniliprole|spinosad|cyhalothrin|mancozeb|copper|metalaxyl|fungicide|insecticide|pesticide|\bBt\b|thuringiensis/i
        )
      }
    }
  })

  it('end with the officer referral and carry no chemical options', () => {
    const rec = cannedRecommendation('sim-faw-0001', 'fall_armyworm', '2026-10-20T08:00:00.000Z')!
    expect(rec.ipm_steps[rec.ipm_steps.length - 1]).toBe(OFFICER_REFERRAL)
    expect(rec.chemical_options).toEqual([])
    expect(rec.sim).toBe(true)
    expect(rec.rag_sources.map(s => s.tier)).toEqual([1, 1, 4])
  })

  it('has no template where the corpus has nothing to cite', () => {
    expect(
      cannedRecommendation('sim-x', 'maize_lethal_necrosis', '2026-10-20T08:00:00.000Z')
    ).toBeNull()
  })
})
