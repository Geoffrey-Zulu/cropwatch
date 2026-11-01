import { lazy, Suspense } from 'react'
import { AppHeader } from './components/AppHeader'
import { useAuth } from './hooks/useAuth'
import { useRoute } from './hooks/useRoute'
import { LoadingState } from './components/LoadingState'
import { StartupScreen } from './components/StartupScreen'
import { HomePage } from './pages/HomePage'
import { ReportSentPage } from './pages/ReportSentPage'
import { ResultPage } from './pages/ResultPage'
import { CeihPage } from './pages/CeihPage'

// The camera, upload and photo code load only when a report is started, keeping the first
// screen light on 4G.
const DiagnosePage = lazy(() =>
  import('./pages/DiagnosePage').then(module => ({ default: module.DiagnosePage }))
)

export function App() {
  const { user, error } = useAuth()
  const { route, navigate } = useRoute()

  if (!user) {
    return <StartupScreen error={error} onRetry={() => window.location.reload()} />
  }

  switch (route.page) {
    case 'ceih':
      return <CeihPage key={user.uid} uid={user.uid} step={route.step} navigate={navigate} />
    case 'diagnose':
      return (
        <Suspense
          fallback={
            <>
              <AppHeader />
              <main className="mx-auto max-w-md px-4 pt-6">
                <LoadingState
                  title="Opening your camera"
                  detail="Preparing the photo tools for your report."
                />
              </main>
            </>
          }
        >
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
