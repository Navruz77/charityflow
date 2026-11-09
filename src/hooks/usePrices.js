import { useEffect, useState } from 'react'
import { loadGuestData, saveGuestData } from '../lib/storage.js'

const STORAGE_KEY = 'cf.v1.prices' // Appendix B.3

function isValidPriceResponse(data) {
  return (
    data &&
    typeof data === 'object' &&
    Number(data.goldUsdPerGram) > 0 &&
    Number(data.silverUsdPerGram) > 0 &&
    typeof data.fetchedAt === 'string'
  )
}

// Calls our own server's GET /api/prices — the browser never talks to a
// price API directly. On success, keeps a copy in localStorage so a later
// offline session has something to show. On failure, falls back to that
// copy if one exists. Offline, the service worker also answers with the
// last /api/prices response it saw (vite.config.js).
export function usePrices() {
  const [prices, setPrices] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stale, setStale] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetch('/api/prices')
        .then(async (res) => {
          if (res.status === 503) {
            const body = await res.json().catch(() => ({}))
            throw new Error(body.message || 'No price has ever been retrieved.')
          }
          if (!res.ok) throw new Error(`Price request failed with ${res.status}`)
          return res.json()
        })
        .then((data) => {
          if (cancelled) return
          if (!isValidPriceResponse(data)) throw new Error('Price response was missing valid prices')
          saveGuestData(STORAGE_KEY, data, isValidPriceResponse)
          setPrices(data)
          setError(null)
          setStale(Date.now() - new Date(data.fetchedAt).getTime() > 24 * 60 * 60 * 1000)
          setLoading(false)
        })
        .catch((err) => {
          if (cancelled) return
          const cachedCopy = loadGuestData(STORAGE_KEY, isValidPriceResponse)
          if (cachedCopy) {
            setPrices(cachedCopy)
            // Old only if it really is over 24 hours old (S12.3); offline
            // with this morning's prices is still fine to use.
            setStale(Date.now() - new Date(cachedCopy.fetchedAt).getTime() > 24 * 60 * 60 * 1000)
            setError(err.message || 'Could not reach the price service; showing the last known prices.')
          } else {
            setError(err.message || 'Could not load prices')
          }
          setLoading(false)
        })

    load()
    // Back online: fetch again so the next calculation uses newer prices (S5.3).
    window.addEventListener('online', load)
    return () => {
      cancelled = true
      window.removeEventListener('online', load)
    }
  }, [])

  return { prices, error, loading, stale }
}
