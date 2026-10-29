import { describe, it, expect } from 'vitest'
import { RegisteredProductSchema, type RegisteredProduct } from '@repo/shared'
import { filterChemicalCandidates, type FilterInput } from './regulatoryFilter'

const row = (overrides: Partial<RegisteredProduct>): RegisteredProduct =>
  RegisteredProductSchema.parse({
    registration_no: 'ZM-001',
    trade_name: 'Alpha 5 EC',
    active_ingredient: 'emamectin benzoate',
    registrant: 'Registrant A',
    approved_crops: ['maize'],
    approved_issues: ['fall_armyworm'],
    label_dose: '10 ml / 15 L knapsack',
    phi_days: 14,
    who_class: 'II',
    source: 'label',
    source_doc: 'gs://labels/alpha.pdf',
    expiry: null,
    ...overrides,
  })

const PRODUCTS = [
  row({}),
  // Same active ingredient, another brand.
  row({ registration_no: 'ZM-002', trade_name: 'Beta 19 SC', label_dose: '8 ml / 15 L' }),
  row({
    registration_no: 'ZM-003',
    trade_name: 'Gamma WG',
    active_ingredient: 'chlorantraniliprole',
    approved_crops: ['tomato'],
    approved_issues: ['tuta_absoluta'],
  }),
  row({
    registration_no: 'ZM-004',
    trade_name: 'Old Stock 2 EC',
    active_ingredient: 'lambda-cyhalothrin',
    expiry: '2026-10-20',
  }),
  row({
    registration_no: 'ZM-005',
    trade_name: 'Fresh Stock 2 EC',
    active_ingredient: 'spinetoram',
    expiry: '2026-10-21',
  }),
  row({
    registration_no: 'PLACEHOLDER-001',
    trade_name: 'PLACEHOLDER Product',
    active_ingredient: 'placeholder ingredient',
    source: 'placeholder',
    label_dose: 'PLACEHOLDER — not a real label dose.',
  }),
]

const base: Omit<FilterInput, 'candidates'> = {
  products: PRODUCTS,
  crop: 'maize',
  issue: 'fall_armyworm',
  today: '2026-10-21',
}
const run = (candidates: FilterInput['candidates'], overrides: Partial<FilterInput> = {}) =>
  filterChemicalCandidates({ ...base, ...overrides, candidates })

