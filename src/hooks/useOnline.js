import { useEffect, useState } from 'react'

// True while the browser says it has a network connection. Browsers can
// say "online" on a network with no internet, so callers still handle a
// failed request (api() returns status 0); this only drives the banner and
// the "needs a connection" messages.
export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false))

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return online
}
