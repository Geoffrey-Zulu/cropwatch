// The content for the static National Map mockups (docs/mockups, 30 Oct), read from the live
// system so the mockups show the real seeded data: the four figures, districts to watch with
// their factors, the latest alerts with their class and how sure they are, active clusters,
// the last 14 days of reports and the district outlines, projected to the map's 960 x 720 frame
// as the dashboard does. The Outgrower summary comes from the live API as an officer sees it.
// Read only.
//
//   PHYTOS_RECORD_EMAIL=… PHYTOS_RECORD_PASSWORD=… pnpm --filter @repo/admin-tools mockup-data --out <file.json>
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ALERT_CLASS_LABELS,
  alertUncertainty,
  ISSUE_LABELS,
  RISK_ORDER,
  type AlertClass,
  type Issue,
  type RiskLevel,
} from '@repo/shared'
import { listDocuments } from '@repo/tools-gcp'
import { compactFactors, ISSUE_SHORT } from '../../apps/web/src/lib/copy'

const args = process.argv.slice(2)
const out = resolve(process.env.INIT_CWD ?? process.cwd(), args[args.indexOf('--out') + 1])
const DAY = 86_400_000
const now = Date.now()
const WIDTH = 960
const HEIGHT = 720

type Doc = Record<string, unknown>
const docs = async (collection: string) =>
  (await listDocuments(collection)).map(({ path, data }) => ({
    id: path.split('/').pop()!,
    ...(data as Doc),
  })) as (Doc & { id: string })[]

const [observations, clusters, risk, alerts] = await Promise.all([
  docs('observations'),
  docs('clusters'),
  docs('risk'),
  docs('alerts'),
])
const issueOf = (o: Doc) =>
  (o.verified_issue ?? (o.diagnosis as Doc | null)?.suspected_issue ?? null) as Issue | null
const ms = (v: unknown) => Date.parse(String(v))

// Mercator fitted to the country, as the dashboard's map does (16 px all round, 56 px foot).
const geo = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '../../apps/web/public/geo/zambia-districts.json'),
    'utf8'
  )
) as {
  features: {
    properties: { slug: string; name: string; province: string }
    geometry: { coordinates: number[][][][] }
  }[]
}
const merc = ([lon, lat]: number[]) => [
  (lon * Math.PI) / 180,
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
]
const all = geo.features.flatMap(f => f.geometry.coordinates.flat(2))
const xs = all.map(p => merc(p as number[])[0])
const ys = all.map(p => merc(p as number[])[1])
const [minX, maxX, minY, maxY] = [
  Math.min(...xs),
  Math.max(...xs),
  Math.min(...ys),
  Math.max(...ys),
]
const scale = Math.min((WIDTH - 32) / (maxX - minX), (HEIGHT - 72) / (maxY - minY))
const offX = 16 + (WIDTH - 32 - (maxX - minX) * scale) / 2
const offY = 16 + (HEIGHT - 72 - (maxY - minY) * scale) / 2
const project = (lon: number, lat: number) => {
  const [x, y] = merc([lon, lat])
  return [+(offX + (x - minX) * scale).toFixed(1), +(offY + (maxY - y) * scale).toFixed(1)]
}

const levels = new Map(risk.map(r => [r.id, r.level as RiskLevel]))
const districts = geo.features.map(f => ({
  slug: f.properties.slug,
  name: f.properties.name,
  province: f.properties.province,
  level: levels.get(f.properties.slug) ?? 'LOW',
  d: f.geometry.coordinates
    .map(poly =>
      poly
        .map(ring => `M${ring.map(([lon, lat]) => project(lon, lat).join(',')).join('L')}Z`)
        .join('')
    )
    .join(''),
}))

const recent = observations.filter(o => ms(o.created_at) > now - 14 * DAY)
const thisWeek = recent.filter(o => ms(o.created_at) > now - 7 * DAY).length
const active = clusters.filter(c => c.active === true)
const awaiting = recent.filter(o => o.status === 'awaiting_expert_review')
const verified = observations.filter(o =>
  ['FIELD_VERIFIED', 'EXPERT_CONFIRMED'].includes(String(o.verification_state))
).length
const watch = risk
  .filter(r => r.level !== 'LOW')
  .sort(
    (a, b) =>
      RISK_ORDER.indexOf(b.level as RiskLevel) - RISK_ORDER.indexOf(a.level as RiskLevel) ||
      String(a.district).localeCompare(String(b.district))
  )

