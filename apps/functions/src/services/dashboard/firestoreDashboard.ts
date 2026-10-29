import type { Firestore } from 'firebase-admin/firestore'
import {
  findDistrict,
  ISSUE_LABELS,
  WEATHER_SOURCE,
  weatherConditions,
  type DiagnosisInternal,
  type DistrictWeather,
  type Issue,
  type KnowledgeIndex,
  type Observation,
  type OutgrowerOverview,
  type Recommendation,
  type RiskLevel,
  type SeverityBand,
  type Visit,
  type VisitReason,
} from '@repo/shared'
import { fromFirestore } from '../../lib/firestoreData'
import type { FetchWeather } from '../weather/openMeteo'
import type { DashboardServices } from './types'

const DAY = 86_400_000
const WINDOW_DAYS = 14

// "sim-farmer-chipata-012" → "Farm CHI-012"; a live reporter's uid → "Farm 7F3K".
export function farmLabel(reporterId: string) {
  const sim = /^sim-farmer-([a-z-]+)-(\d+)$/.exec(reporterId)
  if (sim) return `Farm ${sim[1].replace(/-/g, '').slice(0, 3).toUpperCase()}-${sim[2]}`
  return `Farm ${reporterId.slice(0, 4).toUpperCase()}`
}

// "sim-officer-01" → "Field officer 01".
export const officerLabel = (uid: string) =>
  /^sim-officer-(\d+)$/.exec(uid)?.[1]
    ? `Field officer ${uid.slice(-2)}`
    : `Field officer ${uid.slice(0, 4).toUpperCase()}`

const reportNumber = (obsId: string) => obsId.replace(/^sim-/, '').slice(0, 4).toUpperCase()

// observations/{id}/internal/recommendation as the recommender writes it.
interface InternalRecommendation {
  outcome?: string
  rejected_products?: { candidate: string; reason: string }[]
  trace?: {
    query?: string
    retrieved?: number
    excerpts?: { ref: string; document_id: string; tier: number }[]
    dropped?: { text: string; reason: string }[]
    model_id?: string
    prompt_version?: string
  } | null
}

export interface OrgObservation {
  id: string
  reporterId: string
  reporterRole: string
  camp: string | null
  district: string
  districtSlug: string
  crop: string
  status: string
  verification: string
  issue: Issue | null
  severity: SeverityBand | null
  createdAt: string
  sim: boolean
}

