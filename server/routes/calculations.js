// Saved calculations for signed-in users (B.7, S4.2, S3.5).
//   GET    /api/calculations       the user's own saves, newest first
//   POST   /api/calculations       { calculations: [1 to 10 calculations] }
//   DELETE /api/calculations/:id   removes one of the user's own saves
// Every handler uses req.user.id from the verified session. The user id is
// never read from the body, the query or the URL.
import express from 'express'
import { requireUser } from '../auth/session.js'
import { isUuid } from '../auth/validate.js'
import { firstRefusal, tooMany } from '../auth/guards.js'
import { cleanCalculation, rowToCalculation } from '../calculations/cleanCalculation.js'

export const MAX_PER_REQUEST = 10 // the guest-save transfer sends batches of this size
export const MAX_SAVED_PER_USER = 200 // stops one account filling the free database

export function createCalculationsRouter({ auth, db, limits }) {
  const router = express.Router()
  const signedIn = requireUser(auth)

  // Counts one request against the per-device and per-user limits.
  // `userLimit` is the limit's name in `limits` (looked up per request).
  const limited = (userLimit) => (req, res, next) => {
    const refused = firstRefusal([
      [limits.calcIp, req.ip],
      [limits[userLimit], req.user.id],
    ])
    if (refused) return tooMany(res, refused.retryAfterSec)
    next()
  }

  router.get('/api/calculations', signedIn, limited('calcReadUser'), async (req, res) => {
    const rows = await db.listCalculations(req.user.id, MAX_SAVED_PER_USER)
    res.json({ calculations: rows.map(rowToCalculation) })
  })

  router.post('/api/calculations', signedIn, limited('calcWriteUser'), async (req, res) => {
    const list = req.body?.calculations
    if (!Array.isArray(list) || list.length < 1 || list.length > MAX_PER_REQUEST) {
      return res.status(400).json({
        error: 'invalid_calculation',
        message: `Send between 1 and ${MAX_PER_REQUEST} calculations.`,
      })
    }

    // Check every one first; save none if any is wrong.
    const rows = []
    for (let i = 0; i < list.length; i++) {
      const cleaned = cleanCalculation(list[i])
      if (!cleaned.ok) {
        return res.status(400).json({
          error: 'invalid_calculation',
          message: 'This calculation could not be saved because some of its data is not valid.',
          index: i,
          field: cleaned.field,
        })
      }
      rows.push(cleaned.row)
    }

    const existing = await db.countCalculations(req.user.id, MAX_SAVED_PER_USER)
    if (existing + rows.length > MAX_SAVED_PER_USER) {
      return res.status(409).json({
        error: 'too_many_saved',
        message: `An account can keep up to ${MAX_SAVED_PER_USER} saved calculations. Delete some older ones first.`,
      })
    }

    const saved = await db.insertCalculations(req.user.id, rows)
    res.status(201).json({ calculations: saved.map(rowToCalculation) })
  })

  router.delete('/api/calculations/:id', signedIn, limited('calcWriteUser'), async (req, res) => {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'invalid_id', message: 'Not a saved calculation.' })
    }
    // Same answer whether the row doesn't exist or belongs to someone else.
    if (!(await db.deleteCalculation(req.user.id, req.params.id))) {
      return res.status(404).json({ error: 'not_found', message: 'That saved calculation was not found.' })
    }
    res.json({ ok: true })
  })

  return router
}