// The Outgrower summary, as the dashboard gets it: sign in as an officer, then tRPC.
const key = 'AIzaSyB6brxOl9sgWsf7X059B1rZvLiWXCPDTqU'
const signIn = (await (
  await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${key}`, {
    method: 'POST',
    body: JSON.stringify({
      email: process.env.PHYTOS_RECORD_EMAIL,
      password: process.env.PHYTOS_RECORD_PASSWORD,
      returnSecureToken: true,
    }),
  })
).json()) as { idToken?: string }
const input = encodeURIComponent(JSON.stringify({ 0: { orgId: 'demo-outgrower' } }))
const overview = signIn.idToken
  ? (
      (await (
        await fetch(
          `https://cropwatch-api-7d3oc7ppba-ew.a.run.app/trpc/outgrower.overview?batch=1&input=${input}`,
          { headers: { authorization: `Bearer ${signIn.idToken}` } }
        )
      ).json()) as { result: { data: unknown } }[]
    )[0]?.result.data
  : null

const content = {
  generated_at: new Date(now).toISOString(),
  frame: { width: WIDTH, height: HEIGHT },
  header: {
    verified_observations: verified,
    queue: awaiting.length,
    new_alerts: alerts.filter(a => a.level !== 'LOW' && ms(a.created_at) > now - DAY).length,
  },
  stats: {
    reports_this_week: thisWeek,
    reports_last_week: recent.length - thisWeek,
    active_clusters: active.length,
    clusters_new_this_week: active.filter(c => ms(c.first_detected_at) > now - 7 * DAY).length,
    districts_high: risk.filter(r => r.level === 'HIGH').length,
    districts_elevated: risk.filter(r => r.level === 'ELEVATED').length,
    waiting_for_officer: awaiting.length,
    waiting_new_this_week: awaiting.filter(o => ms(o.created_at) > now - 7 * DAY).length,
  },
  // Reports per day for the last 14 days (oldest first), all issues and by issue, for charts.
  daily: (() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const end = now - (13 - i) * DAY
      const inDay = recent.filter(o => ms(o.created_at) > end - DAY && ms(o.created_at) <= end)
      const by = (issue: string) => inDay.filter(o => issueOf(o) === issue).length
      return {
        date: new Date(end).toISOString().slice(0, 10),
        all: inDay.length,
        fall_armyworm: by('fall_armyworm'),
        tuta_absoluta: by('tuta_absoluta'),
        other: inDay.length - by('fall_armyworm') - by('tuta_absoluta'),
        verified: inDay.filter(o =>
          ['FIELD_VERIFIED', 'EXPERT_CONFIRMED'].includes(String(o.verification_state))
        ).length,
      }
    })
    return days
  })(),
  districts_to_watch: watch.map(r => ({
    district: r.district,
    slug: r.id,
    level: r.level,
    compact: compactFactors(r.contributing_factors as string[]),
    factors: r.contributing_factors,
    computed_at: r.computed_at,
  })),
  alerts: alerts
    .sort((a, b) => ms(b.created_at) - ms(a.created_at))
    .slice(0, 12)
    .map(a => {
      const cls = (a.alert_class ??
        (a.verified_reports ? 'verified_cluster' : 'model_risk_signal')) as AlertClass
      const ids = (a.observation_ids as string[]) ?? []
      return {
        issue: ISSUE_LABELS[a.issue as Issue],
        district: a.district,
        level: a.level,
        class: ALERT_CLASS_LABELS[cls],
        how_sure: alertUncertainty(cls, {
          verified: Number(a.verified_reports ?? 0),
          reports: ids.length,
        }),
        first_factor: (a.contributing_factors as string[])?.[0] ?? null,
        created_at: a.created_at,
        sim: a.sim,
      }
    }),
  clusters: active.map(c => {
    const center = c.center as { latitude: number; longitude: number }
    const [x, y] = project(center.longitude, center.latitude)
    return {
      issue: ISSUE_LABELS[c.issue as Issue],
      issue_short: ISSUE_SHORT[c.issue as Issue],
      district: c.district,
      size: c.size,
      new_last_24h: c.new_last_24h,
      verified: c.verified_members,
      x,
      y,
      sim: c.sim,
    }
  }),
  reports: recent.map(o => {
    const loc = o.location as { latitude: number; longitude: number }
    const [x, y] = project(loc.longitude, loc.latitude)
    return { x, y, issue: issueOf(o), sim: o.sim, district: o.district, status: o.status }
  }),
  districts,
  outgrower: overview,
}
writeFileSync(out, JSON.stringify(content))
console.log(
  `${districts.length} districts, ${content.reports.length} reports, ${content.clusters.length} clusters, ${content.districts_to_watch.length} to watch, outgrower ${overview ? 'ok' : 'missing'} → ${out}`
)
