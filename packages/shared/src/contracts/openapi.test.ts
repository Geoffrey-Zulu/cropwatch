import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import type { ZodTypeAny } from 'zod'
import { ObservationBaseSchema } from '../schemas/observation'
import { buildOpenApiDocument } from './openapi'

const document = buildOpenApiDocument()
const schemas = document.components!.schemas! as Record<string, Record<string, unknown>>

// Field names that would put a confidence number or percentage in front of a user
// (CLAUDE.md invariants 2 and 3, buildplan §4.2).
const FORBIDDEN_FIELD = /^model_confidence$|probab|percent|_pct$/i

function propertyNames(node: unknown, names: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach(n => propertyNames(n, names))
  else if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>
    if (record.properties && typeof record.properties === 'object') {
      names.push(...Object.keys(record.properties))
    }
    Object.values(record).forEach(v => propertyNames(v, names))
  }
  return names
}

function zodKeys(schema: ZodTypeAny): string[] {
  const def = schema._def
  if (def.typeName === 'ZodObject') {
    return Object.entries(schema._def.shape() as Record<string, ZodTypeAny>).flatMap(
      ([key, value]) => [key, ...zodKeys(value)]
    )
  }
  if (def.innerType) return zodKeys(def.innerType)
  if (def.schema) return zodKeys(def.schema)
  if (def.type) return zodKeys(def.type)
  return []
}

describe('openapi.json', () => {
  it('is up to date with the Zod schemas (run: pnpm --filter @repo/shared generate:openapi)', () => {
    const committed = JSON.parse(readFileSync(new URL('./openapi.json', import.meta.url), 'utf8'))
    expect(committed).toEqual(JSON.parse(JSON.stringify(document)))
  })

  it('covers the full buildplan §2 surface plus health', () => {
    const operations = Object.entries(document.paths).flatMap(([path, ops]) =>
      Object.keys(ops as object).map(method => `${method.toUpperCase()} ${path}`)
    )
    expect(operations.sort()).toEqual(
      [
        'GET /health',
        'POST /observations',
        'GET /observations/{id}',
        'POST /observations/{id}/verify',
        'POST /observations/{id}/intervention',
        'POST /observations/{id}/outcome',
        'GET /alerts',
      ].sort()
    )
  })

  it('requires a Firebase ID token on every operation except health', () => {
    for (const [path, ops] of Object.entries(document.paths)) {
      for (const op of Object.values(ops as Record<string, { security?: unknown[] }>)) {
        expect(op.security, path).toEqual(path === '/health' ? [] : [{ firebaseIdToken: [] }])
      }
    }
  })

  it('has no confidence number, probability or percentage in any field', () => {
    expect(propertyNames(document).filter(name => FORBIDDEN_FIELD.test(name))).toEqual([])
  })

  it('never marks a shared component itself as nullable', () => {
    expect(Object.keys(schemas).filter(name => schemas[name].nullable)).toEqual([])
  })
})

describe('Firestore observation document', () => {
  // The app may listen to observations/{id} directly (buildplan §2), so the document is
  // UI-bound too: the numbers live in observations/{id}/internal/diagnosis.
  it('has no confidence number, probability or percentage in any field', () => {
    expect(zodKeys(ObservationBaseSchema).filter(name => FORBIDDEN_FIELD.test(name))).toEqual([])
  })
})
