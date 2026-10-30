import { describe, it, expect } from 'vitest'
import { distanceKm, findDistrict, simPhotoFor, toObservationRow } from '@repo/shared'
import { clusters, qualifying, type ClusterPoint } from './cluster'
import { clusterPoints, generateSeed, SIM_STAMP, type SeedData } from './generate'

const ANCHOR = '2026-10-30T15:00:00.000Z'
const VENUE = { latitude: -15.4167, longitude: 28.2833 }
const seed = generateSeed({ anchor: ANCHOR })

const withoutTimes = (data: SeedData) =>
  JSON.parse(
    JSON.stringify(data, (key, value) =>
      ['anchor', 'created_at', 'diagnosed_at', 'planting_date'].includes(key) ? undefined : value
    )
  )

describe('determinism', () => {
  it('produces identical data for the same anchor', () => {
    expect(JSON.stringify(generateSeed({ anchor: ANCHOR }))).toBe(JSON.stringify(seed))
  })

  it('only shifts timestamps when the anchor moves', () => {
    const later = generateSeed({ anchor: '2026-11-01T08:00:00.000Z' })
    expect(withoutTimes(later)).toEqual(withoutTimes(seed))
    const shift = Date.parse('2026-11-01T08:00:00.000Z') - Date.parse(ANCHOR)
    const [a, b] = [seed.observations[0], later.observations[0]]
    expect(Date.parse(b.observation.created_at) - Date.parse(a.observation.created_at)).toBe(shift)
  })
})

describe('simulated data', () => {
  it('is all sim: true, sim- ids, stamped sim-seed, photos only from the credited library', () => {
    expect(seed.org.data.sim).toBe(true)
    expect(seed.users.every(u => u.profile.sim && u.id.startsWith('sim-'))).toBe(true)
    for (const { id, observation, internal } of seed.observations) {
      expect(id.startsWith('sim-')).toBe(true)
      expect(observation.sim).toBe(true)
      expect(observation.diagnosis).toMatchObject(SIM_STAMP)
      expect(internal).toMatchObject(SIM_STAMP)
      // At most one photo, always a credited library photo; where an officer has recorded the
      // real issue, the photo shows that issue (the AI may have been wrong, the photo is not).
      expect(observation.photo_paths.length).toBeLessThanOrEqual(1)
      for (const path of observation.photo_paths) {
        const photo = simPhotoFor(path)
        expect(photo).not.toBeNull()
        if (observation.verified_issue) expect(photo!.issue).toBe(observation.verified_issue)
      }
    }
    // Most simulated reports are clickable with a photo; cassava mosaic has none in the library.
    const withPhoto = seed.observations.filter(o => o.observation.photo_paths.length > 0).length
    expect(withPhoto / seed.observations.length).toBeGreaterThan(0.75)
  })

  it('has about 500 observations across the storylines', () => {
    const by = (storyline: string) => seed.observations.filter(o => o.storyline === storyline)
    expect(seed.observations).toHaveLength(492)
    expect(by('faw-eastern')).toHaveLength(180)
    expect(by('tuta-lusaka')).toHaveLength(120)
    expect(by('background')).toHaveLength(192)
  })

  it('spans 21 days ending at the anchor', () => {
    const times = seed.observations.map(o => Date.parse(o.observation.created_at))
    expect(Math.max(...times)).toBeLessThanOrEqual(Date.parse(ANCHOR))
    expect(Date.parse(ANCHOR) - Math.min(...times)).toBeLessThanOrEqual(21 * 86_400_000)
  })

  it('keys every observation by a canonical district_slug', () => {
    for (const { observation } of seed.observations) {
      expect(observation.district_slug).toBe(findDistrict(observation.district)!.slug)
    }
    const provinces = (storyline: string) =>
      new Set(
        seed.observations.filter(o => o.storyline === storyline).map(o => o.observation.province)
      )
    expect(provinces('faw-eastern')).toEqual(new Set(['Eastern']))
    expect(provinces('tuta-lusaka')).toEqual(new Set(['Lusaka']))
  })

  it('mixes all four verification states; rows are complete or wait for an officer', () => {
    const states = new Set(seed.observations.map(o => o.observation.verification_state))
    expect(states).toEqual(
      new Set(['UNVERIFIED', 'AI_ASSESSED', 'FIELD_VERIFIED', 'EXPERT_CONFIRMED'])
    )
    const statuses = new Set(seed.observations.map(o => o.observation.status))
    expect(statuses).toEqual(new Set(['awaiting_expert_review', 'complete']))
    // D4 decision a: canned, cited recommendations for complete rows; a 30–45 row backlog.
    const complete = seed.observations.filter(o => o.observation.status === 'complete')
    expect(complete.every(o => o.recommendation?.id === o.observation.recommendation_id)).toBe(true)
    const backlog = seed.observations.length - complete.length
    expect(backlog).toBeGreaterThanOrEqual(30)
    expect(backlog).toBeLessThanOrEqual(45)
  })

  it('accelerates: the storylines report more in their last week than their first', () => {
    for (const storyline of ['faw-eastern', 'tuta-lusaka']) {
      const ages = seed.observations
        .filter(o => o.storyline === storyline)
        .map(o => (Date.parse(ANCHOR) - Date.parse(o.observation.created_at)) / 86_400_000)
      const lastWeek = ages.filter(age => age < 7).length
      const firstWeek = ages.filter(age => age >= 14).length
      expect(lastWeek, storyline).toBeGreaterThan(firstWeek * 2)
    }
  })

  it('includes DEMO OUTGROWER CO. with member farmers and field officers', () => {
    expect(seed.org.data.name).toBe('DEMO OUTGROWER CO.')
    const members = seed.users.filter(u => u.profile.org_id === seed.org.id)
    expect(members.some(u => u.profile.role === 'field_officer')).toBe(true)
    expect(members.filter(u => u.profile.role === 'farmer').length).toBeGreaterThan(20)
  })

  it('references only reporters that exist', () => {
    const ids = new Set(seed.users.map(u => u.id))
    for (const { observation } of seed.observations) expect(ids).toContain(observation.reporter_id)
  })

  it('flattens to valid BigQuery rows, internal numbers included', () => {
    for (const { id, observation, internal } of seed.observations) {
      const row = toObservationRow(id, observation, internal)
      expect(row.model_confidence).toBe(internal.model_confidence)
      expect(row.sim).toBe(true)
    }
  })
})

