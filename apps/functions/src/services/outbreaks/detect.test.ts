import { describe, it, expect } from 'vitest'
import { clusterSql, clustersFromRows, type ClusterRow } from './detect'

const NOW = '2026-10-26T12:00:00.000Z'

const row = (id: string, neighbours: string[], over: Partial<ClusterRow> = {}): ClusterRow => ({
  obs_id: id,
  latitude: -15.33,
  longitude: 28.68,
  created_at: '2026-10-26T06:00:00.000Z',
  district: 'Chongwe',
  district_slug: 'chongwe',
  sim: false,
  verification_weight: 0.5,
  neighbours,
  ...over,
})

const five = ['a', 'b', 'c', 'd', 'e']

describe('clustersFromRows', () => {
  it('finds no cluster below five reports', () => {
    const ids = five.slice(0, 4)
    expect(
      clustersFromRows(
        'tuta_absoluta',
        ids.map(id => row(id, ids)),
        NOW
      )
    ).toEqual([])
  })

  it('builds one cluster from five mutual neighbours', () => {
    const rows = five.map((id, i) =>
      row(id, five, {
        latitude: -15.3 - i * 0.01,
        created_at: i < 2 ? '2026-10-24T12:00:00.000Z' : '2026-10-26T06:00:00.000Z',
      })
    )
    const [cluster, ...rest] = clustersFromRows('tuta_absoluta', rows, NOW)
    expect(rest).toEqual([])
    expect(cluster).toMatchObject({
      issue: 'tuta_absoluta',
      district: 'Chongwe',
      district_slug: 'chongwe',
      sim: false,
      newLast24h: 3,
    })
    expect([...cluster.members].sort()).toEqual(five)
    expect(cluster.center.latitude).toBeCloseTo(-15.32, 5)
  })

  it('names the district most members are in, and is simulated if any member is', () => {
    const rows = five.map((id, i) =>
      row(id, five, i < 2 ? { district: 'Lusaka', district_slug: 'lusaka', sim: i === 0 } : {})
    )
    const [cluster] = clustersFromRows('tuta_absoluta', rows, NOW)
    expect(cluster.district_slug).toBe('chongwe')
    expect(cluster.sim).toBe(true)
  })

  it('merges overlapping anchors into one cluster', () => {
    const left = ['a', 'b', 'c', 'd', 'e']
    const right = ['e', 'f', 'g', 'h', 'i']
    const rows = [
      row('a', left),
      row('b', ['a', 'b']),
      row('c', ['a', 'c']),
      row('d', ['a', 'd']),
      row('e', [...left, ...right.slice(1)]),
      row('f', ['e', 'f']),
      row('g', ['e', 'g']),
      row('h', ['e', 'h']),
      row('i', right),
    ]
    const found = clustersFromRows('tuta_absoluta', rows, NOW)
    expect(found).toHaveLength(1)
    expect(found[0].members).toHaveLength(9)
  })
})

describe('clusterSql', () => {
  it('applies the shared rule: issue, weight, 72 h window and 10 km', () => {
    const sql = clusterSql('cropwatch')
    expect(sql).toContain('`cropwatch.observations_latest`')
    expect(sql).toContain('verification_weight >= 0.5')
    expect(sql).toContain('INTERVAL 72 HOUR')
    expect(sql).toContain('ST_DWITHIN(a.geo, b.geo, 10000)')
  })
})
