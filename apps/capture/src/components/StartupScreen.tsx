import { CircleAlert, Leaf, RefreshCw } from 'lucide-react'
import { AppHeader } from './AppHeader'

export function StartupScreen({
  error,
  onRetry,
}: {
  error: string | null
  onRetry: () => void
}) {
  const failed = error !== null

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-md flex-col justify-center px-4 pb-24 pt-8">
        <section
          className={`startup-panel ${failed ? 'startup-panel--error' : ''}`}
          aria-busy={!failed}
          aria-labelledby="startup-title"
        >
          <div className="startup-mark" aria-hidden>
            {failed ? <CircleAlert size={32} strokeWidth={1.8} /> : <Leaf size={34} strokeWidth={1.8} />}
          </div>
          <p className="eyebrow">Field care for Zambia</p>
          <h1 id="startup-title" className="mt-2 font-display text-display font-bold text-fg">
            {failed ? 'Let’s get you back to your field' : 'Getting Phytos ready'}
          </h1>
          <p className="mt-3 text-body text-fg-2">
            {failed
              ? 'Phytos could not finish signing in. Try again to reconnect to your reports.'
              : 'Connecting to your reports and preparing your field workspace.'}
          </p>

          {failed ? (
            <div className="mt-6 flex flex-col gap-3">
              <button type="button" className="btn-primary" onClick={onRetry}>
                <RefreshCw size={20} strokeWidth={2} aria-hidden />
                Try again
              </button>
              <p className="text-center text-label text-fg-2">
                Retrying will not remove your saved reports.
              </p>
              <details className="startup-details">
                <summary>Technical details</summary>
                <code className="mt-2 block break-words font-mono text-label">{error}</code>
              </details>
            </div>
          ) : (
            <div className="startup-connection" role="status" aria-live="polite">
              <div className="flex items-center gap-3">
                <span className="loading-pulse" aria-hidden />
                <span className="text-label font-semibold text-fg">Connecting to your reports</span>
              </div>
              <span className="loading-track mt-4" aria-hidden>
                <span />
              </span>
              <p className="mt-3 text-label text-fg-2">
                This usually takes a few seconds. Keep Phytos open while we connect.
              </p>
            </div>
          )}
        </section>
      </main>
    </>
  )
}
