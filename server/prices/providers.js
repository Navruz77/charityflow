// Real price providers. Never imported by tests — decidePrices.test.js
// injects fakes instead, per PROJECT.md ("never call the live API in
// tests"). Each fetcher reads its key from an env var that only exists in
// Render's environment, never in the repo or the browser bundle.
import { troyOunceToGram } from './decidePrices.js'

const REQUEST_TIMEOUT_MS = 8000

async function fetchWithTimeout(url, options) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    if (!res.ok) throw new Error(`${url} responded with ${res.status}`)
    return res.json()
  } finally {
    clearTimeout(timeout)
  }
}

// Confirmed against a real request on 2026-11-07: GET /v1/prices (no query
// params -- it returns every tracked metal) returns
// { data: { XAU: { price, unit: 'toz', currency: 'USD', ... }, XAG: {...} } }.
export async function fetchFromMetalCharts() {
  const key = process.env.METALCHARTS_API_KEY
  if (!key) throw new Error('METALCHARTS_API_KEY is not set')
  const data = await fetchWithTimeout('https://api.metalcharts.org/v1/prices', {
    headers: { Authorization: `Bearer ${key}` },
  })
  const goldPerOunce = Number(data?.data?.XAU?.price)
  const silverPerOunce = Number(data?.data?.XAG?.price)
  if (!(goldPerOunce > 0) || !(silverPerOunce > 0)) throw new Error('MetalCharts response missing prices')
  return {
    goldUsdPerGram: troyOunceToGram(goldPerOunce),
    silverUsdPerGram: troyOunceToGram(silverPerOunce),
  }
}

// API Ninjas: last daily close on the free plan, one metal per request.
export async function fetchFromApiNinjas() {
  const key = process.env.API_NINJAS_KEY
  if (!key) throw new Error('API_NINJAS_KEY is not set')
  const headers = { 'X-Api-Key': key }
  const [gold, silver] = await Promise.all([
    fetchWithTimeout('https://api.api-ninjas.com/v1/commodityprice?name=gold&unit=g', { headers }),
    fetchWithTimeout('https://api.api-ninjas.com/v1/commodityprice?name=silver&unit=g', { headers }),
  ])
  const goldUsdPerGram = Number(gold?.price)
  const silverUsdPerGram = Number(silver?.price)
  if (!(goldUsdPerGram > 0) || !(silverUsdPerGram > 0)) throw new Error('API Ninjas response missing prices')
  return { goldUsdPerGram, silverUsdPerGram }
}
