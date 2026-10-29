// Development only (main.tsx loads it behind import.meta.env.DEV): every Command Center page
// from seed fixtures, for design review and screenshots without an officer sign-in.
// #/preview/<map|alerts|outbreak|observation|queue|outgrower|visit|sources|scenario>; alerts,
// outbreak and observation are drawers over the map, visit a drawer over the Outgrower View.
// Fixtures are generated from the
// seed into ./fixtures.local.json (gitignored).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import type { User } from 'firebase/auth'
import { useState } from 'react'
import type {
  DistrictWeather,
  ObservationEvidence,
  OutgrowerOverview,
  Recommendation,
} from '@repo/shared'
import { AlertsDrawer } from '../components/AlertsDrawer'
import { AppShell } from '../components/AppShell'
import { ObservationDrawerView } from '../components/ObservationDrawer'
import { OutbreakDrawerView } from '../components/OutbreakDrawer'
import type { Officer } from '../hooks/useAuth'
import type { LiveData } from '../hooks/useLive'
import { KnowledgeSourcesPage } from '../pages/KnowledgeSourcesPage'
import { NationalMapPage } from '../pages/NationalMapPage'
import { OfficerQueuePage, queueRows } from '../pages/OfficerQueuePage'
import { OutgrowerViewPage } from '../pages/OutgrowerViewPage'
import { ScenarioPage } from '../pages/ScenarioPage'
import { trpc } from '../lib/trpc'

interface Fixtures {
  live: Required<{ [K in keyof LiveData]: NonNullable<LiveData[K]> }>
  outgrower: OutgrowerOverview
  weather: DistrictWeather
  evidence: ObservationEvidence
  recommendations: Record<string, Recommendation>
  sampleId: string
}

const found = import.meta.glob('./fixtures.local.json', { eager: true, import: 'default' })
const fixtures = Object.values(found)[0] as Fixtures | undefined

const officer: Officer = {
  user: {} as User,
  email: 'agronomist@phytos-demo.test',
  role: 'agronomist',
  orgId: null,
  commandCenter: true,
}

// tRPC answered from the fixtures: the batch link's fetch never leaves the browser.
function mockFetch(data: Fixtures): typeof fetch {
  const answers: Record<string, unknown> = {
    'outgrower.overview': data.outgrower,
    'weather.district': data.weather,
    'evidence.observation': data.evidence,
  }
  return async input => {
    const url = new URL(String(input instanceof Request ? input.url : input))
    const paths = url.pathname.replace(/^\/trpc\//, '').split(',')
    return new Response(
      JSON.stringify(paths.map(path => ({ result: { data: answers[path] ?? null } }))),
      { headers: { 'content-type': 'application/json' } }
    )
  }
}

export function Preview({ route }: { route: string }) {
  const [clients] = useState(() => {
    if (!fixtures) return null
    const queryClient = new QueryClient()
    const client = trpc.createClient({
      links: [httpBatchLink({ url: 'http://preview.local/trpc', fetch: mockFetch(fixtures) })],
    })
    return { queryClient, client }
  })
  if (!fixtures || !clients)
    return (
      <p className="p-6">
        No fixtures: generate apps/web/src/dev/fixtures.local.json from the seed first.
      </p>
    )

  const { live } = fixtures
  const page = route.split('?')[0].split('/')[0] || 'map'
  // The visit drawer is a hash query (useRoute): open it on the first visit in the fixtures.
  const firstVisit = fixtures.outgrower.officers[0]?.visits[0]?.report_number
  if (page === 'visit' && firstVisit && !window.location.hash.includes('?visit='))
    window.history.replaceState(null, '', `#/preview/visit?visit=${firstVisit}`)
  const cluster = live.clusters.find(c => c.districtSlug === 'chongwe') ?? live.clusters[0] ?? null
  const sample = live.observations.find(o => o.id === fixtures.sampleId)!
  const overMap = ['map', 'alerts', 'outbreak', 'observation'].includes(page)
  const active = overMap ? 'map' : page === 'visit' ? 'outgrower' : (page as 'map')
  const verified = live.observations.filter(o =>
    ['FIELD_VERIFIED', 'EXPERT_CONFIRMED'].includes(o.verification)
  ).length

  return (
    <trpc.Provider client={clients.client} queryClient={clients.queryClient}>
      <QueryClientProvider client={clients.queryClient}>
        <AppShell
          active={active}
          commandCenter
          email={officer.email}
          role={officer.role}
          verified={verified}
          queue={queueRows(live.observations, live.clusters).length}
          newAlerts={live.alerts.length}
          onSignOut={() => undefined}
        >
          {overMap && <NationalMapPage {...live} />}
          {page === 'alerts' && <AlertsDrawer alerts={live.alerts} />}
          {page === 'outbreak' && cluster && (
            <OutbreakDrawerView
              cluster={cluster}
              alert={live.alerts.find(a => a.clusterId === cluster.id) ?? null}
              risk={live.risk.find(r => r.districtSlug === cluster.districtSlug) ?? null}
              observations={live.observations}
            />
          )}
          {page === 'observation' && (
            <ObservationDrawerView
              observation={sample}
              recommendation={
                sample.recommendationId ? fixtures.recommendations[sample.recommendationId] : null
              }
              cluster={live.clusters.find(c => c.members.includes(sample.id)) ?? null}
              officer={officer}
            />
          )}
          {page === 'queue' && <OfficerQueuePage selectedId={null} officer={officer} {...live} />}
          {(page === 'outgrower' || page === 'visit') && <OutgrowerViewPage officer={officer} />}
          {page === 'sources' && <KnowledgeSourcesPage />}
          {page === 'scenario' && <ScenarioPage observations={live.observations} />}
        </AppShell>
      </QueryClientProvider>
    </trpc.Provider>
  )
}
