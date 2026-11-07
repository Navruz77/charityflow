import express from 'express'
import { decidePrices } from '../prices/decidePrices.js'
import { fetchFromMetalCharts, fetchFromApiNinjas } from '../prices/providers.js'
import { getCachedRow, saveCachedRow } from '../prices/priceCacheStore.js'

export const pricesRouter = express.Router()

// GET /api/prices — anyone can call this (B.7). Reuses the cached prices
// if they're under 8 hours old; otherwise fetches new ones, with MetalCharts
// first and API Ninjas as a fallback, then falls back to the last stored
// prices if both fail. Never exposes a key to the caller.
pricesRouter.get('/api/prices', async (req, res) => {
  try {
    const cached = await getCachedRow()
    const { cacheRow, response } = await decidePrices({
      now: Date.now(),
      cached,
      fetchers: [
        { source: 'metalcharts', fetch: fetchFromMetalCharts },
        { source: 'api-ninjas', fetch: fetchFromApiNinjas },
      ],
    })

    // Only write when something changed, so an unchanged cache-hit doesn't
    // cost a database write on every request.
    if (cacheRow !== cached) {
      await saveCachedRow(cacheRow)
    }

    if (!response) {
      return res.status(503).json({ error: 'no_price_available', message: 'No price has ever been retrieved.' })
    }
    res.json(response)
  } catch (err) {
    console.error('GET /api/prices failed:', err.message)
    res.status(500).json({ error: 'server_error', message: 'Could not retrieve prices.' })
  }
})