describe('storylines and the §9 cluster rule', () => {
  const found = clusters(clusterPoints(seed), ANCHOR)
  const districtsOf = (members: string[]) =>
    new Set(members.map(id => seed.observations.find(o => o.id === id)!.observation.district))

  it('shows FAW spreading in Eastern Province and Tuta around Chongwe', () => {
    expect(
      found.some(c => c.issue === 'fall_armyworm' && districtsOf(c.members).has('Chipata'))
    ).toBe(true)
    expect(
      found.some(c => c.issue === 'tuta_absoluta' && districtsOf(c.members).has('Chongwe'))
    ).toBe(true)
  })

  it('leaves the national background unclustered', () => {
    const background = new Set(
      seed.observations.filter(o => o.storyline === 'background').map(o => o.id)
    )
    for (const cluster of found) {
      expect(cluster.members.some(id => background.has(id))).toBe(false)
    }
  })
})

describe('--live-demo', () => {
  const arm = (issue: 'tuta_absoluta' | 'fall_armyworm', center: typeof VENUE, district: string) =>
    generateSeed({ anchor: ANCHOR, liveDemo: { issue, center, district } })

  const presenter = (center: typeof VENUE, issue: string, weight: number): ClusterPoint => ({
    id: 'presenter',
    issue: issue as ClusterPoint['issue'],
    location: center,
    created_at: ANCHOR,
    weight,
  })

  it.each([
    ['tuta_absoluta', VENUE, 'Lusaka'],
    // The hardest case: the venue sits inside an existing FAW outbreak.
    ['fall_armyworm', findDistrict('Chipata')!.center, 'Chipata'],
  ] as const)('pre-arms exactly four %s reports near the venue', (issue, center, district) => {
    const live = arm(issue, center, district)
    const points = clusterPoints(live)
    const near = qualifying(points, ANCHOR).filter(
      p => p.issue === issue && distanceKm(p.location, center) <= 10
    )
    expect(near.map(p => p.id).sort()).toEqual(live.liveDemo!.armed)
    // No cluster at the venue before the presenter reports…
    expect(
      clusters(points, ANCHOR).some(c =>
        c.members.some(id => distanceKm(points.find(p => p.id === id)!.location, center) <= 10)
      )
    ).toBe(false)
    // …and their report, assessed with medium or high confidence, completes it.
    const after = clusters([...points, presenter(center, issue, 0.5)], ANCHOR)
    expect(after.some(c => c.members.includes('presenter') && c.members.length === 5)).toBe(true)
  })

  it("needs the officer's confirmation if the presenter's report is routed to review", () => {
    const live = arm('tuta_absoluta', VENUE, 'Lusaka')
    const points = clusterPoints(live)
    // UNVERIFIED weighs 0.2; FIELD_VERIFIED 0.8 completes it.
    expect(
      clusters([...points, presenter(VENUE, 'tuta_absoluta', 0.2)], ANCHOR)
    ).not.toContainEqual(
      expect.objectContaining({ members: expect.arrayContaining(['presenter']) })
    )
    expect(
      clusters([...points, presenter(VENUE, 'tuta_absoluta', 0.8)], ANCHOR).some(c =>
        c.members.includes('presenter')
      )
    ).toBe(true)
  })

  it('keeps the rest of the national picture', () => {
    const live = arm('tuta_absoluta', VENUE, 'Lusaka')
    expect(live.observations).toHaveLength(496)
    expect(clusters(clusterPoints(live), ANCHOR).some(c => c.issue === 'fall_armyworm')).toBe(true)
  })
})
