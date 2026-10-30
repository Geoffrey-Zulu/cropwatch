import { describe, expect, it } from 'vitest'
import {
  alertUncertainty,
  ALERT_CLASS_LABELS,
  ALERT_CLASSES,
  ISSUE_LABELS,
  riskV0,
} from '@repo/shared'
import { hrefFor, parseRoute, type Route } from '../hooks/useRoute'
import type { DashObservation } from '../hooks/useLive'
import { queueRows } from '../pages/OfficerQueuePage'
import * as copy from './copy'

const obs = (over: Partial<DashObservation>): DashObservation => ({
  id: 'abcd1234efgh5678ijkl',
  createdAt: '2026-10-28T09:00:00.000Z',
  crop: 'tomato',
  district: 'Lusaka',
  districtSlug: 'lusaka',
  province: 'Lusaka',
  camp: null,
  location: { latitude: -15.4, longitude: 28.3 },
  status: 'complete',
  verification: 'AI_ASSESSED',
  verifiedIssue: null,
  suspectedIssue: 'tuta_absoluta',
  issue: 'tuta_absoluta',
  band: 'high',
  severity: 'moderate',
  needsReview: false,
  reviewReason: null,
  symptoms: [],
  modelId: 'gemini',
  promptVersion: 'diagnose-v1',
  photoPaths: [],
  reporterRole: 'farmer',
  orgId: null,
  recommendationId: null,
  description: null,
  plantingDate: null,
  growthStage: null,
  sim: false,
  ...over,
})

describe('routes', () => {
  it('round-trips every page and drawer through the hash', () => {
    const routes: Route[] = [
      { page: 'map' },
      { page: 'map', drawer: { kind: 'outbreak', id: 'c1' } },
      { page: 'map', drawer: { kind: 'alerts' } },
      { page: 'queue' },
      { page: 'queue', id: 'o1' },
      { page: 'queue', id: 'o1', drawer: { kind: 'observation', id: 'o1' } },
      { page: 'outgrower', drawer: { kind: 'visit', id: 'CHI-032' } },
      { page: 'sources' },
      { page: 'scenario' },
    ]
    for (const route of routes) expect(parseRoute(hrefFor(route))).toEqual(route)
    expect(parseRoute('#/nonsense')).toEqual({ page: 'map' })
  })

  it('opens the old detail links as drawers over the map', () => {
    expect(parseRoute('#/outbreaks/c1')).toEqual({
      page: 'map',
      drawer: { kind: 'outbreak', id: 'c1' },
    })
    expect(parseRoute('#/observations/o1')).toEqual({
      page: 'map',
      drawer: { kind: 'observation', id: 'o1' },
    })
  })
})

describe('officer queue', () => {
  it('puts routed reports first, then unverified reports in active clusters, and nothing else', () => {
    const routed = obs({
      id: 'routed',
      status: 'awaiting_expert_review',
      verification: 'UNVERIFIED',
    })
    const clustered = obs({ id: 'clustered' })
    const verifiedInCluster = obs({ id: 'verified', verification: 'FIELD_VERIFIED' })
    const plain = obs({ id: 'plain' })
    const rows = queueRows(
      [plain, clustered, verifiedInCluster, routed],
      [
        {
          id: 'c1',
          members: ['clustered', 'verified'],
        } as never,
      ]
    )
    expect(rows.map(r => r.id)).toEqual(['routed', 'clustered'])
  })
})

describe('copy', () => {
  it('has no em dashes and nothing that reads as odds or a model number', () => {
    const strings: string[] = []
    const collect = (value: unknown) => {
      if (typeof value === 'string') strings.push(value)
      else if (value && typeof value === 'object') Object.values(value).forEach(collect)
    }
    collect(copy)
    for (const band of ['low', 'medium', 'high'] as const) strings.push(copy.confidenceText(band))
    for (const c of ALERT_CLASSES) {
      strings.push(ALERT_CLASS_LABELS[c], alertUncertainty(c, { verified: 1, reports: 5 }))
    }
    for (const s of strings) {
      expect(s).not.toContain('—')
      expect(s).not.toMatch(/probab|likelihood|chance|%/i)
    }
  })

  it('says verification is evaluation data, never that the model learns', () => {
    expect(copy.EVALUATION_NOTE).toMatch(/test case/)
    expect(copy.EVALUATION_NOTE).toMatch(/does not learn/)
  })
})

describe('compactFactors (Districts to watch)', () => {
  const activity = (over: Partial<Parameters<typeof riskV0>[0]>) =>
    riskV0({ district: 'Lusaka', reportsThisWeek: 17, reportsLastWeek: 13, clusters: [], ...over })

  it('reads the biggest cluster back into one line', () => {
    const { factors } = activity({
      clusters: [
        { issueLabel: ISSUE_LABELS.fall_armyworm, size: 9, newLast24h: 1 },
        { issueLabel: ISSUE_LABELS.tuta_absoluta, size: 5, newLast24h: 0 },
      ],
    })
    expect(copy.compactFactors(factors)).toBe(
      '9 FAW reports · 10 km cluster · +1 in 24 h · 2 clusters'
    )
  })

  it('leaves out the 24 h change when nothing is new', () => {
    const { factors } = activity({
      clusters: [{ issueLabel: ISSUE_LABELS.tuta_absoluta, size: 5, newLast24h: 0 }],
    })
    expect(copy.compactFactors(factors)).toBe('5 Tuta reports · 10 km cluster')
  })

  it('falls back to the week when there is no cluster', () => {
    expect(copy.compactFactors(activity({}).factors)).toBe('17 this week · +31% on last week')
    expect(copy.compactFactors(activity({ reportsLastWeek: 0 }).factors)).toBe(
      '17 this week · none the week before'
    )
  })

  it('shows a sentence it does not know as it is', () => {
    expect(copy.compactFactors(['Something new'])).toBe('Something new')
  })
})
