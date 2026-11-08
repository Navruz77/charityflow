import { useEffect, useState } from 'react'

// Minimal hash-based route reader. The site only has a few routes, so this
// avoids adding a router dependency. A hash like "#/confirm?type=email" is
// split into the route ("/confirm") and its query (read with hashParams()).
function readHash() {
  const hash = window.location.hash.replace(/^#/, '')
  return hash.split('?')[0] || '/'
}

// The ?a=b part after the route, e.g. the token in an email link.
export function hashParams() {
  const hash = window.location.hash
  const q = hash.indexOf('?')
  return new URLSearchParams(q === -1 ? '' : hash.slice(q + 1))
}

export function useHashRoute() {
  const [route, setRoute] = useState(readHash)

  useEffect(() => {
    const onHashChange = () => setRoute(readHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = (path) => {
    window.location.hash = path
  }

  return [route, navigate]
}
