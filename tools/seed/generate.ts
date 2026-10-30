import {
  confidenceBand,
  DiagnosisInternalSchema,
  distanceKm,
  expertReviewReason,
  findDistrict,
  geohash,
  ObservationSchema,
  OrgSchema,
  severityBand,
  SIM_PHOTOS,
  simPhotoPath,
  UserProfileSchema,
  VERIFICATION_WEIGHTS,
  type Crop,
  type DiagnosisInternal,
  type District,
  type GeoPoint,
  type Issue,
  type KnownIssue,
  type Observation,
  type Org,
  type Recommendation,
  type UserProfile,
  type VerificationState,
} from '@repo/shared'
import type { ClusterPoint } from './cluster'
import { createRandom, offset, type Random } from './random'
import { AGRONOMIST_NAME, campFor, OFFICER_NAMES, personName } from './names'
import { cannedRecommendation } from './recommendations'

// Simulated demo data (technicaldoc §12). Every row is sim: true (CLAUDE.md invariant 5),
// diagnoses are stamped sim-seed (no model was called), and nothing here is a real farm.

export const SEED = 20261030
export const SIM_STAMP = { model_id: 'sim-seed', prompt_version: 'sim-seed-v1' }
export const DEMO_ORG_ID = 'demo-outgrower'
const DEMO_ORG: Org = OrgSchema.parse({
  name: 'DEMO OUTGROWER CO.',
  type: 'outgrower',
  enrolled_farmer_count: 1240,
  sim: true,
})
const DAYS = 21
// Live-demo: demo-issue reports this close to the venue are aged out of the cluster window, so
// nothing there qualifies before the presenter's report.
const DEMO_CLEAR_KM = 15
const DEMO_CLEAR_HOURS = 96

export type Storyline = 'faw-eastern' | 'tuta-lusaka' | 'background' | 'live-demo'

export interface SeedObservation {
  id: string
  storyline: Storyline
  observation: Observation
  internal: DiagnosisInternal
  // Canned (D4 decision a); null while the row waits for an officer.
  recommendation: { id: string; data: Recommendation } | null
}

export interface SeedData {
  anchor: string
  org: { id: string; data: Org }
  users: { id: string; profile: UserProfile }[]
  observations: SeedObservation[]
  liveDemo: (LiveDemoOptions & { armed: string[] }) | null
}

export interface LiveDemoOptions {
  issue: KnownIssue
  center: GeoPoint
  district: string
}

interface IssueSpec {
  crop: Crop
  symptoms: string[]
  descriptions: string[]
  severity: [number, number]
  // What the AI may mistake it for.
  confusedWith: Issue
}

