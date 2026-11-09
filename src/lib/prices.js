// Gets gold and silver prices from our own server's GET /api/prices (the
// browser never talks to a price API directly) and keeps the last good
// copy in localStorage (`cf.v1.prices`, B.3) for offline use.
//
// The app calls requestPrices() as soon as it opens, on any page, so one
// online visit is enough to work offline later, even if the person never
// opened the calculator while online. On iPhone a Home Screen app can keep
// its own storage, separate from Safari, so it does the same on its first
// online launch.
import { loadGuestData, saveGuestData } from './storage.js'

export const PRICES_KEY = 'cf.v1.prices'
const DAY_MS = 24 * 60 * 60 * 1000

// Shown when the request never reached the server and nothing is stored.
// Never shows the browser's or the service worker's own error text.
export const NO_CONNECTION_NO_PRICES =
  'You are offline and this device has not stored gold and silver prices yet. Open CharityFlow once while online, then it will work offline.'

export function isValidPriceResponse(data) {
  return (
    data !== null &&
    typeof data === 'object' &&
    Number(data.goldUsdPerGram) > 0 &&
    Number(data.silverUsdPerGram) > 0 &&
    typeof data.fetchedAt === 'string' &&
    !Number.isNaN(Date.parse(data.fetchedAt))
  )
}

// S12.3: older than 24 hours.
export function isStale(prices, now = Date.now()) {
  return now - Date.parse(prices.fetchedAt) > DAY_MS
}

export function loadStoredPrices() {
  return loadGuestData(PRICES_KEY, isValidPriceResponse)
}

// One request at a time: callers that ask while one is running share it.
let inFlight = null

// Resolves to valid prices (and stores them), or rejects with an Error
// whose message is safe to show. `offline` on the error is true when the
// server could not be reached at all.
export function requestPrices() {
  if (!inFlight) inFlight = fetchPrices().finally(() => (inFlight = null))
  return inFlight
}

async function fetchPrices() {
  let res
  try {
    res = await fetch('/api/prices')
  } catch {
    // Offline (or the service worker had no stored copy to answer with).
    const err = new Error(NO_CONNECTION_NO_PRICES)
    err.offline = true
    throw err
  }
  if (res.status === 503) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || 'No price has ever been retrieved.')
  }
  if (!res.ok) throw new Error('The price service is not answering right now.')
  const data = await res.json().catch(() => null)
  if (!isValidPriceResponse(data)) throw new Error('The price service sent prices that could not be used.')
  saveGuestData(PRICES_KEY, data, isValidPriceResponse)
  return data
}
