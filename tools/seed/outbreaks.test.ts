import { describe, it, expect } from 'vitest'
import { clusters } from './cluster'
import { clusterPoints, generateSeed } from './generate'
import { seedOutbreaks } from './outbreaks'

const ANCHOR = '2026-10-30T15:00:00.000Z'
const VENUE = { latitude: -15.4167, longitude: 28.2833 }
const seed = generateSeed({ anchor: ANCHOR })
const state = seedOutbreaks(seed)

describe('seeded outbreak state', () => {
  it('stores every cluster the rule finds at the anchor, each with one alert', () => {
    expect(state.clusters.map(c => c.members)).toEqual(
      clusters(clusterPoints(seed), ANCHOR).map(c => c.members)
    )
    expect(state.alerts.map(a => a.cluster_id)).toEqual(state.clusters.map(c => c.id))
    for (const c of state.clusters) {
      expect(c.id).toMatch(/^sim-cluster-/)
      expect(c.first_detected_at <= ANCHOR).toBe(true)
    }
  })

  it('gives every district a qualitative level with its factors, and the storylines a signal', () => {
    for (const r of state.risk) {
      expect(['LOW', 'ELEVATED', 'HIGH']).toContain(r.level)
      expect(r.contributing_factors.length).toBeGreaterThan(0)
      expect(r.contributing_factors.join(' ')).not.toMatch(/probab|likel|chance|confiden/i)
    }
    const level = (slug: string) => state.risk.find(r => r.district_slug === slug)?.level
    expect(level('chipata')).toBe('HIGH')
    expect(level('chongwe')).not.toBe('LOW')
  })

  it('alerts carry their district level and factors', () => {
    for (const a of state.alerts) {
      const r = state.risk.find(x => x.district_slug === a.district_slug)!
      expect(a.level).toBe(r.level)
      expect(a.contributing_factors).toEqual(r.contributing_factors)
    }
  })

  it('leaves the live-demo venue without an open cluster, so the presenter creates one', () => {
    const live = generateSeed({
      anchor: ANCHOR,
      liveDemo: { issue: 'tuta_absoluta', center: VENUE, district: 'Lusaka' },
    })
    const open = seedOutbreaks(live).clusters.flatMap(c => c.members)
    expect(live.liveDemo!.armed.some(id => open.includes(id))).toBe(false)
  })
})
