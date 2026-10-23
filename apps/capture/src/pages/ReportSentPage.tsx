import { ChevronRight } from 'lucide-react'
import { useEffect } from 'react'
import { SignboardHeader } from '../components/SignboardHeader'
import { Slip } from '../components/Slip'
import { ThumbBar } from '../components/ThumbBar'
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
      <SignboardHeader />
      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 pt-10">
        <Slip raised eyebrow={`Report ${reportNumber(obsId)}`}>
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span className="inline-flex -rotate-3 animate-stamp rounded-stamp border-[3px] border-leaf px-4 py-2 font-stencil text-[44px] font-extrabold uppercase leading-none text-leaf">
              Sent
            </span>
            <p className="text-title font-extrabold">We have your report</p>
            <p className="text-body text-ink-2">
              We are looking at your photo now. Advice usually comes within a minute.
            </p>
          </div>
        </Slip>
      </main>
      <ThumbBar>
        <button
          type="button"
          className="btn-sign"
          onClick={() => navigate({ page: 'report', obsId }, { replace: true })}
        >
          See the result
          <ChevronRight size={24} strokeWidth={2.5} aria-hidden />
        </button>
      </ThumbBar>
    </>
  )
}
