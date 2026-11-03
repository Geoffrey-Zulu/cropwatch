import { describe, it, expect } from 'vitest'
import { ChemicalOptionSchema, RecommendationSchema } from './recommendation'
import {
  PRODUCT_SOURCE_LABELS,
  RegisteredProductSchema,
  registeredProductDocId,
} from './registeredProduct'

const product = {
  registration_no: 'TEST-0001',
  trade_name: 'Example 5 EC',
  active_ingredient: 'example-ingredient 50 g/L',
  registrant: 'Example Ltd',
  approved_crops: ['maize'],
  approved_issues: ['fall_armyworm'],
  label_dose: '  20 ml / 15 L knapsack — spray into whorl ',
  phi_days: 14,
  who_class: 'II',
  source: 'label',
  source_doc: 'gs://example/labels/example-5ec.pdf',
  expiry: null,
}

const recommendation = {
  obs_id: 'obs-1',
  created_at: '2026-10-21T09:31:00Z',
  ipm_steps: ['Scout 10 plants per station', 'Hand-pick egg masses'],
  chemical_options: [],
  rag_sources: [
    { title: 'FAW manual', tier: 1, uri: 'gs://corpus/moa/faw.pdf', chunk_ids: ['c1'] },
  ],
  regulatory_check: { passed: true, rejected_products: [] },
  sim: false,
}

describe('RegisteredProductSchema', () => {
  it('accepts a valid product row', () => {
    expect(RegisteredProductSchema.safeParse(product).success).toBe(true)
  })

  it('never approves a product for the unknown issue', () => {
    const result = RegisteredProductSchema.safeParse({ ...product, approved_issues: ['unknown'] })
    expect(result.success).toBe(false)
  })

  it('rejects a WHO class outside the standard set', () => {
    expect(RegisteredProductSchema.safeParse({ ...product, who_class: 'IV' }).success).toBe(false)
  })
})

describe('RecommendationSchema', () => {
  it('accepts an IPM-only recommendation', () => {
    expect(RecommendationSchema.safeParse(recommendation).success).toBe(true)
  })

  it('requires at least one citation', () => {
    const result = RecommendationSchema.safeParse({ ...recommendation, rag_sources: [] })
    expect(result.success).toBe(false)
  })

  it('preserves label_dose byte-identical and drops fields not in the regulatory row', () => {
    const result = RecommendationSchema.parse({
      ...recommendation,
      chemical_options: [{ ...product, dose: 'model-written dose' }],
    })
    const [option] = result.chemical_options
    expect(option.label_dose).toBe(product.label_dose)
    expect(option).not.toHaveProperty('dose')
    expect(Object.keys(option).sort()).toEqual([
      'active_ingredient',
      'label_dose',
      'phi_days',
      'registration_no',
      'source',
      'source_doc',
      'trade_name',
    ])
  })

  it('rejects an authority tier outside 1–6', () => {
    const result = RecommendationSchema.safeParse({
      ...recommendation,
      rag_sources: [{ ...recommendation.rag_sources[0], tier: 7 }],
    })
    expect(result.success).toBe(false)
  })
})

describe('registeredProductDocId', () => {
  it('encodes registration numbers that contain slashes, reversibly', () => {
    const id = registeredProductDocId('ZEMA/PCS/2024/0012')
    expect(id).not.toContain('/')
    expect(decodeURIComponent(id)).toBe('ZEMA/PCS/2024/0012')
    expect(registeredProductDocId('A/B')).not.toBe(registeredProductDocId('A_B'))
  })
})

describe('product source', () => {
  it('is required and from the known list', () => {
    const withoutSource = Object.fromEntries(
      Object.entries(product).filter(([k]) => k !== 'source')
    )
    expect(RegisteredProductSchema.safeParse(withoutSource).success).toBe(false)
    expect(RegisteredProductSchema.safeParse({ ...product, source: 'rumour' }).success).toBe(false)
    expect(RegisteredProductSchema.safeParse({ ...product, source: 'placeholder' }).success).toBe(
      true
    )
  })

  it('accepts Plantwise PMDG rows, names the source and carries it into the chemical option', () => {
    const pmdg = { ...product, source: 'plantwise_pmdg', registration_no: 'PMDG-TUTA-SPINOSAD' }
    expect(RegisteredProductSchema.parse(pmdg).source).toBe('plantwise_pmdg')
    expect(PRODUCT_SOURCE_LABELS.plantwise_pmdg).toBe('Plantwise Zambia PMDG')
    expect(ChemicalOptionSchema.parse(pmdg).source).toBe('plantwise_pmdg')
    // Options stored before the source field existed still parse.
    const legacy: Record<string, unknown> = { ...ChemicalOptionSchema.parse(pmdg) }
    delete legacy.source
    expect(ChemicalOptionSchema.safeParse(legacy).success).toBe(true)
  })

  it('records who spot-checked a row, optionally', () => {
    expect(RegisteredProductSchema.parse(product).verified_by).toBeUndefined()
    expect(RegisteredProductSchema.parse({ ...product, verified_by: null }).verified_by).toBeNull()
    expect(RegisteredProductSchema.parse({ ...product, verified_by: 'geoffrey' }).verified_by).toBe(
      'geoffrey'
    )
    expect(RegisteredProductSchema.safeParse({ ...product, verified_by: '' }).success).toBe(false)
  })
})
