import { describe, it, expect } from 'vitest'
import { OutgrowerOverviewSchema } from '@repo/shared'
import {
  farmLabel,
  officerLabel,
  outgrowerOverview,
  type OrgObservation,
} from './firestoreDashboard'

const NOW = Date.parse('2026-10-29T12:00:00.000Z')
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString()

const report = (over: Partial<OrgObservation>): OrgObservation => ({
  id: 'sim-obs-1',
  reporterId: 'sim-farmer-chipata-001',
  reporterRole: 'farmer',
  camp: 'Chipata Camp A',
  district: 'Chipata',
  districtSlug: 'chipata',
  crop: 'maize',
  status: 'complete',
  verification: 'AI_ASSESSED',
  issue: 'fall_armyworm',
  severity: 'low',
  createdAt: hoursAgo(10),
  sim: true,
  ...over,
})

const build = (reports: OrgObservation[], clustered: string[] = []) =>
  outgrowerOverview({
    orgId: 'demo-outgrower',
    org: { name: 'DEMO OUTGROWER CO.', enrolled_farmer_count: 1240, sim: true },
    officers: [
      { id: 'sim-officer-01', district: 'Chipata' },
      { id: 'sim-officer-02', district: 'Chipata' },
      { id: 'sim-officer-03', district: 'Katete' },
    ],
    reports,
    clustered: new Set(clustered),
    levels: new Map([['chipata', 'HIGH' as const]]),
    now: NOW,
  })

describe('outgrowerOverview', () => {
  it('orders visits by reason: in a cluster with a HIGH district first', () => {
    const view = build(
      [
        report({ id: 'a', reporterId: 'sim-farmer-chipata-001', severity: 'low' }),
        report({ id: 'b', reporterId: 'sim-farmer-chipata-002', severity: 'severe' }),
      ],
      ['a']
    )
    const visits = view.officers.flatMap(o => o.visits)
    expect(visits.find(v => v.report_number === 'A')).toMatchObject({ priority: 1 })
    expect(visits.find(v => v.report_number === 'A')!.reasons).toContain(
      'In an active Fall armyworm cluster'
    )
    expect(visits.find(v => v.report_number === 'B')).toMatchObject({ priority: 2 })
  })

  it('splits a district with two officers by camp, and leaves districts without one unassigned', () => {
    const view = build([
      report({ id: 'a', reporterId: 'sim-farmer-chipata-001', camp: 'Chipata Camp A' }),
      report({ id: 'b', reporterId: 'sim-farmer-chipata-002', camp: 'Chipata Camp B' }),
      report({
        id: 'c',
        reporterId: 'sim-farmer-lundazi-001',
        camp: null,
        district: 'Lundazi',
        districtSlug: 'lundazi',
        severity: 'severe',
      }),
    ])
    const [one, two] = view.officers
    expect(one.visits.map(v => v.camp)).toEqual(['Chipata Camp A'])
    expect(two.visits.map(v => v.camp)).toEqual(['Chipata Camp B'])
    expect(view.unassigned.map(v => v.camp)).toEqual(['Lundazi (camp not recorded)'])
  })

  it('keeps one visit per farm (its latest report) and leaves out reports past the window', () => {
    const view = build([
      report({ id: 'old', createdAt: hoursAgo(20 * 24) }),
      report({ id: 'a', createdAt: hoursAgo(30) }),
      report({ id: 'b', createdAt: hoursAgo(5) }),
    ])
    expect(view.reports).toBe(2)
    expect(view.officers.flatMap(o => o.visits).map(v => v.report_number)).toEqual(['B'])
  })

  it('gives each visit the history of its farm in the window, newest first, without a location', () => {
    const view = build([
      report({ id: 'old', createdAt: hoursAgo(60), severity: 'low' }),
      report({ id: 'new', createdAt: hoursAgo(5), severity: 'severe' }),
    ])
    const visit = view.officers.flatMap(o => o.visits)[0]
    expect(visit.history?.map(h => h.report_number)).toEqual(['NEW', 'OLD'])
    expect(JSON.stringify(visit.history)).not.toMatch(/latitude|longitude|location/)
  })

  it('never carries a location, and fits the dashboard contract', () => {
    const view = build([report({ id: 'a', severity: 'severe' })], ['a'])
    expect(OutgrowerOverviewSchema.parse(view)).toEqual(view)
    expect(JSON.stringify(view)).not.toMatch(/latitude|longitude|geohash|location/)
  })

  it('labels farms and officers without exposing ids', () => {
    expect(farmLabel('sim-farmer-chipata-012')).toBe('Farm CHI-012')
    expect(farmLabel('k3J9xQ2mW8pL5vR1tY7u')).toBe('Farm K3J9')
    expect(officerLabel('sim-officer-01')).toBe('Field officer 01')
  })
})
