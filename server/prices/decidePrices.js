// Pure price-caching decision logic. No network or database calls live
// here — callers inject the fetchers, which is what lets tests use a fake
// provider instead of ever calling the live API (PROJECT.md M3).

export const CACHE_HOURS = 8
export const STALE_HOURS = 24
const TROY_OUNCE_GRAMS = 31.1034768

export function isOlderThan(isoDate, now, hours) {
  if (!isoDate) return true
  return now - new Date(isoDate).getTime() > hours * 60 * 60 * 1000
}

export function isStale(fetchedAt, now) {
  return isOlderThan(fetchedAt, now, STALE_HOURS)
}

export function troyOunceToGram(usdPerTroyOunce) {
  return usdPerTroyOunce / TROY_OUNCE_GRAMS
}

function round4(n) {
  return Math.round(n * 10000) / 10000
}

// Both prices must be numbers above 0, and inside the sanity band chosen
// in PROJECT.md: gold 20-1,000, silver 0.2-100 USD per gram.
export function pricesAreSane(goldUsdPerGram, silverUsdPerGram) {
  const isNum = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0
  if (!isNum(goldUsdPerGram) || !isNum(silverUsdPerGram)) return false
  if (goldUsdPerGram < 20 || goldUsdPerGram > 1000) return false
  if (silverUsdPerGram < 0.2 || silverUsdPerGram > 100) return false
  return true
}

function toResponse(row) {
  if (!row || row.gold_usd_per_gram == null || row.silver_usd_per_gram == null) return null
  return {
    schemaVersion: 1,
    goldUsdPerGram: row.gold_usd_per_gram,
    silverUsdPerGram: row.silver_usd_per_gram,
    fetchedAt: row.fetched_at,
    source: row.source,
    lastAttemptAt: row.last_attempt_at,
    lastAttemptOk: row.last_attempt_ok,
    lastAttemptNote: row.last_attempt_note,
  }
}

// `cached` is the current price_cache row (or null if the table is empty).
// `fetchers` is an ordered list of { source, fetch } where fetch() resolves
// to { goldUsdPerGram, silverUsdPerGram } or rejects. Returns the row to
// store (callers persist it) and the response to send the browser (null
// means "no price has ever been retrieved" — S12.4).
export async function decidePrices({ now, cached, fetchers }) {
  if (cached && !isOlderThan(cached.fetched_at, now, CACHE_HOURS)) {
    return { cacheRow: cached, response: toResponse(cached) }
  }

  const attemptAt = new Date(now).toISOString()

  for (const { source, fetch } of fetchers) {
    try {
      const prices = await fetch()
      const gold = round4(prices.goldUsdPerGram)
      const silver = round4(prices.silverUsdPerGram)
      if (!pricesAreSane(gold, silver)) throw new Error(`${source} returned prices outside the sanity band`)
      const cacheRow = {
        id: 1,
        gold_usd_per_gram: gold,
        silver_usd_per_gram: silver,
        fetched_at: attemptAt,
        source,
        last_attempt_at: attemptAt,
        last_attempt_ok: true,
        last_attempt_note: null,
      }
      return { cacheRow, response: toResponse(cacheRow) }
    } catch {
      continue // try the next provider
    }
  }

  // Every provider failed. Keep the last stored prices (if any) and record
  // the failed attempt so the status page can show it.
  const note = 'All price providers failed; kept the last stored prices.'
  if (cached && cached.gold_usd_per_gram != null) {
    const cacheRow = { ...cached, last_attempt_at: attemptAt, last_attempt_ok: false, last_attempt_note: note }
    return { cacheRow, response: toResponse(cacheRow) }
  }

  const cacheRow = {
    id: 1,
    gold_usd_per_gram: null,
    silver_usd_per_gram: null,
    fetched_at: null,
    source: null,
    last_attempt_at: attemptAt,
    last_attempt_ok: false,
    last_attempt_note: 'No price has ever been retrieved.',
  }
  return { cacheRow, response: null }
}
