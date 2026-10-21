import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { parseCsv } from './csv'
import { COLUMNS, parseProductsCsv } from './products'

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
