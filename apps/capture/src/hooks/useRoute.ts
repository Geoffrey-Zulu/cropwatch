import { useCallback, useEffect, useState } from 'react'

export type Route =
  | { page: 'home' }
  | { page: 'diagnose' }
  | { page: 'sent'; obsId: string }
  | { page: 'report'; obsId: string }

// Hash routes, so the static host serves one page and a refresh or a notification tap lands on
// the right screen.
export function parseRoute(hash: string): Route {
  const [, page, id] = hash.replace(/^#/, '').split('/')
  if (page === 'new') return { page: 'diagnose' }
  if (page === 'sent' && id) return { page: 'sent', obsId: id }
  if (page === 'report' && id) return { page: 'report', obsId: id }
  return { page: 'home' }
}

export const hrefFor = (route: Route) => {
  switch (route.page) {
    case 'home':
      return '#/'
    case 'diagnose':
      return '#/new'
    case 'sent':
      return `#/sent/${route.obsId}`
    case 'report':
      return `#/report/${route.obsId}`
  }
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))

  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((to: Route, { replace = false } = {}) => {
    if (replace) window.location.replace(hrefFor(to))
    else window.location.hash = hrefFor(to)
  }, [])

  return { route, navigate }
}
