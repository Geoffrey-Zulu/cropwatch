import { AppShell } from './components/AppShell'
import { AppSkeleton } from './components/Skeleton'
import { useAuth } from './hooks/useAuth'
import { useRoute } from './hooks/useRoute'
import { orgIdFor, OutgrowerViewPage, SeasonGear, SeasonNav } from './pages/OutgrowerViewPage'
import { SignInPage } from './pages/SignInPage'

// Phytos: one season for an outgrower agribusiness, on three screens (Fields map, Season ledger,
// Reconciliation). Sign-in lands on the Fields map. The farmer's side is its own app (farmer.html). Command Center roles stand in for
// the credit team on the simulated org; an agribusiness's own credit team and field officers see
// their org; anyone else is asked to sign in as an officer.
export function App() {
  const { officer, ready, signIn, signOut } = useAuth()
  const route = useRoute()

  if (!ready) return <AppSkeleton />
  if (!officer || officer.role === 'farmer') {
    return <SignInPage signedInAsFarmer={Boolean(officer)} onSignIn={signIn} onSignOut={signOut} />
  }

  const orgId = orgIdFor(officer)
  return (
    <AppShell
      email={officer.email}
      role={officer.role}
      onSignOut={() => void signOut()}
      nav={orgId ? <SeasonNav current={route.tab} /> : undefined}
      actions={
        orgId ? <SeasonGear orgId={orgId} commandCenter={officer.commandCenter} /> : undefined
      }
      bleed={route.tab === 'fields'}
    >
      <OutgrowerViewPage officer={officer} />
    </AppShell>
  )
}
