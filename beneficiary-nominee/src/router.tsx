import { useEffect, useState } from 'react'

export interface RouteState {
  path: string
  query: URLSearchParams
}

function readRoute(): RouteState {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  const [path, search = ''] = raw.split('?')
  return {
    path: path || '/',
    query: new URLSearchParams(search),
  }
}

export function useRoute(): RouteState {
  const [route, setRoute] = useState<RouteState>(readRoute)

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return route
}

export function navigate(to: string) {
  if (window.location.hash === `#${to}`) {
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    return
  }
  window.location.hash = to
}
