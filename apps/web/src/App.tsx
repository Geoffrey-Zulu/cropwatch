import { AppShell } from './components/AppShell'
import { AppSkeleton } from './components/Skeleton'
import { useAuth } from './hooks/useAuth'
import { useRoute } from './hooks/useRoute'
import { OutgrowerViewPage } from './pages/OutgrowerViewPage'
import { SignInPage } from './pages/SignInPage'

// Phytos: one season for an outgrower agribusiness, on four screens (Fields map, Season ledger,
// Approvals, Reconciliation). Sign-in lands on the Fields map. Command Center roles stand in for
// the credit team on the simulated org; an agribusiness's own credit team and field officers see
// their org; anyone else is asked to sign in as an officer.
export function App() {
  const { officer, ready, signIn, signOut } = useAuth()
  const route = useRoute()

  if (!ready) return <AppSkeleton />
  if (!officer || officer.role === 'farmer') {
    return <SignInPage signedInAsFarmer={Boolean(officer)} onSignIn={signIn} onSignOut={signOut} />
  }

  return (
    <AppShell
      email={officer.email}
      role={officer.role}
      onSignOut={() => void signOut()}
      bleed={route.tab === 'fields'}
    >
      <OutgrowerViewPage officer={officer} />
    </AppShell>
  )
}
