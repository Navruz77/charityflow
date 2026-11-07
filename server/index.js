// CharityFlow server. Serves the built front end (dist/) and the /api
// routes. This is the only part of the app that ever holds secret keys.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { pricesRouter } from './routes/prices.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '..', 'dist')

const app = express()
app.disable('x-powered-by') // don't advertise the framework/version

// A few defense-in-depth headers. Not a replacement for a real security
// audit, but cheap and worth having with no new dependency.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  next()
})

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.use(pricesRouter)

app.use(express.static(distDir))

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`CharityFlow server listening on port ${port}`)
})
