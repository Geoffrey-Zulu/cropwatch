import { describe, expect, it } from 'vitest'
import { centroid, clusters, mergeAnchors, riskRose, riskV0, type ClusterPoint } from './risk'

const NOW = '2026-10-26T12:00:00.000Z'
const hoursAgo = (h: number) => new Date(Date.parse(NOW) - h * 3_600_000).toISOString()
// ~1.1 km per 0.01° of latitude.
const point = (id: string, dLat: number, extra: Partial<ClusterPoint> = {}): ClusterPoint => ({
  id,
  issue: 'tuta_absoluta',
  location: { latitude: -15.33 + dLat, longitude: 28.68 },
  created_at: hoursAgo(10),
  weight: 0.5,
  ...extra,
})

describe('cluster rule (technicaldoc §9)', () => {
  it('needs five qualifying same-issue reports within 10 km', () => {
    const four = [0, 0.01, 0.02, 0.03].map((d, i) => point(`p${i}`, d))
    expect(clusters(four, NOW)).toEqual([])
    const five = [...four, point('p4', 0.04)]
    expect(clusters(five, NOW)).toEqual([
      { issue: 'tuta_absoluta', members: ['p0', 'p1', 'p2', 'p3', 'p4'] },
    ])
  })

  it('ignores unverified, unknown, other-issue, old and far-away reports', () => {
    const base = [0, 0.01, 0.02, 0.03].map((d, i) => point(`p${i}`, d))
    for (const odd of [
      point('weak', 0.04, { weight: 0.2 }),
      point('unknown', 0.04, { issue: 'unknown' }),
      point('other', 0.04, { issue: 'late_blight' }),
      point('old', 0.04, { created_at: hoursAgo(73) }),
      point('far', 0.5),
    ]) {
      expect(clusters([...base, odd], NOW)).toEqual([])
    }
  })

  it('merges anchors that share members into one cluster', () => {
    expect(
      mergeAnchors([
        { issue: 'tuta_absoluta', members: ['a', 'b', 'c', 'd', 'e'] },
        { issue: 'tuta_absoluta', members: ['e', 'f', 'g', 'h', 'i'] },
        { issue: 'late_blight', members: ['a', 'x', 'y', 'z', 'w'] },
      ])
    ).toEqual([
      { issue: 'tuta_absoluta', members: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] },
      { issue: 'late_blight', members: ['a', 'w', 'x', 'y', 'z'] },
    ])
  })

  it('centres a cluster on its members, never on one farm', () => {
    expect(
      centroid([
        { latitude: -15, longitude: 28 },
        { latitude: -16, longitude: 29 },
      ])
    ).toEqual({ latitude: -15.5, longitude: 28.5 })
  })
})

describe('risk v0', () => {
  const quiet = { district: 'Chongwe', reportsThisWeek: 2, reportsLastWeek: 3, clusters: [] }

  it('is LOW when nothing is happening, and says why', () => {
    expect(riskV0(quiet)).toEqual({
      level: 'LOW',
      factors: ['2 reports this week (-33% on last week)', 'No cluster in the last 72 hours'],
    })
  })

  it('is ELEVATED with a cluster, or with a surge of reports', () => {
    expect(
      riskV0({ ...quiet, clusters: [{ issueLabel: 'Tuta absoluta', size: 5, newLast24h: 0 }] })
        .level
    ).toBe('ELEVATED')
    expect(riskV0({ ...quiet, reportsThisWeek: 9, reportsLastWeek: 4 })).toMatchObject({
      level: 'ELEVATED',
      factors: ['9 reports this week (+125% on last week)', 'No cluster in the last 72 hours'],
    })
  })

  it('is HIGH for a big cluster, two clusters, or a growing cluster during a surge', () => {
    const cluster = (size: number, newLast24h = 0) => ({
      issueLabel: 'Tuta absoluta',
      size,
      newLast24h,
    })
    expect(riskV0({ ...quiet, clusters: [cluster(8)] }).level).toBe('HIGH')
    expect(riskV0({ ...quiet, clusters: [cluster(5), cluster(5)] }).level).toBe('HIGH')
    const growing = riskV0({
      ...quiet,
      reportsThisWeek: 14,
      reportsLastWeek: 6,
      clusters: [cluster(6, 2)],
    })
    expect(growing).toEqual({
      level: 'HIGH',
      factors: [
        'Cluster of 6 Tuta absoluta reports within 10 km (2 new in 24 h)',
        '14 reports this week (+133% on last week)',
      ],
    })
  })

  it('never shows a level without factors, and never a probability', () => {
    for (const input of [
      quiet,
      { ...quiet, reportsThisWeek: 0, reportsLastWeek: 0 },
      { ...quiet, reportsThisWeek: 7, reportsLastWeek: 0 },
    ]) {
      const { factors } = riskV0(input)
      expect(factors.length).toBeGreaterThan(0)
      expect(factors.join(' ')).not.toMatch(/probab|likelihood|chance/i)
    }
  })

  it('knows when a level rose', () => {
    expect(riskRose(null, 'HIGH')).toBe(true)
    expect(riskRose('ELEVATED', 'HIGH')).toBe(true)
    expect(riskRose('HIGH', 'ELEVATED')).toBe(false)
    expect(riskRose('LOW', 'LOW')).toBe(false)
  })
})
