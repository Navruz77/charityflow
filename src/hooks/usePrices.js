import { useEffect, useState } from 'react'
import { isStale, loadStoredPrices, requestPrices } from '../lib/prices.js'

// Prices for the calculator. Asks our server (src/lib/prices.js); if that
// fails, uses the last copy stored on this device. Offline, the service
// worker also answers with the last /api/prices response it saw
// (vite.config.js).
export function usePrices() {
  const [state, setState] = useState({ prices: null, error: null, loading: true, stale: false })

  useEffect(() => {
    let cancelled = false
    const load = () =>
      requestPrices()
        .then((prices) => {
          if (!cancelled) setState({ prices, error: null, loading: false, stale: isStale(prices) })
        })
        .catch((err) => {
          if (cancelled) return
          const stored = loadStoredPrices()
          // Old only if it really is over 24 hours old (S12.3); offline with
          // this morning's prices is still fine to use.
          if (stored) setState({ prices: stored, error: err.message, loading: false, stale: isStale(stored) })
          else setState({ prices: null, error: err.message, loading: false, stale: false })
        })

    load()
    // Back online: fetch again so the next calculation uses newer prices (S5.3).
    window.addEventListener('online', load)
    return () => {
      cancelled = true
      window.removeEventListener('online', load)
    }
  }, [])

  return state
}
