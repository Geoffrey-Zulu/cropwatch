// Development only (main.tsx loads it behind import.meta.env.DEV): every screen state from
// fixtures, for design review and screenshots without Firebase. #/preview/<state>.
import type { User } from 'firebase/auth'
import { OFFICER_REFERRAL, type ObservationView } from '@repo/shared'
import { AppHeader } from '../components/AppHeader'
import { ActionBar } from '../components/ActionBar'
import { DiagnosePage } from '../pages/DiagnosePage'
import { ReportSentPage } from '../pages/ReportSentPage'
import { ResultView } from '../pages/ResultPage'
import { AlertBoardsSection } from '../sections/AlertBoardsSection'
import { MyReportsSection } from '../sections/MyReportsSection'
import type { AreaAlert } from '../hooks/useAreaAlerts'

const view: ObservationView = {
  obs_id: 'k3J9xQ2mW8pL5vR1tY7u',
  created_at: '2026-10-23T09:00:00.000Z',
  crop: 'tomato',
  district: 'Chongwe',
  district_slug: 'chongwe',
  province: 'Lusaka',
  camp: null,
  planting_date: '2026-09-02',
  growth_stage: 'flowering',
  photo_paths: [],
  farmer_description: null,
  status: 'complete',
  verification_state: 'AI_ASSESSED',
  verified_issue: null,
  diagnosis: {
    suspected_issue: 'late_blight',
    suspected_issue_label: 'Late blight',
    confidence_band: 'high',
    severity_band: 'moderate',
    visible_symptoms: ['Dark, greasy patches on older leaves', 'White growth under the leaves'],
    needs_expert_review: false,
    expert_review_reason: null,
    diagnosed_at: '2026-10-23T09:00:05.000Z',
  },
  recommendation: {
    ipm_steps: [
      'Check plants twice a week in the dry season and every day in the rains, for dark greyish patches on leaves and brown-black areas on stems.',
      'Pull out and bury plants that show early symptoms, about 1 m deep.',
      'Water at the base or by drip, not over the leaves, and space plants 60 cm apart so air can move.',
      'Rotate with maize next season; avoid fields that last grew potato or eggplant.',
      OFFICER_REFERRAL,
    ],
    chemical_options: [],
    officer_referral: true,
    sources: [
      { title: 'Late blight on tomato, Zambia (PMDG)', tier: 5, uri: 'https://example.org/pmdg' },
      { title: 'ZARI crop production guide, tomato', tier: 2, uri: 'https://example.org/zari' },
    ],
  },
  intervention: null,
  outcome: null,
  sim: false,
}

const alerts: AreaAlert[] = [
  {
    id: 'a1',
    type: 'cluster',
    issue: 'tuta_absoluta',
    district: 'Chongwe',
    district_slug: 'chongwe',
    geo_center: { latitude: -15.33, longitude: 28.68 },
    radius_km: 10,
    level: 'HIGH',
    contributing_factors: [
      'Cluster of 8 Tuta absoluta (tomato leafminer) reports within 10 km (3 new in 24 h)',
      '22 reports this week (+175% on last week)',
    ],
    observation_ids: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    channels_sent: ['fcm', 'sms'],
    created_at: '2026-10-22T15:00:00.000Z',
    sim: true,
    alert_class: 'verified_cluster',
    verified_reports: 2,
  },
  {
    id: 'a2',
    type: 'cluster',
    issue: 'tuta_absoluta',
    district: 'Chongwe',
    district_slug: 'chongwe',
    geo_center: { latitude: -15.4, longitude: 28.5 },
    radius_km: 10,
    level: 'ELEVATED',
    contributing_factors: [
      'Cluster of 5 Tuta absoluta (tomato leafminer) reports within 10 km (5 new in 24 h)',
    ],
    observation_ids: ['a', 'b', 'c', 'd', 'e'],
    channels_sent: ['fcm', 'sms'],
    created_at: '2026-10-22T09:00:00.000Z',
    sim: true,
    alert_class: 'model_risk_signal',
    verified_reports: 0,
  },
  {
    id: 'a3',
    type: 'risk_change',
    issue: 'tuta_absoluta',
    district: 'Chongwe',
    district_slug: 'chongwe',
    geo_center: { latitude: -15.33, longitude: 28.68 },
    radius_km: 25,
    level: 'ELEVATED',
    contributing_factors: [
      'Weather (Open-Meteo): 1 mm of rain in the last 14 days, late dry season. icipe advises against growing tomato then.',
    ],
    observation_ids: [],
    channels_sent: [],
    created_at: '2026-10-21T06:00:00.000Z',
    sim: true,
    alert_class: 'weather_advisory',
  },
]

const reports = [
  {
    id: 'k3J9xQ2mW8pL5vR1tY7u',
    crop: 'tomato' as const,
    district: 'Chongwe',
    districtSlug: 'chongwe',
    status: 'complete',
    createdAt: '2026-10-23T09:00:00.000Z',
    issue: 'late_blight' as const,
    band: 'high' as const,
    sim: false,
  },
  {
    id: 'Zq81mW8pL5vR1tY7uk3J9',
    crop: 'maize' as const,
    district: 'Chongwe',
    districtSlug: 'chongwe',
    status: 'awaiting_expert_review',
    createdAt: '2026-10-20T11:30:00.000Z',
    issue: 'unknown' as const,
    band: 'low' as const,
    sim: false,
  },
]

const fakeUser = { uid: 'preview', getIdToken: async () => 'preview' } as unknown as User
const noop = () => {}

export function Preview({ state }: { state: string }) {
  switch (state) {
    case 'diagnose':
      return <DiagnosePage user={fakeUser} navigate={noop} />
    case 'sent':
      return <ReportSentPage obsId={view.obs_id} navigate={noop} />
    case 'assessing':
      return (
        <Frame>
          <ResultView
            view={{ ...view, status: 'diagnosing', diagnosis: null, recommendation: null }}
          />
        </Frame>
      )
    case 'recommending':
      return (
        <Frame>
          <ResultView view={{ ...view, status: 'recommending', recommendation: null }} />
        </Frame>
      )
    case 'officer':
      return (
        <Frame>
          <ResultView
            view={{
              ...view,
              status: 'awaiting_expert_review',
              recommendation: null,
              diagnosis: {
                ...view.diagnosis!,
                suspected_issue: 'unknown',
                confidence_band: 'low',
                needs_expert_review: true,
                expert_review_reason: 'unknown_issue',
              },
            }}
          />
        </Frame>
      )
    case 'result':
      return (
        <Frame>
          <ResultView view={view} />
        </Frame>
      )
    default:
      return (
        <>
          <AppHeader district="Chongwe" />
          <main className="mx-auto flex max-w-md flex-col gap-8 px-4 pt-6">
            <div>
              <p className="eyebrow">Crop health · Zambia</p>
              <h1 className="font-display text-display font-semibold text-navy">
                Photograph a sick crop. Get advice from Zambian guides.
              </h1>
            </div>
            <AlertBoardsSection district="Chongwe" alerts={alerts} push="off" onEnablePush={noop} />
            <MyReportsSection reports={reports} />
          </main>
          <ActionBar>
            <button type="button" className="btn-primary">
              Report a sick crop
            </button>
          </ActionBar>
        </>
      )
  }
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader district="Chongwe" onBack={noop} />
      <main className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-5">{children}</main>
      <ActionBar>
        <button type="button" className="btn-primary">
          Report another crop
        </button>
      </ActionBar>
    </>
  )
}