describe('filterChemicalCandidates', () => {
  it('accepts a registered product by exact registration number', () => {
    const { options, rejected } = run([{ registration_no: 'ZM-001', source_ids: [] }])
    expect(options.map(o => o.registration_no)).toEqual(['ZM-001'])
    expect(rejected).toEqual([])
  })

  it('does not fuzzy-match registration numbers', () => {
    const { options, rejected } = run([{ registration_no: 'zm-001', source_ids: [] }])
    expect(options).toEqual([])
    expect(rejected).toEqual([{ candidate: 'zm-001', reason: 'not_registered' }])
  })

  it('matches trade names ignoring case and spacing', () => {
    const { options } = run([{ trade_name: '  alpha   5 ec ', source_ids: [] }])
    expect(options.map(o => o.registration_no)).toEqual(['ZM-001'])
  })

  it('treats hyphens and spaces alike in names (labels write "lambda-cyhalothrin", guides "Lambda Cyhalothrin")', () => {
    const { options } = run([{ active_ingredient: 'emamectin-benzoate', source_ids: [] }])
    expect(options.map(o => o.trade_name)).toEqual(['Alpha 5 EC', 'Beta 19 SC'])
  })

  it('lists every registered brand of an active ingredient', () => {
    const { options } = run([{ active_ingredient: 'Emamectin Benzoate', source_ids: [] }])
    expect(options.map(o => o.trade_name)).toEqual(['Alpha 5 EC', 'Beta 19 SC'])
  })

  it('rejects a chemical that is not in the register', () => {
    const { options, rejected } = run([{ active_ingredient: 'DDT', source_ids: [] }])
    expect(options).toEqual([])
    expect(rejected).toEqual([{ candidate: 'DDT', reason: 'not_registered' }])
  })

  it('rejects a product registered for another crop', () => {
    const { options, rejected } = run([{ registration_no: 'ZM-003', source_ids: [] }])
    expect(options).toEqual([])
    expect(rejected).toEqual([{ candidate: 'ZM-003', reason: 'wrong_crop' }])
  })

  it('rejects a product registered for the crop but another issue', () => {
    const { rejected } = run([{ registration_no: 'ZM-001', source_ids: [] }], {
      crop: 'maize',
      issue: 'maize_lethal_necrosis',
    })
    expect(rejected).toEqual([{ candidate: 'ZM-001', reason: 'wrong_issue' }])
  })

  it('never recommends a product for an unknown issue', () => {
    const { options } = run([{ active_ingredient: 'emamectin benzoate', source_ids: [] }], {
      issue: 'unknown',
    })
    expect(options).toEqual([])
  })

  it('rejects a product past its expiry date', () => {
    const { options, rejected } = run([{ registration_no: 'ZM-004', source_ids: [] }])
    expect(options).toEqual([])
    expect(rejected).toEqual([{ candidate: 'ZM-004', reason: 'expired' }])
  })

  it('accepts a product on its expiry date, and one with no expiry', () => {
    const { options } = run([
      { registration_no: 'ZM-005', source_ids: [] },
      { registration_no: 'ZM-001', source_ids: [] },
    ])
    expect(options.map(o => o.registration_no).sort()).toEqual(['ZM-001', 'ZM-005'])
  })

  it('excludes placeholder rows unless explicitly allowed', () => {
    const candidate = [{ registration_no: 'PLACEHOLDER-001', source_ids: [] }]
    expect(run(candidate).rejected).toEqual([
      { candidate: 'PLACEHOLDER-001', reason: 'placeholder' },
    ])
    expect(run(candidate, { allowPlaceholders: true }).options).toHaveLength(1)
  })

  it('renders label_dose byte-identical, whitespace and all', () => {
    const dose = '  20 ml / 15 L knapsack — spray into whorl;\nrepeat after 7 days  '
    const products = [row({ registration_no: 'ZM-900', label_dose: dose })]
    const [option] = run([{ registration_no: 'ZM-900', source_ids: [] }], { products }).options
    expect(option.label_dose).toBe(dose)
  })

  it('shows only the register row fields, nothing a model could add', () => {
    const [option] = run([{ registration_no: 'ZM-001', source_ids: [] }]).options
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

  it('passes a Plantwise PMDG row like any other, with its source and the guide text byte-identical', () => {
    const dose = 'Often applied at 20-30ml per 20 litres, but double-check with product labels.'
    const products = [
      row({
        registration_no: 'PMDG-DBM-SENTINEL-15EC',
        trade_name: 'SENTINEL 15%EC',
        active_ingredient: 'cypermethrin',
        registrant: 'Not stated in the guide',
        approved_crops: ['cabbage'],
        approved_issues: ['diamondback_moth'],
        label_dose: dose,
        phi_days: 7,
        source: 'plantwise_pmdg',
        source_doc: 'pw-pmdg-diamondback-moth-zambia-2014 p1',
        verified_by: null,
      }),
    ]
    const input = { products, crop: 'cabbage', issue: 'diamondback_moth' } as const
    const { options, rejected } = run(
      [{ active_ingredient: 'Cypermethrin', source_ids: [] }],
      input
    )
    expect(rejected).toEqual([])
    expect(options).toHaveLength(1)
    expect(options[0].label_dose).toBe(dose)
    expect(options[0].source).toBe('plantwise_pmdg')
    // verified_by records the spot-check only; it never reaches the farmer-facing option.
    expect(options[0]).not.toHaveProperty('verified_by')
  })

  it('lists a product once even if several candidates point at it', () => {
    const { options } = run([
      { registration_no: 'ZM-001', source_ids: [] },
      { trade_name: 'Alpha 5 EC', source_ids: [] },
      { active_ingredient: 'emamectin benzoate', source_ids: [] },
    ])
    expect(options.map(o => o.registration_no)).toEqual(['ZM-001', 'ZM-002'])
  })

  it('rejects a candidate with nothing to match on', () => {
    expect(run([{ source_ids: [] }]).rejected).toEqual([
      { candidate: '(unnamed)', reason: 'not_registered' },
    ])
  })

  // buildplan §4.3: every chemical in the output exists in registered_products with matching
  // crop and issue, unexpired, with the dose byte-identical to the row.
  it('holds the §4.3 guarantees for any mix of candidates', () => {
    const names = [
      ...PRODUCTS.flatMap(p => [
        { registration_no: p.registration_no },
        { trade_name: p.trade_name.toUpperCase() },
        { active_ingredient: ` ${p.active_ingredient} ` },
      ]),
      { active_ingredient: 'DDT' },
      { trade_name: 'Unknown Brand' },
    ]
    const contexts = [
      { crop: 'maize', issue: 'fall_armyworm' },
      { crop: 'tomato', issue: 'tuta_absoluta' },
      { crop: 'maize', issue: 'unknown' },
    ] as const
    let seed = 7
    const next = () => (seed = (seed * 48271) % 2147483647) / 2147483647
    for (let trial = 0; trial < 300; trial++) {
      const candidates = names.filter(() => next() < 0.3).map(n => ({ ...n, source_ids: [] }))
      const context = contexts[trial % contexts.length]
      const allowPlaceholders = next() < 0.5
      const { options } = run(candidates, { ...context, allowPlaceholders })
      for (const option of options) {
        const product = PRODUCTS.find(p => p.registration_no === option.registration_no)!
        expect(product.approved_crops).toContain(context.crop)
        expect(product.approved_issues as readonly string[]).toContain(context.issue)
        expect(product.expiry === null || product.expiry >= base.today).toBe(true)
        expect(option.label_dose).toBe(product.label_dose)
        if (!allowPlaceholders) expect(product.source).not.toBe('placeholder')
      }
    }
  })
})