const ISSUES: Record<KnownIssue | 'unknown', IssueSpec> = {
  fall_armyworm: {
    crop: 'maize',
    symptoms: [
      'ragged holes in whorl leaves',
      'sawdust-like frass in the funnel',
      'window-pane feeding on young leaves',
    ],
    descriptions: [
      'holes in the leaves and sawdust in the funnel',
      'small caterpillars inside the whorl',
      'leaves eaten from the middle',
      'worms in almost every plant on the lower side of the field',
      'started last week after the first rains, now spreading',
      'I put ash in the funnel but they are still eating',
      'the young maize looks torn, like it was cut with scissors',
      'caterpillars with a Y mark on the head',
      'about half the field has holes in the top leaves',
      'my neighbour has the same worms',
    ],
    severity: [8, 60],
    confusedWith: 'unknown',
  },
  tuta_absoluta: {
    crop: 'tomato',
    symptoms: [
      'blotch-shaped leaf mines',
      'dark frass inside the mines',
      'small exit holes on fruit',
    ],
    descriptions: [
      'tunnels in the leaves',
      'fruits have small holes',
      'leaves drying from the top',
      'white trails inside the leaves',
      'small holes in the green tomatoes, rotting inside',
      'the whole plot is affected since Monday',
      'small moths flying at night near the tomatoes',
      'I sprayed last week but new mines keep coming',
      'leaves look burnt and papery',
    ],
    severity: [10, 70],
    confusedWith: 'unknown',
  },
  late_blight: {
    crop: 'tomato',
    symptoms: [
      'dark water-soaked lesions',
      'white growth under leaves in the morning',
      'lesions spreading after rain',
    ],
    descriptions: [
      'dark patches spreading fast after rain',
      'plants collapsing within days',
      'black stems and leaves after the rains',
      'fruit turning brown with a greasy look',
      'white powder under the leaves in the morning',
      'half the plants died in four days',
      'the whole row went black overnight',
    ],
    severity: [15, 80],
    confusedWith: 'early_blight',
  },
  early_blight: {
    crop: 'tomato',
    symptoms: ['concentric brown rings on older leaves', 'yellowing around lesions'],
    descriptions: [
      'brown rings on the old leaves',
      'lower leaves turning yellow',
      'round brown spots like a target',
      'spots start at the bottom and move up',
      'leaves falling off the lower stems',
      'the plants are still fruiting but the leaves are spotted',
    ],
    severity: [5, 45],
    confusedWith: 'late_blight',
  },
  diamondback_moth: {
    crop: 'cabbage',
    symptoms: ['small irregular holes', 'window-pane feeding', 'small green larvae under leaves'],
    descriptions: [
      'leaves full of small holes',
      'green worms under the leaves',
      'tiny green caterpillars that drop on a thread',
      'cabbage heads have holes, buyers are refusing them',
      'leaves look like windows, thin and clear',
      'I sprayed twice and they are back',
    ],
    severity: [5, 50],
    confusedWith: 'unknown',
  },
  cassava_mosaic: {
    crop: 'cassava',
    symptoms: ['yellow-green mosaic on leaves', 'distorted, curled leaflets'],
    descriptions: [
      'yellow patchy leaves',
      'leaves twisted and small',
      'yellow and green patches, plants not growing',
      'new leaves curled and narrow',
      'the cuttings from my neighbour all look like this',
      'plants very short compared to last season',
    ],
    severity: [10, 60],
    confusedWith: 'cassava_brown_streak',
  },
  cassava_brown_streak: {
    crop: 'cassava',
    symptoms: ['yellow feathery chlorosis along veins', 'brown streaks on stems'],
    descriptions: [
      'yellow lines on the leaves',
      'roots rotting inside',
      'brown streaks inside the roots when I cut them',
      'tubers hard and brown, cannot sell them',
      'yellow along the veins of the old leaves',
    ],
    severity: [10, 50],
    confusedWith: 'cassava_mosaic',
  },
  maize_lethal_necrosis: {
    crop: 'maize',
    symptoms: ['chlorotic mottling', 'drying from the leaf margins', 'dead heart'],
    descriptions: [
      'whole plants drying',
      'yellow streaks, then the plant dies',
      'leaves drying from the edges',
      'the top of the plant is dead',
      'cobs very small and empty',
    ],
    severity: [20, 80],
    confusedWith: 'unknown',
  },
  unknown: {
    crop: 'soybean',
    symptoms: ['general yellowing', 'stunted growth'],
    descriptions: [
      'plants look sick',
      'not growing well',
      'leaves going pale yellow',
      'some plants short and yellow in patches',
      'the field looks tired after the rains',
    ],
    severity: [5, 40],
    confusedWith: 'unknown',
  },
}

const GROWTH: Record<Crop, [maxDays: number, stage: string][]> = {
  maize: [
    [30, 'V4'],
    [45, 'V6'],
    [60, 'V10'],
    [999, 'VT'],
  ],
  tomato: [
    [45, 'vegetative'],
    [65, 'flowering'],
    [999, 'fruiting'],
  ],
  cabbage: [
    [40, 'vegetative'],
    [999, 'heading'],
  ],
  cassava: [[999, 'vegetative']],
  soybean: [
    [40, 'vegetative'],
    [999, 'flowering'],
  ],
}

// One observation's plan: where, when and what is really there. Randomness for the rest comes
// from a stream keyed by the id, so adjusting one plan never shifts another row's draws.
interface Plan {
  id: string
  storyline: Storyline
  issue: KnownIssue | 'unknown'
  district: District
  location: GeoPoint
  hoursAgo: number
  reporterId: string
  reporterRole: 'farmer' | 'field_officer'
  orgId: string | null
  // Live-demo reports are confident, correct and unverified by construction.
  armed?: boolean
}

function district(name: string): District {
  const found = findDistrict(name)
  if (!found) throw new Error(`Unknown district ${name}`)
  return found
}

// FNV-1a: a stable 32-bit hash for per-row random streams.
function hash(text: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return h >>> 0
}

const pad = (n: number, width: number) => String(n).padStart(width, '0')

