// Builds the Express app. index.js starts it; tests build it with fake
// `auth` and `db` objects so no test ever talks to the real Supabase.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { pricesRouter } from './routes/prices.js'
import { createAuthRouter } from './routes/auth.js'
import { createAccountRouter } from './routes/account.js'
import { createCalculationsRouter } from './routes/calculations.js'
import { createRemindersRouter } from './routes/reminders.js'
import { createJobsRouter } from './routes/jobs.js'
import { createPlannerRouter } from './routes/planner.js'
import { createAuthLimits } from './auth/rateLimit.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '..', 'dist')

// `breach` checks passwords against known leaks; `limits` holds the rate
// limits (a fresh set per app, so each test starts clean).
// `mailer` sends reminder emails; `now` lets tests fix the clock.
export function createApp({ auth, db, breach, mailer, limits = createAuthLimits(), now }) {
  const app = express()
  app.disable('x-powered-by') // don't advertise the framework/version
  // Render puts a proxy in front of us. This makes req.secure true for
  // HTTPS requests, so the session cookie gets the Secure flag.
  app.set('trust proxy', 1)

  // A few defense-in-depth headers, with no new dependency.
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    next()
  })

  app.use('/api', express.json({ limit: '100kb' }))

  // Blocks other websites from making a signed-in user's browser change
  // things here (CSRF). The SameSite=Lax cookie already stops most of
  // this; checking Origin on every change is a second layer.
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next()
    const origin = req.headers.origin
    if (origin) {
      let originHost = null
      try {
        originHost = new URL(origin).host
      } catch {
        // unparseable origin: treated as foreign below
      }
      if (originHost !== req.headers.host) {
        return res.status(403).json({ error: 'bad_origin', message: 'Request blocked.' })
      }
    }
    next()
  })

  // Signed-in pages must never be cached by a shared proxy.
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

  app.get('/api/health', (req, res) => {
    res.json({ ok: true })
  })

  app.use(pricesRouter)
  app.use(createAuthRouter({ auth, db, breach, limits }))
  app.use(createAccountRouter({ auth, db, limits }))
  app.use(createCalculationsRouter({ auth, db, limits }))
  app.use(createRemindersRouter({ auth, db, limits }))
  app.use(createJobsRouter({ auth, db, mailer, limits, now }))
  app.use(createPlannerRouter({ auth, db, limits }))

  // Unknown /api paths get JSON, not the website.
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'not_found' })
  })

  // Any error thrown in a route ends here. The real cause goes only to the
  // server log; the browser gets a generic message with no details.
  // eslint-disable-next-line no-unused-vars
  app.use('/api', (err, req, res, next) => {
    console.error(`${req.method} ${req.path} failed:`, err.message)
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'bad_json', message: 'Request body is not valid JSON.' })
    }
    res.status(500).json({ error: 'server_error', message: 'Something went wrong. Please try again.' })
  })

  app.use(express.static(distDir))
  return app
}
