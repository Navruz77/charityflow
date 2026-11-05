import { useEffect, useState } from 'react'

// Minimal hash-based route reader. The site only has a couple of routes,
// so this avoids adding a router dependency.
function readHash() {
  return window.location.hash.replace(/^#/, '') || '/'
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