export function generateSeed({
  anchor,
  liveDemo = null,
}: {
  anchor: string
  liveDemo?: LiveDemoOptions | null
}): SeedData {
  const random = createRandom(SEED)
  const anchorMs = Date.parse(anchor)
  const users = new Map<string, UserProfile>()
  const farmersByDistrict = new Map<string, string[]>()

  // DEMO OUTGROWER CO. works with Eastern Province maize farmers; its field officers report too.
  const officers = ['Chipata', 'Chipata', 'Katete', 'Lundazi', 'Petauke', 'Chadiza'].map(
    (name, i) => {
      const id = `sim-officer-${pad(i + 1, 2)}`
      const d = district(name)
      users.set(id, {
        role: 'field_officer',
        org_id: DEMO_ORG_ID,
        district: d.name,
        province: d.province,
        channel: 'app',
        display_name: OFFICER_NAMES[i],
        sim: true,
      })
      return { id, district: d.slug }
    }
  )
  users.set('sim-agronomist-01', {
    role: 'agronomist',
    org_id: null,
    district: 'Lusaka',
    province: 'Lusaka',
    channel: 'app',
    display_name: AGRONOMIST_NAME,
    sim: true,
  })

  function reporter(d: District, orgShare: number) {
    const pool = farmersByDistrict.get(d.slug) ?? []
    farmersByDistrict.set(d.slug, pool)
    let farmerId: string
    if (pool.length > 0 && random.chance(0.4)) {
      farmerId = random.pick(pool)
    } else {
      farmerId = `sim-farmer-${d.slug}-${pad(pool.length + 1, 3)}`
      pool.push(farmerId)
      users.set(farmerId, {
        role: 'farmer',
        org_id: random.chance(orgShare) ? DEMO_ORG_ID : null,
        district: d.name,
        province: d.province,
        channel: random.weighted([
          ['app', 0.7],
          ['sms', 0.2],
          ['ussd', 0.1],
        ] as const),
        // Its own stream, keyed by the id, so names never shift where reports fall.
        display_name: personName(createRandom(SEED ^ hash(farmerId)), d.province),
        sim: true,
      })
    }
    const orgId = users.get(farmerId)!.org_id
    const officer = officers.find(o => o.district === d.slug)
    if (orgId && officer && random.chance(0.15)) {
      return { reporterId: officer.id, reporterRole: 'field_officer' as const, orgId }
    }
    return { reporterId: farmerId, reporterRole: 'farmer' as const, orgId }
  }

  const plans: Plan[] = []

  // An accelerating outbreak: reports concentrate toward the anchor, around a few hotspots.
  function storyline(
    storylineId: Storyline,
    tag: string,
    issue: KnownIssue,
    districts: [string, number][],
    count: number,
    acceleration: number,
    orgShare: number
  ) {
    const hotspots = new Map(
      districts.map(([name]) => {
        const d = district(name)
        const spots = [0, 1].map(() =>
          offset(d.center, random.between(2, 10), random.between(0, 2 * Math.PI))
        )
        return [name, spots]
      })
    )
    for (let i = 0; i < count; i++) {
      const name = random.weighted(districts)
      const d = district(name)
      const spot = random.pick(hotspots.get(name)!)
      const recency = random.next() ** (1 / acceleration)
      plans.push({
        id: `sim-${tag}-${pad(i + 1, 4)}`,
        storyline: storylineId,
        issue,
        district: d,
        location: offset(spot, random.between(0, 5), random.between(0, 2 * Math.PI)),
        hoursAgo: Math.max(0.5, (1 - recency) * DAYS * 24),
        ...reporter(d, orgShare),
      })
    }
  }

  storyline(
    'faw-eastern',
    'faw-eastern',
    'fall_armyworm',
    [
      ['Chipata', 0.45],
      ['Katete', 0.22],
      ['Lundazi', 0.15],
      ['Petauke', 0.1],
      ['Chadiza', 0.08],
    ],
    180,
    2.6,
    0.45
  )
  storyline(
    'tuta-lusaka',
    'tuta-lusaka',
    'tuta_absoluta',
    [
      ['Chongwe', 0.6],
      ['Lusaka', 0.25],
      ['Kafue', 0.15],
    ],
    120,
    2.2,
    0
  )

  // Sparse national background: spread out in space and time, so it forms no clusters.
  const background: [KnownIssue | 'unknown', string[], number][] = [
    ['late_blight', ['Mazabuka', 'Monze', 'Kabwe', 'Chingola'], 30],
    ['early_blight', ['Choma', 'Mkushi', 'Kitwe'], 22],
    ['diamondback_moth', ['Chilanga', 'Ndola', 'Kitwe', 'Kasama'], 28],
    ['cassava_mosaic', ['Mansa', 'Samfya', 'Kawambwa', 'Mongu', 'Solwezi', 'Kasama'], 40],
    ['cassava_brown_streak', ['Nchelenge', 'Mwense', 'Luwingu'], 14],
    ['fall_armyworm', ['Mumbwa', 'Chibombo', 'Choma', 'Mpika', 'Kasempa', 'Kaoma'], 50],
    ['maize_lethal_necrosis', ['Mpika', 'Mazabuka'], 4],
    ['unknown', ['Mkushi', 'Mpongwe', 'Chisamba'], 4],
  ]
  let backgroundIndex = 0
  for (const [issue, names, count] of background) {
    for (let i = 0; i < count; i++) {
      const d = district(random.pick(names))
      plans.push({
        id: `sim-background-${pad(++backgroundIndex, 4)}`,
        storyline: 'background',
        issue,
        district: d,
        location: offset(d.center, random.between(0, 25), random.between(0, 2 * Math.PI)),
        hoursAgo: random.between(1, DAYS * 24),
        ...reporter(d, 0),
      })
    }
  }

  let armed: string[] = []
  if (liveDemo) {
    const d = district(liveDemo.district)
    // Clear the venue: age same-issue reports near it out of the cluster window.
    for (const plan of plans) {
      if (
        plan.issue === liveDemo.issue &&
        plan.hoursAgo < DEMO_CLEAR_HOURS &&
        distanceKm(plan.location, liveDemo.center) <= DEMO_CLEAR_KM
      ) {
        plan.hoursAgo += DEMO_CLEAR_HOURS
      }
    }
    // Then pre-arm four qualifying reports: the presenter's real one is the fifth.
    armed = [1, 2, 3, 4].map(i => `sim-live-demo-${pad(i, 4)}`)
    armed.forEach((id, i) => {
      plans.push({
        id,
        storyline: 'live-demo',
        issue: liveDemo.issue,
        district: d,
        location: offset(liveDemo.center, random.between(0.8, 3.5), (i * Math.PI) / 2 + 0.4),
        hoursAgo: random.between(2, 20),
        ...reporter(d, 0),
        armed: true,
      })
    })
  }

  const observations = plans.map(plan => materialize(plan, anchorMs))
  return {
    anchor: new Date(anchorMs).toISOString(),
    org: { id: DEMO_ORG_ID, data: DEMO_ORG },
    users: [...users].map(([id, profile]) => ({ id, profile: UserProfileSchema.parse(profile) })),
    observations,
    liveDemo: liveDemo ? { ...liveDemo, armed } : null,
  }
}

