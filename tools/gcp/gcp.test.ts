import { describe, it, expect } from 'vitest'
import { multipartBody } from './bigquery'
import {
  decodeFields,
  documentName,
  encodeFields,
  FsGeoPoint,
  FsTimestamp,
  toRestWrite,
} from './firestore'

describe('Firestore REST encoding', () => {
  const document = {
    name: 'PLACEHOLDER — not a real label;\n  keep  spacing ',
    count: 14,
    ratio: 0.86,
    flag: true,
    nothing: null,
    created_at: new FsTimestamp('2026-10-21T09:30:00.000Z'),
    location: new FsGeoPoint(-13.63, 32.65),
    tags: ['maize', 'fall_armyworm'],
    empty: [],
    nested: { band: 'high', at: new FsTimestamp('2026-10-21T09:30:08.000Z') },
  }

  it('uses Firestore types for timestamps, geopoints, integers and doubles', () => {
    const fields = encodeFields(document)
    expect(fields.created_at).toEqual({ timestampValue: '2026-10-21T09:30:00.000Z' })
    expect(fields.location).toEqual({ geoPointValue: { latitude: -13.63, longitude: 32.65 } })
    expect(fields.count).toEqual({ integerValue: '14' })
    expect(fields.ratio).toEqual({ doubleValue: 0.86 })
    expect(fields.empty).toEqual({ arrayValue: { values: [] } })
  })

  it('round-trips, keeping strings byte-identical', () => {
    const decoded = decodeFields(encodeFields(document) as never)
    expect(decoded).toEqual({
      ...document,
      created_at: '2026-10-21T09:30:00.000Z',
      location: { latitude: -13.63, longitude: 32.65 },
      nested: { band: 'high', at: '2026-10-21T09:30:08.000Z' },
    })
  })

  it('refuses undefined fields rather than silently dropping them', () => {
    expect(() => encodeFields({ a: undefined as never })).toThrow('undefined')
  })

  it('builds set and delete writes with full document names', () => {
    expect(toRestWrite({ delete: 'observations/sim-0001' })).toEqual({
      delete: documentName('observations/sim-0001'),
    })
    expect(documentName('a/b')).toBe('projects/crop-watch01/databases/(default)/documents/a/b')
  })
})

describe('multipartBody', () => {
  it('frames metadata then rows', () => {
    const body = multipartBody({ a: 1 }, '{"x":1}\n{"x":2}', 'B')
    expect(body).toBe(
      '--B\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{"a":1}\r\n--B\r\nContent-Type: application/octet-stream\r\n\r\n{"x":1}\n{"x":2}\r\n--B--\r\n'
    )
  })
})
