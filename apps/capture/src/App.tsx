import { lazy, Suspense } from 'react'
import { Notice } from './components/Notice'
import { AppHeader } from './components/AppHeader'
import { useAuth } from './hooks/useAuth'
import { useRoute } from './hooks/useRoute'
import { HomePage } from './pages/HomePage'
import { ReportSentPage } from './pages/ReportSentPage'
import { ResultPage } from './pages/ResultPage'

// The camera, upload and photo code load only when a report is started, keeping the first
// screen light on 4G.
const DiagnosePage = lazy(() =>
  import('./pages/DiagnosePage').then(module => ({ default: module.DiagnosePage }))
)

export function App() {
  const { user, error } = useAuth()
  const { route, navigate } = useRoute()

  if (!user) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-md px-4 pt-8">
          {error ? (
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
              Phytos could not start ({error}). Check your connection.
            </Notice>
          ) : (
            <p className="text-body font-semibold text-ink-2">Starting Phytos…</p>
          )}
        </main>
      </>
    )
  }

  switch (route.page) {
    case 'diagnose':
      return (
        <Suspense fallback={<AppHeader />}>
          <DiagnosePage user={user} navigate={navigate} />
        </Suspense>
      )
    case 'sent':
      return <ReportSentPage obsId={route.obsId} navigate={navigate} />
    case 'report':
      return <ResultPage user={user} obsId={route.obsId} navigate={navigate} />
    default:
      return <HomePage user={user} navigate={navigate} />
  }
}
