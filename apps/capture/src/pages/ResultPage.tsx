import type { User } from 'firebase/auth'
import { Camera } from 'lucide-react'
import { CROP_LABELS, type ObservationView } from '@repo/shared'
import { DemoBadge } from '../components/DemoBadge'
import { Notice } from '../components/Notice'
import { SignboardHeader } from '../components/SignboardHeader'
import { Slip, SlipField } from '../components/Slip'
import { Stamp } from '../components/Stamp'
import { ThumbBar } from '../components/ThumbBar'
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
      <SignboardHeader district={view?.district} onBack={() => navigate({ page: 'home' })} />
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
          <p className="text-body font-semibold text-ink-2">Opening your report…</p>
        )}
        {view && <ResultView view={view} liveStatus={status} />}
      </main>
      <ThumbBar>
        <button type="button" className="btn-sign" onClick={() => navigate({ page: 'diagnose' })}>
          <Camera size={22} strokeWidth={2.5} aria-hidden />
          Report another crop
        </button>
      </ThumbBar>
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
      <Slip
        raised
        eyebrow={`Report ${reportNumber(view.obs_id)}`}
        stamp={<Stamp status={status} />}
      >
        <dl>
          <SlipField label="Crop">{CROP_LABELS[view.crop]}</SlipField>
          <SlipField label="Sent">{shortDate(view.created_at)}</SlipField>
          <SlipField label="Place">{view.district}</SlipField>
          {view.planting_date && (
            <SlipField label="Planted">{shortDate(view.planting_date)}</SlipField>
          )}
        </dl>
      </Slip>

      <Slip>
        <DiagnosisSection view={view} />
      </Slip>

      {view.recommendation ? (
        <>
          <Slip eyebrow="What to do">
            <AdviceLadderSection recommendation={view.recommendation} />
          </Slip>
          <Slip>
            <SourcesSection sources={view.recommendation.sources} />
          </Slip>
        </>
      ) : (
        (status === 'diagnosing' || status === 'recommending') && (
          <Slip eyebrow="What to do">
            <AdvicePending text={waitingText(status)} />
          </Slip>
        )
      )}
    </>
  )
}
