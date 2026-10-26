import { describe, it, expect, vi } from 'vitest'
import type { ObservationRow, RiskLevel, RiskSignal } from '@repo/shared'
import type { DetectedCluster } from './detect'
import type { ClusterChange, NewAlert, OutbreakStore } from './outbreakStore'
import { tracker } from './track'

const NOW = '2026-10-26T09:00:00.000Z'

const row = (over: Partial<ObservationRow> = {}) =>
  ({
    obs_id: 'obs5',
    district: 'Chongwe',
    district_slug: 'chongwe',
    issue: 'tuta_absoluta',
    verification_weight: 0.5,
    sim: false,
    ...over,
  }) as ObservationRow

const detected: DetectedCluster = {
  issue: 'tuta_absoluta',
  members: ['obs1', 'obs2', 'obs3', 'obs4', 'obs5'],
  center: { latitude: -15.33, longitude: 28.68 },
  district: 'Chongwe',
  district_slug: 'chongwe',
  sim: false,
  newLast24h: 5,
}

const signal = (level: RiskLevel): RiskSignal => ({
  level,
  factors: [`factor for ${level}`],
})

function fakeStore({
  changes = [] as ClusterChange[],
  risk = {} as Record<string, { previous: RiskLevel | null; level: RiskLevel }>,
} = {}) {
  const alerts: NewAlert[] = []
  const store: OutbreakStore = {
    upsertClusters: vi.fn(async () => changes),
    updateRisk: vi.fn(async (slug: string) => {
      const r = risk[slug] ?? { previous: 'LOW', level: 'LOW' }
      return {
        district: slug === 'chongwe' ? 'Chongwe' : slug,
        district_slug: slug,
        previous: r.previous,
        signal: signal(r.level),
        sim: false,
      }
    }),
    raiseAlert: vi.fn(async (alert: NewAlert) => {
      alerts.push(alert)
      return `alert${alerts.length}`
    }),
  }
  return { store, alerts }
}

const run = (store: OutbreakStore, record: ObservationRow | null, clusters = [detected]) => {
  const detect = vi.fn(async () => clusters)
  const track = tracker({ record: async () => record, detect, store, now: () => NOW })
  return { detect, result: track('obs5') }
}

describe('tracker', () => {
  it('does nothing for a report it could not record', async () => {
    const { store } = fakeStore()
    const { detect, result } = run(store, null)
    expect(await result).toEqual({ recorded: false, clusters: [], risk: [], alerts: [] })
    expect(detect).not.toHaveBeenCalled()
    expect(store.updateRisk).not.toHaveBeenCalled()
  })

  it('raises one dispatching cluster alert, carrying the district risk factors, for a new cluster', async () => {
    const { store, alerts } = fakeStore({
      changes: [{ id: 'c1', kind: 'created', cluster: detected }],
      risk: { chongwe: { previous: 'LOW', level: 'ELEVATED' } },
    })
    const { detect, result } = run(store, row())
    const outcome = await result
    expect(detect).toHaveBeenCalledWith('tuta_absoluta', NOW)
    expect(outcome.clusters).toEqual([{ id: 'c1', kind: 'created', size: 5 }])
    expect(outcome.alerts).toEqual(['alert1'])
    expect(alerts).toEqual([
      expect.objectContaining({
        type: 'cluster',
        issue: 'tuta_absoluta',
        district_slug: 'chongwe',
        center: detected.center,
        radius_km: 10,
        level: 'ELEVATED',
        factors: ['factor for ELEVATED'],
        observation_ids: detected.members,
        cluster_id: 'c1',
        dispatch: true,
        sim: false,
      }),
    ])
  })

  it('does not alert again for a cluster that only grew', async () => {
    const { store } = fakeStore({
      changes: [{ id: 'c1', kind: 'grown', cluster: detected }],
      risk: { chongwe: { previous: 'ELEVATED', level: 'ELEVATED' } },
    })
    expect((await run(store, row()).result).alerts).toEqual([])
    expect(store.raiseAlert).not.toHaveBeenCalled()
  })

  it('raises a risk_change alert when a district first turns HIGH without a new cluster', async () => {
    const { store, alerts } = fakeStore({
      changes: [{ id: 'c1', kind: 'grown', cluster: detected }],
      risk: { chongwe: { previous: 'ELEVATED', level: 'HIGH' } },
    })
    await run(store, row()).result
    expect(alerts).toEqual([
      expect.objectContaining({
        type: 'risk_change',
        level: 'HIGH',
        district_slug: 'chongwe',
        radius_km: 25,
        cluster_id: null,
        observation_ids: ['obs5'],
      }),
    ])
  })

  it('does not repeat a HIGH alert for a district already HIGH', async () => {
    const { store } = fakeStore({ risk: { chongwe: { previous: 'HIGH', level: 'HIGH' } } })
    expect((await run(store, row(), []).result).alerts).toEqual([])
  })

  it('skips clustering for unknown or unconfirmed issues but still refreshes risk', async () => {
    for (const record of [
      row({ issue: 'unknown' }),
      row({ issue: null }),
      row({ verification_weight: 0.25 }),
    ]) {
      const { store } = fakeStore()
      const { detect, result } = run(store, record)
      const outcome = await result
      expect(detect).not.toHaveBeenCalled()
      expect(outcome.risk).toEqual([{ district_slug: 'chongwe', level: 'LOW' }])
    }
  })

  it('refreshes risk for every district a cluster touches', async () => {
    const lusaka = { ...detected, district: 'Lusaka', district_slug: 'lusaka' }
    const { store } = fakeStore({ changes: [{ id: 'c2', kind: 'unchanged', cluster: lusaka }] })
    await run(store, row()).result
    expect(
      vi
        .mocked(store.updateRisk)
        .mock.calls.map(c => c[0])
        .sort()
    ).toEqual(['chongwe', 'lusaka'])
  })
})
