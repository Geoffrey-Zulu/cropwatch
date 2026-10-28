import { Check, ChevronRight } from 'lucide-react'
import { useEffect } from 'react'
import { AppHeader } from '../components/AppHeader'
import { CaseCard } from '../components/CaseCard'
import { ActionBar } from '../components/ActionBar'
import type { Route } from '../hooks/useRoute'
import { reportNumber } from '../lib/report'

// The receipt: the report is in, here is its number. Moves on to the live result by itself.
export function ReportSentPage({
  obsId,
  navigate,
}: {
  obsId: string
  navigate: (route: Route, options?: { replace?: boolean }) => void
}) {
  useEffect(() => {
    const timer = setTimeout(() => navigate({ page: 'report', obsId }, { replace: true }), 2500)
    return () => clearTimeout(timer)
  }, [navigate, obsId])

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 pt-10">
        <CaseCard emphasis eyebrow={`Report ${reportNumber(obsId)}`}>
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span className="inline-flex animate-tag items-center gap-2 rounded-tag border-1.5 border-green bg-green px-3 py-1.5 font-mono text-label font-semibold uppercase tracking-[0.08em] text-white">
              <Check size={18} strokeWidth={2} aria-hidden />
              Sent
            </span>
            <p className="font-display text-display font-semibold text-navy">We have your report</p>
            <p className="text-body text-ink-2">
              We are looking at your photo now. Advice usually comes within a minute.
            </p>
          </div>
        </CaseCard>
      </main>
      <ActionBar>
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate({ page: 'report', obsId }, { replace: true })}
        >
          See the result
          <ChevronRight size={24} strokeWidth={2} aria-hidden />
        </button>
      </ActionBar>
    </>
  )
}
