import { FlaskConical, LoaderCircle } from 'lucide-react'
import type { Portfolio, SeasonPhase } from '@repo/shared'
import { seasonDate, useSeasonRefresh } from '../../lib/season'
import { trpc } from '../../lib/trpc'

// Demo controls (plan §3): drive the storyline from the dashboard alone, without a second device.
// Folded away under a quiet pill pinned at the bottom right, so what a control changes happens in
// view; it opens upward. Command Center accounts on a simulated season only (the API
// refuses anything else). Nothing here bypasses a rule: a ground check is the field officer's,
// a new season day is the season calendar, and money still needs the code and a second person.
export function DemoControls({ portfolio: p }: { portfolio: Portfolio }) {
  const refresh = useSeasonRefresh()
  const done = { onSuccess: () => void refresh() }
  const ground = trpc.season.demo.groundCheck.useMutation(done)
  const phase = trpc.season.demo.setPhase.useMutation(done)
  const busy = ground.isPending || phase.isPending
  const go = (to: SeasonPhase) => phase.mutate({ orgId: p.org_id, phase: to })
  const error = ground.error ?? phase.error

  return (
    <details className="group fixed bottom-4 right-4 z-30">
      <summary
        className="inline-flex cursor-pointer list-none items-center gap-2 rounded-pill py-1.5 pl-3 pr-4 text-caption font-bold tracking-[0.06em] text-fg shadow-[var(--raise-sm),inset_0_0_0_1.5px_rgb(27_41_32/0.45)] [&::-webkit-details-marker]:hidden"
        style={{ background: 'var(--hatch), #FFFFFF' }}
      >
        <FlaskConical size={15} aria-hidden />
        DEMO CONTROLS
      </summary>
      <div className="island absolute bottom-full right-0 mb-2 flex w-[min(34rem,calc(100vw-2rem))] flex-col gap-3 px-5 py-4">
        <p className="text-caption text-fg-2">
          Season day {seasonDate(p.today)}. Simulated season only; every rule still applies.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-quiet"
            disabled={busy}
            onClick={() => ground.mutate({ orgId: p.org_id })}
          >
            The field officer&apos;s ground check lands
          </button>
          <button
            type="button"
            className="btn-quiet"
            disabled={busy || p.phase === 'march'}
            onClick={() => go('march')}
          >
            Go to March: drought rule
          </button>
          <button
            type="button"
            className="btn-quiet"
            disabled={busy || p.phase === 'june'}
            onClick={() => go('june')}
          >
            Go to June: harvest
          </button>
          <button
            type="button"
            className="btn-quiet"
            disabled={busy || p.phase === 'january'}
            onClick={() => go('january')}
          >
            Back to January
          </button>
          {busy && <LoaderCircle size={18} aria-hidden className="animate-spin self-center" />}
        </div>
        {ground.data && (
          <p className="text-caption text-fg-2">
            {ground.data.live
              ? 'The live photo on the field was verified by the field officer.'
              : 'The field officer’s ground check is on the record.'}
          </p>
        )}
        {error && <p className="text-caption text-high-text">{error.message}</p>}
      </div>
    </details>
  )
}
