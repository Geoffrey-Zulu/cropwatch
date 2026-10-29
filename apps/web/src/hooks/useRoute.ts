import { useEffect, useState } from 'react'

// Detail opens in a drawer over the page you are on (patterns-v2.md): the drawer is a query on
// the hash, so the page underneath keeps its context and the back button closes it.
//   #/                 national map          #/queue/<id>      queue with a report selected
//   #/?outbreak=<id>   map + outbreak drawer  #/queue?observation=<id>
//   #/?alerts          map + alerts drawer    #/outgrower?visit=<report number>
export type Drawer =
  | { kind: 'outbreak'; id: string }
  | { kind: 'observation'; id: string }
  | { kind: 'visit'; id: string }
  | { kind: 'alerts' }

export type Route = (
  | { page: 'map' }
  | { page: 'queue'; id?: string }
  | { page: 'outgrower' }
  | { page: 'sources' }
  | { page: 'scenario' }
) & { drawer?: Drawer }

const DRAWERS = ['outbreak', 'observation', 'visit'] as const

function parseDrawer(query: string): Drawer | undefined {
  const params = new URLSearchParams(query)
  if (params.has('alerts')) return { kind: 'alerts' }
  for (const kind of DRAWERS) {
    const id = params.get(kind)
    if (id) return { kind, id }
  }
  return undefined
}

// Hash routes: the static host serves one page, and a refresh lands on the same screen.
export function parseRoute(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?')
  const [, page, id] = path.split('/')
  const drawer = parseDrawer(query)
  const withDrawer = <R extends Route>(route: R): R => (drawer ? { ...route, drawer } : route)
  // Links from before 30 Oct: the detail pages are drawers over the map now.
  if (page === 'outbreaks' && id) return { page: 'map', drawer: { kind: 'outbreak', id } }
  if (page === 'observations' && id) return { page: 'map', drawer: { kind: 'observation', id } }
  if (page === 'queue') return withDrawer(id ? { page: 'queue', id } : { page: 'queue' })
  if (page === 'outgrower') return withDrawer({ page: 'outgrower' })
  if (page === 'sources') return withDrawer({ page: 'sources' })
  if (page === 'scenario') return withDrawer({ page: 'scenario' })
  return withDrawer({ page: 'map' })
}

function pathFor(route: Route) {
  switch (route.page) {
    case 'map':
      return '#/'
    case 'queue':
      return route.id ? `#/queue/${route.id}` : '#/queue'
    case 'outgrower':
      return '#/outgrower'
    case 'sources':
      return '#/sources'
    case 'scenario':
      return '#/scenario'
  }
}

export function hrefFor(route: Route) {
  const { drawer } = route
  if (!drawer) return pathFor(route)
  const query =
    drawer.kind === 'alerts' ? 'alerts' : `${drawer.kind}=${encodeURIComponent(drawer.id)}`
  return `${pathFor(route)}?${query}`
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

// Links that open a drawer over the current page, or close it.
export function useDrawerLinks() {
  const route = useRoute()
  return {
    route,
    open: (drawer: Drawer) => hrefFor({ ...route, drawer }),
    close: () => hrefFor({ ...route, drawer: undefined }),
  }
}
