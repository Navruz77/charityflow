import { useEffect, useState } from 'react'

// Loads public/prices.json. If it fails, the caller can fall back to a
// custom price the user types in themselves.
export function usePrices() {
  const [prices, setPrices] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`${import.meta.env.BASE_URL}prices.json`)
      .then((res) => {
        if (!res.ok) throw new Error('Price file not found')
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        if (!(Number(data.goldUsdPerGram) > 0) || !(Number(data.silverUsdPerGram) > 0)) {
          throw new Error('Price file is missing valid prices')
        }
        setPrices(data)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message || 'Could not load prices')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { prices, error, loading }
}
