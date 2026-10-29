import { useEffect, useState } from 'react'

export type Route =
  | { page: 'map' }
  | { page: 'outbreak'; id: string }
  | { page: 'observation'; id: string }
  | { page: 'queue'; id?: string }
  | { page: 'outgrower' }
  | { page: 'sources' }

// Hash routes: the static host serves one page, and a refresh lands on the same screen.
export function parseRoute(hash: string): Route {
  const [, page, id] = hash.replace(/^#/, '').split('/')
  if (page === 'outbreaks' && id) return { page: 'outbreak', id }
  if (page === 'observations' && id) return { page: 'observation', id }
  if (page === 'queue') return id ? { page: 'queue', id } : { page: 'queue' }
  if (page === 'outgrower') return { page: 'outgrower' }
  if (page === 'sources') return { page: 'sources' }
  return { page: 'map' }
}

export function hrefFor(route: Route) {
  switch (route.page) {
    case 'map':
      return '#/'
    case 'outbreak':
      return `#/outbreaks/${route.id}`
    case 'observation':
      return `#/observations/${route.id}`
    case 'queue':
      return route.id ? `#/queue/${route.id}` : '#/queue'
    case 'outgrower':
      return '#/outgrower'
    case 'sources':
      return '#/sources'
  }
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