const iso = (ms: number) => new Date(Math.round(ms / 1000) * 1000).toISOString()

// Its own stream, keyed by the report, so adding photos never moves anything else.
function libraryPhoto(plan: Plan) {
  const photos = SIM_PHOTOS.filter(p => p.issue === plan.issue)
  if (photos.length === 0) return []
  const pick = createRandom(SEED ^ hash(`${plan.id}:photo`)).pick(photos)
  return [simPhotoPath(pick.id)]
}

function materialize(plan: Plan, anchorMs: number): SeedObservation {
  const r: Random = createRandom(SEED ^ hash(plan.id))
  const spec = ISSUES[plan.issue]
  const createdMs = anchorMs - plan.hoursAgo * 3_600_000
  const daysSincePlanting = r.int(25, 90)
  const stage = GROWTH[spec.crop].find(([max]) => daysSincePlanting <= max)![1]

  // What the AI says: mostly right, sometimes unsure or confused (unless pre-armed).
  const outcome = plan.armed
    ? 'correct'
    : plan.issue === 'unknown'
      ? 'unknown'
      : r.weighted([
          ['correct', 0.85],
          ['unknown', 0.08],
          ['confused', 0.07],
        ] as const)
  const suspected: Issue =
    outcome === 'correct' ? plan.issue : outcome === 'unknown' ? 'unknown' : spec.confusedWith
  const confidence =
    Math.round(
      (plan.armed
        ? r.between(0.74, 0.9)
        : outcome === 'unknown'
          ? r.between(0.2, 0.55)
          : r.chance(0.12)
            ? r.between(0.42, 0.59)
            : r.between(0.62, 0.96)) * 100
    ) / 100
  const severityPct = Math.round(r.between(...spec.severity))
  const reason = expertReviewReason({ model_confidence: confidence, suspected_issue: suspected })

  // Officers catch up over time: older reports are more often verified.
  const ageDays = plan.hoursAgo / 24
  const verifyChance = plan.armed ? 0 : Math.min(0.85, 0.1 + ageDays * 0.06) * (reason ? 1 : 0.6)
  const verified = r.chance(verifyChance)
  const state: VerificationState = verified
    ? r.chance(0.7)
      ? 'FIELD_VERIFIED'
      : 'EXPERT_CONFIRMED'
    : reason
      ? 'UNVERIFIED'
      : 'AI_ASSESSED'
  const verifier = state === 'EXPERT_CONFIRMED' ? 'sim-agronomist-01' : 'sim-officer-01'

  const diagnosedMs = createdMs + r.int(6, 15) * 1000
  // Routed rows wait for an officer. The rest are complete with a canned recommendation for the
  // issue as it stands (the officer's, else the AI's), unless the corpus has nothing to cite for
  // it (unknown, maize lethal necrosis), when they wait for an officer too, as live reports do.
  const issue = verified ? plan.issue : suspected
  const routed = reason !== null && !verified
  const recommendationId = `${plan.id}-rec`
  const recommendation =
    routed || issue === 'unknown'
      ? null
      : cannedRecommendation(plan.id, issue, iso(diagnosedMs + 4000))
  const observation = ObservationSchema.parse({
    reporter_id: plan.reporterId,
    reporter_role: plan.reporterRole,
    org_id: plan.orgId,
    created_at: iso(createdMs),
    location: plan.location,
    geohash: geohash(plan.location.latitude, plan.location.longitude),
    district: plan.district.name,
    district_slug: plan.district.slug,
    province: plan.district.province,
    camp: r.chance(0.7) ? campFor(r, plan.district) : null,
    crop: spec.crop,
    planting_date: iso(createdMs - daysSincePlanting * 86_400_000).slice(0, 10),
    growth_stage: stage,
    // A library photo of the issue the report really has (credited on the dashboard as not the
    // farm's own); none where the library has no photo of that issue.
    photo_paths: libraryPhoto(plan),
    farmer_description: r.chance(0.75) ? r.pick(spec.descriptions) : null,
    status: recommendation ? 'complete' : 'awaiting_expert_review',
    diagnosis: {
      suspected_issue: suspected,
      confidence_band: confidenceBand(confidence),
      severity_band: severityBand(severityPct),
      visible_symptoms: spec.symptoms.filter(() => r.chance(0.7)),
      needs_expert_review: reason !== null,
      expert_review_reason: reason,
      ...SIM_STAMP,
      diagnosed_at: iso(diagnosedMs),
    },
    verification_state: state,
    verified_by: verified ? verifier : null,
    // An officer records the real issue, correcting the AI where it was wrong.
    verified_issue: verified ? plan.issue : null,
    recommendation_id: recommendation ? recommendationId : null,
    intervention: null,
    outcome: null,
    sim: true,
  })
  const internal = DiagnosisInternalSchema.parse({
    model_confidence: confidence,
    severity_pct: severityPct,
    reasoning_summary: 'Simulated diagnosis (seed data); no model was called.',
    model_crop: spec.crop,
    model_growth_stage: stage,
    invalid_output: null,
    attempts: 1,
    ...SIM_STAMP,
    created_at: iso(diagnosedMs),
  })
  return {
    id: plan.id,
    storyline: plan.storyline,
    observation,
    internal,
    recommendation: recommendation && { id: recommendationId, data: recommendation },
  }
}

export function clusterPoints(data: Pick<SeedData, 'observations'>): ClusterPoint[] {
  return data.observations.map(({ id, observation }) => ({
    id,
    issue: observation.verified_issue ?? observation.diagnosis?.suspected_issue ?? null,
    location: observation.location,
    created_at: observation.created_at,
    weight: VERIFICATION_WEIGHTS[observation.verification_state],
  }))
}
