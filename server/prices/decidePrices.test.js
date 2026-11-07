import { describe, it, expect, vi } from 'vitest'
import { decidePrices, pricesAreSane, troyOunceToGram, isStale } from './decidePrices.js'

const NOW = new Date('2026-11-07T12:00:00Z').getTime()

function row(overrides = {}) {
  return {
    id: 1,
    gold_usd_per_gram: 134.34,
    silver_usd_per_gram: 1.96,
    fetched_at: '2026-11-07T06:00:00Z', // 6 hours before NOW
    source: 'metalcharts',
    last_attempt_at: '2026-11-07T06:00:00Z',
    last_attempt_ok: true,
    last_attempt_note: null,
    ...overrides,
  }
}

const metalcharts = (fn) => ({ source: 'metalcharts', fetch: fn })
const apiNinjas = (fn) => ({ source: 'api-ninjas', fetch: fn })
const fails = () => Promise.reject(new Error('fake provider failure'))

describe('decidePrices: cache reuse', () => {
  it('reuses a cache row under 8 hours old and calls no provider', async () => {
    const fetchMetalCharts = vi.fn()
    const r = await decidePrices({ now: NOW, cached: row(), fetchers: [metalcharts(fetchMetalCharts)] })
    expect(fetchMetalCharts).not.toHaveBeenCalled()
    expect(r.response).toEqual({
      schemaVersion: 1,
      goldUsdPerGram: 134.34,
      silverUsdPerGram: 1.96,
      fetchedAt: '2026-11-07T06:00:00Z',
      source: 'metalcharts',
      lastAttemptAt: '2026-11-07T06:00:00Z',
      lastAttemptOk: true,
      lastAttemptNote: null,
    })
  })

  it('fetches new prices once the cache is 8+ hours old', async () => {
    const stale = row({ fetched_at: '2026-11-07T03:00:00Z' }) // 9 hours before NOW
    const fetchMetalCharts = vi.fn().mockResolvedValue({ goldUsdPerGram: 140, silverUsdPerGram: 2 })
    const r = await decidePrices({ now: NOW, cached: stale, fetchers: [metalcharts(fetchMetalCharts)] })
    expect(fetchMetalCharts).toHaveBeenCalledOnce()
    expect(r.response.goldUsdPerGram).toBe(140)
    expect(r.response.source).toBe('metalcharts')
    expect(r.response.lastAttemptOk).toBe(true)
  })
})

describe('decidePrices: fallback chain', () => {
  it('falls back to the second provider when the first fails', async () => {
    const stale = row({ fetched_at: null })
    const r = await decidePrices({
      now: NOW,
      cached: stale,
      fetchers: [metalcharts(fails), apiNinjas(() => Promise.resolve({ goldUsdPerGram: 130, silverUsdPerGram: 1.5 }))],
    })
    expect(r.response.source).toBe('api-ninjas')
    expect(r.response.goldUsdPerGram).toBe(130)
  })

  it('keeps the last stored prices and records the failure when every provider fails', async () => {
    const stale = row({ fetched_at: '2026-11-06T00:00:00Z' })
    const r = await decidePrices({ now: NOW, cached: stale, fetchers: [metalcharts(fails), apiNinjas(fails)] })
    expect(r.response.goldUsdPerGram).toBe(134.34) // unchanged from the stored row
    expect(r.response.lastAttemptOk).toBe(false)
    expect(r.cacheRow.last_attempt_note).toMatch(/failed/i)
  })

  it('returns no response when no price has ever been retrieved and every provider fails', async () => {
    const r = await decidePrices({ now: NOW, cached: null, fetchers: [metalcharts(fails), apiNinjas(fails)] })
    expect(r.response).toBeNull()
    expect(r.cacheRow.last_attempt_ok).toBe(false)
  })
})

describe('decidePrices: validation', () => {
  it('rejects a provider result outside the sanity band and tries the next one', async () => {
    const r = await decidePrices({
      now: NOW,
      cached: null,
      fetchers: [
        metalcharts(() => Promise.resolve({ goldUsdPerGram: 5, silverUsdPerGram: 1.96 })), // gold too low
        apiNinjas(() => Promise.resolve({ goldUsdPerGram: 134.34, silverUsdPerGram: 1.96 })),
      ],
    })
    expect(r.response.source).toBe('api-ninjas')
  })

  it('rejects zero, negative or non-numeric prices', () => {
    expect(pricesAreSane(0, 1.5)).toBe(false)
    expect(pricesAreSane(-10, 1.5)).toBe(false)
    expect(pricesAreSane(NaN, 1.5)).toBe(false)
    expect(pricesAreSane(134.34, 1.96)).toBe(true)
  })
})

describe('unit helpers', () => {
  it('converts troy ounces to grams', () => {
    expect(troyOunceToGram(31.1034768)).toBeCloseTo(1, 10)
  })

  it('flags prices over 24 hours old as stale', () => {
    expect(isStale('2026-11-06T11:00:00Z', NOW)).toBe(true) // 25 hours
    expect(isStale('2026-11-06T13:00:00Z', NOW)).toBe(false) // 23 hours
  })
})
