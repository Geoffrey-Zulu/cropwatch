import { useMemo } from 'react'
import { AlertsDrawer } from './components/AlertsDrawer'
import { AppShell } from './components/AppShell'
import { ObservationDrawer } from './components/ObservationDrawer'
import { OutbreakDrawer } from './components/OutbreakDrawer'
import { AppSkeleton } from './components/Skeleton'
import { useAuth } from './hooks/useAuth'
import { useAlerts, useClusters, useObservations, useRisk } from './hooks/useLive'
import { useRoute, type Route } from './hooks/useRoute'
import { useSeenAlerts } from './hooks/useSeenAlerts'
import { SCENARIO_ENABLED } from './lib/features'
import { KnowledgeSourcesPage } from './pages/KnowledgeSourcesPage'
import { NationalMapPage } from './pages/NationalMapPage'
import { OfficerQueuePage, queueRows } from './pages/OfficerQueuePage'
import { OutgrowerViewPage } from './pages/OutgrowerViewPage'
import { ScenarioPage } from './pages/ScenarioPage'
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
  // The bell counts High and Elevated alerts this browser has not opened (patterns-v2.md).
  const seen = useSeenAlerts()
  const newAlerts = useMemo(
    () => alerts.rows?.filter(a => a.level !== 'LOW' && !seen.has(a.id)).length ?? null,
    [alerts.rows, seen]
  )
  const queue = useMemo(
    () => (observations.rows ? queueRows(observations.rows, clusters.rows).length : null),
    [observations.rows, clusters.rows]
  )

  if (!ready) return <AppSkeleton />
  if (!officer || officer.role === 'farmer') {
    return <SignInPage signedInAsFarmer={Boolean(officer)} onSignIn={signIn} onSignOut={signOut} />
  }

  // Field officers: their org's Outgrower View and the sources, nothing with farm locations.
  // Field officers keep only the visit drawer, which carries no precise location.
  const page: Route =
    !cc && route.page !== 'sources'
      ? {
          page: 'outgrower',
          ...(route.drawer?.kind === 'visit' ? { drawer: route.drawer } : {}),
        }
      : route

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
      newAlerts={cc ? (newAlerts ?? 0) : null}
      onSignOut={() => void signOut()}
    >
      {page.page === 'map' && <NationalMapPage {...live} />}
      {page.page === 'queue' && (
        <OfficerQueuePage selectedId={page.id ?? null} officer={officer} {...live} />
      )}
      {page.page === 'outgrower' && <OutgrowerViewPage officer={officer} />}
      {page.page === 'sources' && <KnowledgeSourcesPage />}
      {page.page === 'scenario' &&
        (SCENARIO_ENABLED ? (
          <ScenarioPage observations={live.observations} />
        ) : (
          <NationalMapPage {...live} />
        ))}

      {/* Drawers open over the page (patterns-v2.md). Outbreak and observation detail carry
          precise locations, so only Command Center roles get them (CLAUDE.md invariant 6). */}
      {cc && page.drawer?.kind === 'alerts' && <AlertsDrawer alerts={live.alerts} />}
      {cc && page.drawer?.kind === 'outbreak' && (
        <OutbreakDrawer clusterId={page.drawer.id} observations={live.observations} />
      )}
      {cc && page.drawer?.kind === 'observation' && (
        <ObservationDrawer obsId={page.drawer.id} officer={officer} clusters={live.clusters} />
      )}
    </AppShell>
  )
}
