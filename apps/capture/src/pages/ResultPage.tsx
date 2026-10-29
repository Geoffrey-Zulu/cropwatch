import type { User } from 'firebase/auth'
import { Camera } from 'lucide-react'
import { CROP_LABELS, type ObservationView } from '@repo/shared'
import { DemoBadge } from '../components/DemoBadge'
import { Notice } from '../components/Notice'
import { AppHeader } from '../components/AppHeader'
import { CaseCard, CaseField } from '../components/CaseCard'
import { StatusTag } from '../components/StatusTag'
import { ActionBar } from '../components/ActionBar'
import { useObservation } from '../hooks/useObservation'
import type { Route } from '../hooks/useRoute'
import { shortDate, waitingText } from '../lib/copy'
import { reportNumber } from '../lib/report'
import { AdviceLadderSection, AdvicePending } from '../sections/AdviceLadderSection'
import { DiagnosisSection } from '../sections/DiagnosisSection'
import { SourcesSection } from '../sections/SourcesSection'

export function ResultPage({
  user,
  obsId,
  navigate,
}: {
  user: User
  obsId: string
  navigate: (route: Route) => void
}) {
  const { view, status, error } = useObservation(user, obsId)

  return (
    <>
      <AppHeader district={view?.district} onBack={() => navigate({ page: 'home' })} />
      <main className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-5">
        {error && !view && (
          <Notice
            action={
              <button
                type="button"
                className="btn-quiet w-full"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            }
          >
            We could not load this report ({error}).
          </Notice>
        )}
        {!view && !error && (
          <p className="text-body font-semibold text-fg-2">Opening your report…</p>
        )}
        {view && <ResultView view={view} liveStatus={status} />}
      </main>
      <ActionBar>
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate({ page: 'diagnose' })}
        >
          <Camera size={22} strokeWidth={2} aria-hidden />
          Report another crop
        </button>
      </ActionBar>
    </>
  )
}

// The progressive result: the slip and its stamp, the diagnosis when it lands, then the advice.
// Pure, so every state can be tested.
export function ResultView({
  view,
  liveStatus,
}: {
  view: ObservationView
  liveStatus?: string | null
}) {
  // The live document can run a moment ahead of the fetched view.
  const status = liveStatus ?? view.status
  return (
    <>
      <DemoBadge rows={[view]} />
      <CaseCard
        emphasis
        eyebrow={`Report ${reportNumber(view.obs_id)}`}
        tag={<StatusTag status={status} />}
      >
        <dl>
          <CaseField label="Crop">{CROP_LABELS[view.crop]}</CaseField>
          <CaseField label="Sent">{shortDate(view.created_at)}</CaseField>
          <CaseField label="Place">{view.district}</CaseField>
          {view.planting_date && (
            <CaseField label="Planted">{shortDate(view.planting_date)}</CaseField>
          )}
        </dl>
      </CaseCard>

      <CaseCard>
        <DiagnosisSection view={view} />
      </CaseCard>

      {view.recommendation ? (
        <>
          <CaseCard eyebrow="What to do">
            <AdviceLadderSection recommendation={view.recommendation} />
          </CaseCard>
          <CaseCard>
            <SourcesSection sources={view.recommendation.sources} />
          </CaseCard>
        </>
      ) : (
        (status === 'diagnosing' || status === 'recommending') && (
          <CaseCard eyebrow="What to do">
            <AdvicePending text={waitingText(status)} />
          </CaseCard>
        )
      )}
    </>
  )
}
