import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

// Registers the service worker (vite.config.js) and, when a new version of
// CharityFlow has been downloaded, shows a banner. Nothing reloads until
// the person taps "Reload", so nothing they are typing is ever lost. If they
// ignore it, the new version starts the next time every CharityFlow tab
// (or the Home Screen app) has been closed.
const CHECK_EVERY_MS = 60 * 60 * 1000 // look for a new version hourly while open

export default function UpdateBanner() {
  const [ready, setReady] = useState(false)
  const [hidden, setHidden] = useState(false)
  const update = useRef(null)

  useEffect(() => {
    let timer
    let registration
    // Ask the server whether a newer version exists. Skipped offline.
    const check = () => {
      if (registration && navigator.onLine !== false) registration.update().catch(() => {})
    }
    // A Home Screen app on iPhone is often resumed, not reopened, so also
    // check whenever the app comes back to the screen.
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }

    update.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        setReady(true)
        setHidden(false)
      },
      onRegisteredSW(_url, reg) {
        registration = reg
        timer = setInterval(check, CHECK_EVERY_MS)
      },
    })
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', check)
    }
  }, [])

  if (!ready || hidden) return null
  return (
    <div className="update-banner" role="status">
      <p>
        <strong>A new version of CharityFlow is ready.</strong> Your saved calculations and settings are kept.
      </p>
      <div className="btn-row">
        <button type="button" className="btn btn-primary" onClick={() => update.current?.(true)}>
          Reload
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setHidden(true)}>
          Not now
        </button>
      </div>
    </div>
  )
}
