import { useEffect, useState } from 'react'

// The agribusiness's three screens, the Outgrower View's tabs (CLAUDE.md, 1 Nov). A field card
// opens as a query on the hash, so the screen underneath keeps its place and the back button
// closes it.
//   #/ or #/outgrower/fields          the Fields map (sign-in lands here)
//   #/outgrower/season?contract=<id>  the Season ledger with a field card open
//   #/outgrower/reconciliation
// Any other link (the retired surfaces live at tag pre-ceih-only) lands on the Fields map.
export type Drawer = { kind: 'contract'; id: string }

export const OUTGROWER_TABS = ['fields', 'season', 'reconciliation'] as const
export type OutgrowerTab = (typeof OUTGROWER_TABS)[number]

export type Route = { page: 'outgrower'; tab: OutgrowerTab; drawer?: Drawer }

// Hash routes: the static host serves one page, and a refresh lands on the same screen.
export function parseRoute(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?')
  const [, page, id] = path.split('/')
  const tab = (page === 'outgrower' && OUTGROWER_TABS.find(t => t === id)) || 'fields'
  const contract = new URLSearchParams(query).get('contract')
  return contract
    ? { page: 'outgrower', tab, drawer: { kind: 'contract', id: contract } }
    : { page: 'outgrower', tab }
}

export function hrefFor(route: Route) {
  const path = `#/outgrower/${route.tab}`
  return route.drawer ? `${path}?contract=${encodeURIComponent(route.drawer.id)}` : path
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

// Links that open a field card over the current screen, or close it.
export function useDrawerLinks() {
  const route = useRoute()
  return {
    route,
    open: (drawer: Drawer) => hrefFor({ ...route, drawer }),
    close: () => hrefFor({ ...route, drawer: undefined }),
  }
}
