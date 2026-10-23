import { describe, expect, it } from 'vitest'
import type { ManifestEntry } from '../fetch/manifest'
import { gcsUri, knowledgeDocument, planIngest } from './plan'

const entry = (id: string, extra: Partial<ManifestEntry> = {}) =>
  ({
    id,
    title: id,
    file: `international/cabi/${id}.pdf`,
    format: 'pdf',
    source_url: `https://example.org/${id}`,
    sha256: `sha-${id}`,
    tier: 5,
    source: 'CABI',
    country: 'ZM',
    crop: ['tomato'],
    issue: ['late_blight'],
    year: 2021,
    licence: null,
    text_chars: 3000,
    needs_ocr: false,
    ...extra,
  }) as ManifestEntry

describe('planIngest', () => {
  it('uploads and imports new documents, and leaves unchanged ones alone', () => {
    const a = entry('a-2021')
    const b = entry('b-2021')
    const plan = planIngest([a, b], new Map([[`knowledge/${b.file}`, b.sha256]]), [
      { name: 'ragFiles/1', gcsUri: gcsUri(b) },
    ])
    expect(plan.upload.map(e => e.id)).toEqual(['a-2021'])
    expect(plan.import.map(e => e.id)).toEqual(['a-2021'])
    expect(plan.unchanged.map(e => e.id)).toEqual(['b-2021'])
    expect(plan.remove).toEqual([])
  })

  it('replaces a changed document and removes one no longer in the manifest', () => {
    const a = entry('a-2021')
    const plan = planIngest([a], new Map([[`knowledge/${a.file}`, 'old-sha']]), [
      { name: 'ragFiles/1', gcsUri: gcsUri(a) },
      { name: 'ragFiles/2', gcsUri: 'gs://crop-watch01-knowledge/knowledge/gone-2020.pdf' },
    ])
    expect(plan.upload.map(e => e.id)).toEqual(['a-2021'])
    expect(plan.import.map(e => e.id)).toEqual(['a-2021'])
    expect(plan.remove.map(f => f.name)).toEqual(['ragFiles/1', 'ragFiles/2'])
  })

  it('never ingests scanned PDFs or empty pages', () => {
    const plan = planIngest(
      [entry('scan-2010', { needs_ocr: true }), entry('shell-2015', { text_chars: 69 })],
      new Map(),
      []
    )
    expect(plan.needsOcr.map(e => e.id)).toEqual(['scan-2010'])
    expect(plan.empty.map(e => e.id)).toEqual(['shell-2015'])
    expect(plan.import).toEqual([])
  })

  it('indexes the curated metadata and the citation URL', () => {
    expect(knowledgeDocument(entry('a-2021'))).toMatchObject({
      gcs_uri: 'gs://crop-watch01-knowledge/knowledge/international/cabi/a-2021.pdf',
      source_url: 'https://example.org/a-2021',
      tier: 5,
      issue: ['late_blight'],
    })
  })
})
