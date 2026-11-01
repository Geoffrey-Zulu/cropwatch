// Development only (main.tsx loads it behind import.meta.env.DEV): the four screens from seed
// fixtures, for design review and screenshots without an officer sign-in.
// #/preview/<fields|season|approvals|reconciliation>[?june]. Fixtures are generated from the
// seed into ./fixtures.local.json (gitignored): pnpm --filter @repo/seed exec tsx ceih-fixtures.ts
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import type { User } from 'firebase/auth'
import { useState } from 'react'
import type {
  Approval,
  FieldCard,
  FieldsMap,
  Portfolio,
  Reconciliation,
  SmsLogView,
  Statement,
} from '@repo/shared'
import { AppShell } from '../components/AppShell'
import type { Officer } from '../hooks/useAuth'
import { OutgrowerViewPage } from '../pages/OutgrowerViewPage'
import { trpc } from '../lib/trpc'

interface Fixtures {
  // CEIH (tools/seed/ceih-fixtures.ts): the season in January (beat 5) and June (beat 8).
  season?: { january: SeasonFixture; june: SeasonFixture; hero: string }
}

interface SeasonFixture {
  portfolio: Portfolio
  fields: FieldsMap
  approvals: Approval[]
  smsLog: SmsLogView[]
  reconciliation: Reconciliation
  fieldCards: Record<string, FieldCard>
  statements: Record<string, Statement>
}

const SEASON_PAGES = ['fields', 'season', 'approvals', 'reconciliation'] as const

const found = import.meta.glob('./fixtures.local.json', { eager: true, import: 'default' })
const fixtures = Object.values(found)[0] as Fixtures | undefined

const officer: Officer = {
  user: {} as User,
  email: 'agronomist@phytos.test',
  role: 'agronomist',
  orgId: null,
  commandCenter: true,
}

// tRPC answered from the fixtures: the batch link's fetch never leaves the browser.
function mockFetch(data: Fixtures, page: string, june: boolean): typeof fetch {
  const state = june ? data.season?.june : data.season?.january
  const hero = data.season?.hero ?? ''
  const answers: Record<string, (input: { contractId?: string } | undefined) => unknown> = {
    'season.portfolio': () => state?.portfolio,
    'season.fields': () => state?.fields,
    'season.approvals': () => state?.approvals,
    'season.smsLog': () => state?.smsLog,
    'season.reconciliation': () => state?.reconciliation,
    'season.fieldCard': i => state?.fieldCards[i?.contractId ?? hero] ?? state?.fieldCards[hero],
    'season.statement': i => state?.statements[i?.contractId ?? hero] ?? state?.statements[hero],
  }
  return async input => {
    const url = new URL(String(input instanceof Request ? input.url : input))
    const paths = url.pathname.replace(/^\/trpc\//, '').split(',')
    const inputs = JSON.parse(url.searchParams.get('input') ?? '{}') as Record<
      string,
      { contractId?: string }
    >
    return new Response(
      JSON.stringify(
        paths.map((path, i) => ({ result: { data: answers[path]?.(inputs[i]) ?? null } }))
      ),
      { headers: { 'content-type': 'application/json' } }
    )
  }
}

export function Preview({ route }: { route: string }) {
  const page = route.split('?')[0].split('/')[0] || 'fields'
  const [clients] = useState(() => {
    if (!fixtures) return null
    const queryClient = new QueryClient()
    const client = trpc.createClient({
      links: [
        httpBatchLink({
          url: 'http://preview.local/trpc',
          // June: reconciliation, or any season tab with ?june (the Fields map after the drought rule).
          fetch: mockFetch(fixtures, page, page === 'reconciliation' || route.includes('?june')),
        }),
      ],
    })
    return { queryClient, client }
  })
  if (!fixtures?.season || !clients)
    return (
      <p className="p-6">
        No fixtures: pnpm --filter @repo/seed exec tsx ceih-fixtures.ts writes
        apps/web/src/dev/fixtures.local.json.
      </p>
    )

  const tab = SEASON_PAGES.find(p => p === page) ?? 'fields'
  // The season ledger opens on Given's field card.
  if (tab === 'season' && !window.location.hash.includes('?contract='))
    window.history.replaceState(null, '', `#/preview/season?contract=${fixtures.season.hero}`)

  return (
    <trpc.Provider client={clients.client} queryClient={clients.queryClient}>
      <QueryClientProvider client={clients.queryClient}>
        <AppShell
          email={officer.email}
          role={officer.role}
          onSignOut={() => undefined}
          bleed={tab === 'fields'}
        >
          <OutgrowerViewPage officer={officer} tab={tab} />
        </AppShell>
      </QueryClientProvider>
    </trpc.Provider>
  )
}
