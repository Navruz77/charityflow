// POST /api/jobs/reminders (B.7). Called hourly by the GitHub Actions
// workflow with `Authorization: Bearer <JOB_TOKEN>`. Nobody else can run it.
//   body {}                       runs the job for real
//   body { asOf: "<ISO time>" }   dry run at a pretend time: reports who
//                                 would be reminded, writes and sends nothing
import { createHash, timingSafeEqual } from 'node:crypto'
import express from 'express'
import { tooMany } from '../auth/guards.js'
import { runReminderJob } from '../reminders/runReminderJob.js'

const MIN_TOKEN_LENGTH = 32

// Constant-time comparison, so response timing reveals nothing about the token.
function tokenMatches(given, expected) {
  if (typeof given !== 'string') return false
  const a = createHash('sha256').update(given).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

export function createJobsRouter({ auth, db, mailer, limits, now = () => new Date() }) {
  const router = express.Router()

  router.post('/api/jobs/reminders', async (req, res) => {
    const limit = limits.jobIp.hit(req.ip)
    if (!limit.allowed) return tooMany(res, limit.retryAfterSec)

    const expected = process.env.JOB_TOKEN
    if (!expected || expected.length < MIN_TOKEN_LENGTH) {
      console.error('JOB_TOKEN is missing or too short; reminder job refused')
      return res.status(503).json({ error: 'not_configured', message: 'The reminder job is not set up.' })
    }
    const header = req.headers.authorization ?? ''
    const given = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!tokenMatches(given, expected)) {
      return res.status(401).json({ error: 'unauthorized', message: 'Not allowed.' })
    }

    let at = now()
    const asOf = req.body?.asOf
    if (asOf !== undefined) {
      const t = typeof asOf === 'string' && asOf.length <= 40 ? Date.parse(asOf) : NaN
      if (Number.isNaN(t)) return res.status(400).json({ error: 'invalid_as_of', message: 'asOf must be an ISO date and time.' })
      at = new Date(t)
    }

    const appUrl = `${req.protocol}://${req.get('host')}`
    const result = await runReminderJob({ now: at, db, auth, mailer, dryRun: asOf !== undefined, appUrl })
    res.json(result)
  })

  return router
}