export function firestoreDashboard({
  db,
  index,
  weather,
  now = () => Date.now(),
}: {
  db: Firestore
  index: () => Promise<KnowledgeIndex>
  weather: FetchWeather
  now?: () => number
}): DashboardServices {
  return {
    async evidence(obsId) {
      const ref = db.collection('observations').doc(obsId)
      const [obsSnap, diagSnap, recSnap] = await Promise.all([
        ref.get(),
        ref.collection('internal').doc('diagnosis').get(),
        ref.collection('internal').doc('recommendation').get(),
      ])
      if (!obsSnap.exists) return null
      const obs = fromFirestore(obsSnap.data()) as Observation
      const diagnosis = obs.diagnosis
      const internalDiagnosis = diagSnap.exists
        ? (fromFirestore(diagSnap.data()) as Partial<DiagnosisInternal>)
        : null
      const internalRec = recSnap.exists
        ? (fromFirestore(recSnap.data()) as InternalRecommendation)
        : null
      const recommendation = obs.recommendation_id
        ? ((fromFirestore(
            (await db.collection('recommendations').doc(obs.recommendation_id).get()).data()
          ) as Recommendation | undefined) ?? null)
        : null

      const trace = internalRec?.trace
      const documents = new Map<string, { title: string; source_url: string }>()
      if (trace) {
        try {
          for (const d of (await index()).documents) documents.set(d.id, d)
        } catch {
          // Titles fall back to document ids.
        }
      }

      // Only bands, ids and versions leave here: never model_confidence (invariant 3).
      return {
        obs_id: obsId,
        status: obs.status,
        verification_state: obs.verification_state,
        verified_issue: obs.verified_issue ?? null,
        diagnosis: diagnosis
          ? {
              suspected_issue: diagnosis.suspected_issue,
              confidence_band: diagnosis.confidence_band,
              needs_expert_review: diagnosis.needs_expert_review,
              expert_review_reason: diagnosis.expert_review_reason ?? null,
              model_id: diagnosis.model_id,
              prompt_version: diagnosis.prompt_version,
              attempts: internalDiagnosis?.attempts ?? null,
            }
          : null,
        retrieval: trace
          ? {
              query: String(trace.query ?? ''),
              retrieved: Number(trace.retrieved ?? 0),
              excerpts: (trace.excerpts ?? []).map(e => ({
                ref: String(e.ref),
                document_id: String(e.document_id),
                title: documents.get(e.document_id)?.title ?? String(e.document_id),
                tier: Number(e.tier),
                source_url: documents.get(e.document_id)?.source_url ?? null,
              })),
              dropped: (trace.dropped ?? []).map(d => ({
                text: String(d.text),
                reason: String(d.reason),
              })),
              model_id: trace.model_id ?? null,
              prompt_version: trace.prompt_version ?? null,
            }
          : null,
        regulatory:
          internalRec || recommendation
            ? {
                outcome:
                  internalRec?.outcome === 'recommendation' || recommendation
                    ? 'recommendation'
                    : 'referral',
                passed: (recommendation?.chemical_options ?? []).map(c => ({
                  registration_no: c.registration_no,
                  trade_name: c.trade_name,
                  active_ingredient: c.active_ingredient,
                  label_dose: c.label_dose,
                  source: c.source ?? null,
                })),
                rejected: (
                  internalRec?.rejected_products ??
                  recommendation?.regulatory_check?.rejected_products ??
                  []
                ).map(r =>
                  typeof r === 'string'
                    ? { candidate: r, reason: 'not_registered' }
                    : { candidate: String(r.candidate), reason: String(r.reason) }
                ),
                sources: (recommendation?.rag_sources ?? []).map(s => ({
                  title: s.title,
                  tier: s.tier,
                  uri: s.uri,
                })),
              }
            : null,
        sim: obs.sim === true,
      }
    },

    async outgrower(orgId) {
      const orgSnap = await db.collection('orgs').doc(orgId).get()
      if (!orgSnap.exists) return null
      const org = orgSnap.data() as { name: string; enrolled_farmer_count: number; sim: boolean }
      const at = now()
      const since = at - WINDOW_DAYS * DAY

      const [userSnap, obsSnap, clusterSnap] = await Promise.all([
        db.collection('users').where('org_id', '==', orgId).get(),
        db.collection('observations').where('org_id', '==', orgId).get(),
        db.collection('clusters').where('active', '==', true).get(),
      ])
      const officers = userSnap.docs
        .filter(d => d.get('role') === 'field_officer')
        .map(d => ({ id: d.id, district: String(d.get('district')) }))
        .sort((a, b) => a.id.localeCompare(b.id))
      const clustered = new Set(clusterSnap.docs.flatMap(d => d.get('members') as string[]))

      // Only these fields are read: the location never is.
      const reports: OrgObservation[] = obsSnap.docs
        .map(d => {
          const o = fromFirestore(d.data()) as Observation
          return {
            id: d.id,
            reporterId: String(o.reporter_id),
            reporterRole: String(o.reporter_role),
            camp: o.camp ?? null,
            district: String(o.district),
            districtSlug: String(o.district_slug),
            crop: String(o.crop),
            status: String(o.status),
            verification: String(o.verification_state),
            issue: (o.verified_issue ?? o.diagnosis?.suspected_issue ?? null) as Issue | null,
            severity: (o.diagnosis?.severity_band ?? null) as SeverityBand | null,
            createdAt: String(o.created_at),
            sim: o.sim === true,
          }
        })
        .filter(r => Date.parse(r.createdAt) > since && Date.parse(r.createdAt) <= at)

      const districts = [...new Set(reports.map(r => r.districtSlug))]
      const levels = new Map<string, RiskLevel>()
      await Promise.all(
        districts.map(async slug => {
          const level = (await db.collection('risk').doc(slug).get()).get('level')
          if (level) levels.set(slug, level as RiskLevel)
        })
      )

      return outgrowerOverview({ orgId, org, officers, reports, clustered, levels, now: at })
    },

    async weather(districtSlug) {
      const place = findDistrict(districtSlug)
      if (!place) return null
      const window = await weather(place.center)
      return {
        district: place.name,
        district_slug: place.slug,
        ...window,
        conditions: weatherConditions(window).map(c => ({
          issue: c.issue,
          favourable: c.favourable,
          observed: c.observed,
          guide: c.note.guide,
          document_title: c.note.document_title,
          threshold: c.note.threshold,
        })),
        source: { ...WEATHER_SOURCE },
      } satisfies DistrictWeather
    },
  }
}

