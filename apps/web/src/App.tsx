import { useMemo } from 'react'
import { AppShell } from './components/AppShell'
import { useAuth } from './hooks/useAuth'
import { useAlerts, useClusters, useObservations, useRisk } from './hooks/useLive'
import { useRoute } from './hooks/useRoute'
import { KnowledgeSourcesPage } from './pages/KnowledgeSourcesPage'
import { NationalMapPage } from './pages/NationalMapPage'
import { ObservationDetailPage } from './pages/ObservationDetailPage'
import { OfficerQueuePage, queueRows } from './pages/OfficerQueuePage'
import { OutbreakDetailPage } from './pages/OutbreakDetailPage'
import { OutgrowerViewPage } from './pages/OutgrowerViewPage'
import { SignInPage } from './pages/SignInPage'

const VERIFIED = new Set(['FIELD_VERIFIED', 'EXPERT_CONFIRMED'])

// Phytos Command Center. Command Center roles (extension officer, agronomist, admin) see the
// national picture; an outgrower's field officers see their org's Outgrower View only; anyone
// else is asked to sign in as an officer.
export function App() {
  const { officer, ready, signIn, signOut } = useAuth()
  const route = useRoute()
  const cc = officer?.commandCenter ?? false
  const observations = useObservations(cc)
  const clusters = useClusters(cc)
  const risk = useRisk(Boolean(officer))
  const alerts = useAlerts(Boolean(officer))

  const verified = useMemo(
    () => observations.rows?.filter(o => VERIFIED.has(o.verification)).length ?? null,
    [observations.rows]
  )
  const queue = useMemo(
    () => (observations.rows ? queueRows(observations.rows, clusters.rows).length : null),
    [observations.rows, clusters.rows]
  )

  if (!ready) return <p className="p-6 text-label text-fg-2">Starting Phytos…</p>
  if (!officer || officer.role === 'farmer') {
    return <SignInPage signedInAsFarmer={Boolean(officer)} onSignIn={signIn} onSignOut={signOut} />
  }

  // Field officers: their org's Outgrower View and the sources, nothing with farm locations.
  const page = !cc && route.page !== 'sources' ? ({ page: 'outgrower' } as const) : route

  const live = {
    observations: observations.rows,
    clusters: clusters.rows,
    risk: risk.rows,
    alerts: alerts.rows,
  }

  return (
    <AppShell
      active={page.page}
      commandCenter={cc}
      email={officer.email}
      role={officer.role}
      verified={cc ? verified : null}
      queue={cc ? queue : null}
      onSignOut={() => void signOut()}
    >
      {page.page === 'map' && <NationalMapPage {...live} />}
      {page.page === 'outbreak' && <OutbreakDetailPage clusterId={page.id} {...live} />}
      {page.page === 'observation' && (
        <ObservationDetailPage obsId={page.id} officer={officer} {...live} />
      )}
      {page.page === 'queue' && (
        <OfficerQueuePage selectedId={page.id ?? null} officer={officer} {...live} />
      )}
      {page.page === 'outgrower' && <OutgrowerViewPage officer={officer} />}
      {page.page === 'sources' && <KnowledgeSourcesPage />}
    </AppShell>
  )
}
