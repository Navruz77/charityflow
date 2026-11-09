import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isStale, loadStoredPrices, NO_CONNECTION_NO_PRICES, PRICES_KEY, requestPrices } from './prices.js'

function fakeStorage() {
  const store = new Map()
  return { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
}

const GOOD = { schemaVersion: 1, goldUsdPerGram: 130.7266, silverUsdPerGram: 1.669, fetchedAt: '2026-11-08T21:54:07.113+00:00', source: 'metalcharts' }
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.stubGlobal('window', { localStorage: fakeStorage() })
})

describe('requestPrices (M5 offline)', () => {
  it('stores good prices in cf.v1.prices for later offline use', async () => {
    vi.stubGlobal('fetch', async () => reply(200, GOOD))
    expect(await requestPrices()).toEqual(GOOD)
    expect(loadStoredPrices()).toEqual(GOOD)
    expect(JSON.parse(window.localStorage.getItem(PRICES_KEY)).data).toEqual(GOOD)
  })

  it('offline with nothing stored: a plain message, never the browser or service worker error', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('FetchEvent.respondWith received an error: no-response :: [{"url":"/api/prices"}]')
    })
    const err = await requestPrices().catch((e) => e)
    expect(err.message).toBe(NO_CONNECTION_NO_PRICES)
    expect(err.offline).toBe(true)
    expect(err.message).not.toMatch(/FetchEvent|no-response/)
  })

  it('refuses and does not store bad prices', async () => {
    vi.stubGlobal('fetch', async () => reply(200, { ...GOOD, goldUsdPerGram: 0 }))
    await expect(requestPrices()).rejects.toThrow(/could not be used/)
    expect(loadStoredPrices()).toBeNull()
  })

  it('a server error does not wipe the stored copy', async () => {
    vi.stubGlobal('fetch', async () => reply(200, GOOD))
    await requestPrices()
    vi.stubGlobal('fetch', async () => reply(500, {}))
    await expect(requestPrices()).rejects.toThrow()
    expect(loadStoredPrices()).toEqual(GOOD)
  })

  it('callers asking at the same time share one request', async () => {
    let calls = 0
    vi.stubGlobal('fetch', async () => {
      calls += 1
      return reply(200, GOOD)
    })
    await Promise.all([requestPrices(), requestPrices()])
    expect(calls).toBe(1)
  })

  it('stale means over 24 hours old', () => {
    const t = Date.parse(GOOD.fetchedAt)
    expect(isStale(GOOD, t + 23 * 3600e3)).toBe(false)
    expect(isStale(GOOD, t + 25 * 3600e3)).toBe(true)
  })
})
