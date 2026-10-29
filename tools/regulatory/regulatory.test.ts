import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { parseCsv } from './csv'
import { COLUMNS, markVerified, parseProductsCsv } from './products'

describe('parseCsv', () => {
  it('splits plain rows', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('keeps commas, doubled quotes and newlines inside quoted fields', () => {
    expect(parseCsv('"10 ml, then ""rinse""","line one\nline two"\r\n')).toEqual([
      ['10 ml, then "rinse"', 'line one\nline two'],
    ])
  })

  it('never trims', () => {
    expect(parseCsv('  padded  ," quoted padding "\n')).toEqual([
      ['  padded  ', ' quoted padding '],
    ])
  })

  it('drops an Excel BOM and accepts CRLF and a missing final newline', () => {
    expect(parseCsv('﻿a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('keeps empty fields', () => {
    expect(parseCsv('a,,c\n')).toEqual([['a', '', 'c']])
  })

  it('refuses an unterminated quote', () => {
    expect(() => parseCsv('"never closed\n')).toThrow('Unterminated')
  })
})

const header = COLUMNS.join(',')
const valid =
  'ZM/PCS/0012,Alpha 5 EC,emamectin benzoate,Registrant A,maize; tomato,fall_armyworm,"  10 ml / 15 L, into the whorl  ",14,II,label,gs://labels/alpha.pdf,'

describe('parseProductsCsv', () => {
  it('parses a valid row, with list columns and verbatim label_dose', () => {
    const { products, errors } = parseProductsCsv(`${header}\n${valid}\n`)
    expect(errors).toEqual([])
    expect(products[0]).toMatchObject({
      registration_no: 'ZM/PCS/0012',
      approved_crops: ['maize', 'tomato'],
      approved_issues: ['fall_armyworm'],
      label_dose: '  10 ml / 15 L, into the whorl  ',
      phi_days: 14,
      expiry: null,
    })
  })

  it('rejects the wrong header', () => {
    expect(parseProductsCsv('registration_no,name\n').errors[0]).toContain('Header')
  })

  it('reports each problem with its spreadsheet row', () => {
    const bad = [
      header,
      valid,
      valid.replace('ZM/PCS/0012', 'ZM-2').replace('maize; tomato', 'wheat'),
      valid.replace('ZM/PCS/0012', 'ZM-3').replace(',14,', ',fourteen,'),
      valid.replace('ZM/PCS/0012', 'ZM-4').replace('fall_armyworm', 'unknown'),
      valid.replace(',label,', ',rumour,').replace('ZM/PCS/0012', 'ZM-5'),
      valid,
      'too,few,columns',
    ].join('\n')
    const { errors } = parseProductsCsv(bad)
    expect(errors.some(e => e.startsWith('Row 3 approved_crops'))).toBe(true)
    expect(errors.some(e => e.startsWith('Row 4 phi_days'))).toBe(true)
    // A product can never be registered against "unknown".
    expect(errors.some(e => e.startsWith('Row 5 approved_issues'))).toBe(true)
    expect(errors.some(e => e.startsWith('Row 6 source'))).toBe(true)
    expect(errors).toContain('Row 7: registration_no ZM/PCS/0012 repeats row 2')
    expect(errors).toContain('Row 8: expected 12 columns, found 3')
  })
})

describe('placeholder-products.csv', () => {
  const { products, errors } = parseProductsCsv(
    readFileSync(new URL('./placeholder-products.csv', import.meta.url), 'utf8')
  )

  it('is valid', () => {
    expect(errors).toEqual([])
    expect(products.length).toBeGreaterThanOrEqual(6)
  })

  it('is unmistakably placeholder data', () => {
    for (const p of products) {
      expect(p.source).toBe('placeholder')
      expect(p.trade_name).toContain('PLACEHOLDER')
      expect(p.label_dose).toContain('PLACEHOLDER')
    }
  })

  it('covers the demo crops and issues, plus an expired row and a slash in a number', () => {
    const pairs = new Set(
      products.flatMap(p => p.approved_crops.flatMap(c => p.approved_issues.map(i => `${c}/${i}`)))
    )
    for (const pair of [
      'maize/fall_armyworm',
      'tomato/tuta_absoluta',
      'tomato/late_blight',
      'tomato/early_blight',
      'cabbage/diamondback_moth',
    ]) {
      expect(pairs, pair).toContain(pair)
    }
    expect(products.some(p => p.expiry !== null && p.expiry < '2026-01-01')).toBe(true)
    expect(products.some(p => p.registration_no.includes('/'))).toBe(true)
  })
})

describe('verified_by column', () => {
  const withColumn = `${header},verified_by
${valid},
${valid.replace('ZM/PCS/0012', 'ZM-9')},geoffrey
`

  it('is optional, and empty means not yet checked', () => {
    expect(
      parseProductsCsv(`${header}
${valid}
`).products[0].verified_by
    ).toBeNull()
    const { products, errors } = parseProductsCsv(withColumn)
    expect(errors).toEqual([])
    expect(products.map(p => p.verified_by)).toEqual([null, 'geoffrey'])
  })

  it('markVerified changes only the verified_by cell of the named rows, idempotently', () => {
    const once = markVerified(withColumn, ['ZM/PCS/0012'], 'geoffrey')
    expect(once.changed).toBe(1)
    expect(once.missing).toEqual([])
    expect(once.text).toBe(
      withColumn.replace(
        'into the whorl  ",14,II,label,gs://labels/alpha.pdf,,',
        'into the whorl  ",14,II,label,gs://labels/alpha.pdf,,geoffrey'
      )
    )
    const twice = markVerified(once.text, ['ZM/PCS/0012', 'ZM-9'], 'geoffrey')
    expect(twice.changed).toBe(0)
    expect(twice.text).toBe(once.text)
    expect(parseProductsCsv(twice.text).products[0].label_dose).toBe(
      '  10 ml / 15 L, into the whorl  '
    )
  })

  it('markVerified reports unknown ids and refuses a file without the column', () => {
    expect(markVerified(withColumn, ['NOPE'], 'geoffrey').missing).toEqual(['NOPE'])
    expect(() =>
      markVerified(
        `${header}
${valid}
`,
        ['ZM/PCS/0012'],
        'geoffrey'
      )
    ).toThrow('verified_by')
    expect(() => markVerified(withColumn, ['ZM-9'], 'two words')).toThrow('plain name')
  })
})

describe('pmdg-products.csv (the live register)', () => {
  const text = readFileSync(new URL('./pmdg-products.csv', import.meta.url), 'utf8')
  const { products, errors } = parseProductsCsv(text)
  const byId = new Map(products.map(p => [p.registration_no, p]))

  it('is valid, all Plantwise PMDG, never a placeholder, with ids that cannot pass for a registration number', () => {
    expect(errors).toEqual([])
    expect(products.length).toBeGreaterThanOrEqual(17)
    for (const p of products) {
      expect(p.source).toBe('plantwise_pmdg')
      expect(p.registration_no).toMatch(/^PMDG-[A-Z0-9-]+$/)
      expect(p.source_doc).toMatch(/^pw-pmdg-/)
      expect(p.expiry).toBeNull()
      expect(`${p.trade_name} ${p.label_dose}`).not.toMatch(/placeholder/i)
    }
  })

  it('covers the four PMDG demo issues and leaves cassava mosaic IPM-only (the PMDG advises against it for smallholders)', () => {
    const pairs = new Set(
      products.flatMap(p => p.approved_crops.flatMap(c => p.approved_issues.map(i => `${c}/${i}`)))
    )
    for (const pair of [
      'tomato/tuta_absoluta',
      'tomato/late_blight',
      'tomato/early_blight',
      'cabbage/diamondback_moth',
    ]) {
      expect(pairs, pair).toContain(pair)
    }
    expect(products.some(p => p.approved_issues.includes('cassava_mosaic'))).toBe(false)
    expect(products.some(p => p.approved_issues.includes('fall_armyworm'))).toBe(false)
  })

  it('keeps the guide text verbatim', () => {
    expect(byId.get('PMDG-TUTA-BELT-480SC')?.label_dose).toBe('4mls per 20L')
    expect(byId.get('PMDG-DBM-SENTINEL-15EC')?.label_dose).toBe(
      'Often applied at 20-30ml per 20 litres, but double-check with product labels.'
    )
    expect(byId.get('PMDG-TUTA-SPINOSAD')?.label_dose).toBe(
      'The guide gives no rate for this product. Use the rate on the product label.'
    )
  })
})