// The Outgrower View from an org's recent reports (pure, so the rules are testable): camp
// aggregates, the issue rising fastest, and one visit per farm, ordered and split across the
// field officers by district (camps alternate where a district has two). Built only from camp
// and district fields: no coordinate goes in, so none can come out (invariant 6).
export function outgrowerOverview({
  orgId,
  org,
  officers,
  reports: all,
  clustered,
  levels,
  now: at,
}: {
  orgId: string
  org: { name: string; enrolled_farmer_count: number; sim: boolean }
  officers: { id: string; district: string }[]
  reports: OrgObservation[]
  clustered: Set<string>
  levels: Map<string, RiskLevel>
  now: number
}): OutgrowerOverview {
  const since = at - WINDOW_DAYS * DAY
  const reports = all.filter(r => Date.parse(r.createdAt) > since && Date.parse(r.createdAt) <= at)
  // The issue rising fastest, week on week.
  const counts = new Map<Issue, { thisWeek: number; lastWeek: number }>()
  for (const r of reports) {
    if (!r.issue || r.issue === 'unknown') continue
    const c = counts.get(r.issue) ?? { thisWeek: 0, lastWeek: 0 }
    if (Date.parse(r.createdAt) > at - 7 * DAY) c.thisWeek++
    else c.lastWeek++
    counts.set(r.issue, c)
  }
  const [top] = [...counts]
    .filter(([, c]) => c.thisWeek >= 3)
    .sort((a, b) => b[1].thisWeek - b[1].lastWeek - (a[1].thisWeek - a[1].lastWeek))

  const campOf = (r: OrgObservation) => r.camp ?? `${r.district} (camp not recorded)`
  const camps = new Map<string, OrgObservation[]>()
  for (const r of reports) camps.set(campOf(r), [...(camps.get(campOf(r)) ?? []), r])

  // One visit per farm: its latest report, and every reason to go.
  const latest = new Map<string, OrgObservation>()
  for (const r of [...reports].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const farm = r.reporterRole === 'farmer' ? r.reporterId : `${r.reporterId}:${r.id}`
    latest.set(farm, r)
  }
  const visits: (Visit & { officerKey: string })[] = []
  for (const [farm, r] of latest) {
    const reasons: string[] = []
    const codes: VisitReason[] = []
    const because = (code: VisitReason, sentence: string) => {
      codes.push(code)
      reasons.push(sentence)
    }
    const issueName = r.issue && r.issue !== 'unknown' ? ISSUE_LABELS[r.issue] : null
    const inCluster = clustered.has(r.id)
    if (inCluster) because('cluster', `In an active ${issueName ?? 'crop problem'} cluster`)
    if (r.severity === 'severe') because('severe', 'Severe damage reported')
    else if (r.severity === 'moderate') because('moderate', 'Moderate damage reported')
    if (r.status === 'awaiting_expert_review')
      because('awaiting_review', 'Waiting for an officer review')
    if (levels.get(r.districtSlug) === 'HIGH')
      because('high_district', `${r.district} risk is HIGH`)
    if (reasons.length === 0) continue
    const priority: 1 | 2 | 3 =
      inCluster && (r.severity === 'severe' || levels.get(r.districtSlug) === 'HIGH')
        ? 1
        : inCluster || r.severity === 'severe' || r.status === 'awaiting_expert_review'
          ? 2
          : 3
    visits.push({
      report_number: reportNumber(r.id),
      farm_label: r.reporterRole === 'farmer' ? farmLabel(farm) : 'Officer field report',
      camp: campOf(r),
      district: r.district,
      crop: r.crop as Visit['crop'],
      issue: r.issue,
      issue_label: issueName ?? 'Not identified yet',
      severity_band: r.severity,
      last_report_at: r.createdAt,
      priority,
      reasons,
      reason_codes: codes,
      sim: r.sim,
      officerKey: `${r.districtSlug}|${campOf(r)}`,
    })
  }
  visits.sort((a, b) => a.priority - b.priority || b.last_report_at.localeCompare(a.last_report_at))

  // Officers cover their district; where a district has two, its camps alternate between them.
  const byDistrict = new Map<string, typeof officers>()
  for (const o of officers) {
    const slug = findDistrict(o.district)?.slug ?? o.district
    byDistrict.set(slug, [...(byDistrict.get(slug) ?? []), o])
  }
  const campsByDistrict = new Map<string, string[]>()
  for (const v of visits) {
    const [slug, camp] = v.officerKey.split('|')
    const list = campsByDistrict.get(slug) ?? []
    if (!list.includes(camp)) list.push(camp)
    campsByDistrict.set(slug, list)
  }
  for (const list of campsByDistrict.values()) list.sort()
  const assigned = new Map<string, Visit[]>(officers.map(o => [o.id, []]))
  const unassigned: Visit[] = []
  for (const { officerKey, ...visit } of visits) {
    const [slug, camp] = officerKey.split('|')
    const team = byDistrict.get(slug)
    if (!team?.length) {
      unassigned.push(visit)
      continue
    }
    const officer = team[campsByDistrict.get(slug)!.indexOf(camp) % team.length]
    assigned.get(officer.id)!.push(visit)
  }

  return {
    org_id: orgId,
    name: org.name,
    enrolled_farmers: org.enrolled_farmer_count,
    sim: org.sim,
    window_days: WINDOW_DAYS,
    reports: reports.length,
    verified_reports: reports.filter(r =>
      ['FIELD_VERIFIED', 'EXPERT_CONFIRMED'].includes(r.verification)
    ).length,
    top_issue: top
      ? {
          issue: top[0],
          issue_label: ISSUE_LABELS[top[0]],
          this_week: top[1].thisWeek,
          last_week: top[1].lastWeek,
        }
      : null,
    camps: [...camps]
      .map(([camp, rows]) => {
        const issues = new Map<string, number>()
        for (const r of rows)
          if (r.issue && r.issue !== 'unknown') issues.set(r.issue, (issues.get(r.issue) ?? 0) + 1)
        const [topIssue] = [...issues].sort((a, b) => b[1] - a[1])
        const damaged = rows.filter(
          r => r.severity === 'moderate' || r.severity === 'severe'
        ).length
        const inCluster = rows.filter(r => clustered.has(r.id)).length
        const awaiting = rows.filter(r => r.status === 'awaiting_expert_review').length
        const level = levels.get(rows[0].districtSlug) ?? null
        return {
          camp,
          district: rows[0].district,
          district_slug: rows[0].districtSlug,
          reports: rows.length,
          top_issue_label: topIssue ? ISSUE_LABELS[topIssue[0] as Issue] : null,
          damaged,
          in_cluster: inCluster,
          awaiting_review: awaiting,
          district_level: level,
          // Something in the camp itself: a district at High alone flags every camp in it.
          attention: inCluster > 0 || awaiting > 0 || damaged >= 3,
        }
      })
      .sort(
        (a, b) =>
          Number(b.attention) - Number(a.attention) ||
          b.in_cluster - a.in_cluster ||
          b.reports - a.reports
      ),
    officers: officers.map(o => ({
      officer_id: o.id,
      label: officerLabel(o.id),
      district: o.district,
      visits: assigned.get(o.id)!,
    })),
    unassigned,
  } satisfies OutgrowerOverview
}
