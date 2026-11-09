// Sadaqah planner routes for signed-in users (B.7, M7, S8.1 and S8.2).
//   GET|POST /api/goals,  PUT|DELETE /api/goals/:id
//   GET|POST /api/gifts,  PUT|DELETE /api/gifts/:id
// Every handler uses req.user.id from the verified session only; a row
// that isn't the user's answers exactly like a row that doesn't exist.
// Progress and streaks are worked out in the browser (src/planner/).
import express from 'express'
import { requireUser } from '../auth/session.js'
import { isUuid } from '../auth/validate.js'
import { firstRefusal, tooMany } from '../auth/guards.js'
import { cleanGift, cleanGoal, giftFromRow, goalFromRow } from '../planner/cleanPlanner.js'

export const MAX_GOALS_PER_USER = 50
export const MAX_GIFTS_PER_USER = 5000

export function createPlannerRouter({ auth, db, limits }) {
  const router = express.Router()
  const signedIn = requireUser(auth)

  const limited = (name) => (req, res, next) => {
    const refused = firstRefusal([[limits[name], req.user.id]])
    if (refused) return tooMany(res, refused.retryAfterSec)
    next()
  }
  const read = [signedIn, limited('settingsReadUser')]
  const write = [signedIn, limited('plannerWriteUser')]

  const invalid = (res, check) => res.status(400).json({ error: 'invalid_input', field: check.field, message: check.message })
  const notFound = (res, what) => res.status(404).json({ error: 'not_found', message: `That ${what} was not found.` })
  const badId = (res) => res.status(400).json({ error: 'invalid_id', message: 'Not a valid id.' })

  // A gift may only point at one of the user's own goals.
  async function ownGoalOrNull(userId, goalId) {
    return goalId === null ? true : !!(await db.getGoal(userId, goalId))
  }

  // ---- goals (S8.1)

  router.get('/api/goals', ...read, async (req, res) => {
    res.json({ goals: (await db.listGoals(req.user.id)).map(goalFromRow) })
  })

  router.post('/api/goals', ...write, async (req, res) => {
    const check = cleanGoal(req.body)
    if (!check.ok) return invalid(res, check)
    if ((await db.countGoals(req.user.id, MAX_GOALS_PER_USER)) >= MAX_GOALS_PER_USER) {
      return res.status(409).json({ error: 'too_many', message: `You can have up to ${MAX_GOALS_PER_USER} goals.` })
    }
    res.status(201).json({ goal: goalFromRow(await db.insertGoal(req.user.id, check.value)) })
  })

  router.put('/api/goals/:id', ...write, async (req, res) => {
    if (!isUuid(req.params.id)) return badId(res)
    const check = cleanGoal(req.body)
    if (!check.ok) return invalid(res, check)
    const row = await db.updateGoal(req.user.id, req.params.id, check.value)
    if (!row) return notFound(res, 'goal')
    res.json({ goal: goalFromRow(row) })
  })

  // Removing a goal keeps its gifts: each one keeps the goal's name as a
  // label and stops counting toward any progress (S8.1).
  router.delete('/api/goals/:id', ...write, async (req, res) => {
    if (!isUuid(req.params.id)) return badId(res)
    if (!(await db.removeGoal(req.user.id, req.params.id))) return notFound(res, 'goal')
    res.json({ ok: true })
  })

  // ---- gifts (S8.2)

  router.get('/api/gifts', ...read, async (req, res) => {
    res.json({ gifts: (await db.listGifts(req.user.id, MAX_GIFTS_PER_USER)).map(giftFromRow) })
  })

  router.post('/api/gifts', ...write, async (req, res) => {
    const check = cleanGift(req.body)
    if (!check.ok) return invalid(res, check)
    if (!(await ownGoalOrNull(req.user.id, check.value.goalId))) {
      return invalid(res, { field: 'goalId', message: 'Choose one of your goals.' })
    }
    if ((await db.countGifts(req.user.id, MAX_GIFTS_PER_USER)) >= MAX_GIFTS_PER_USER) {
      return res.status(409).json({ error: 'too_many', message: `You can log up to ${MAX_GIFTS_PER_USER} gifts.` })
    }
    res.status(201).json({ gift: giftFromRow(await db.insertGift(req.user.id, check.value)) })
  })

  router.put('/api/gifts/:id', ...write, async (req, res) => {
    if (!isUuid(req.params.id)) return badId(res)
    const check = cleanGift(req.body)
    if (!check.ok) return invalid(res, check)
    if (!(await ownGoalOrNull(req.user.id, check.value.goalId))) {
      return invalid(res, { field: 'goalId', message: 'Choose one of your goals.' })
    }
    const row = await db.updateGift(req.user.id, req.params.id, check.value)
    if (!row) return notFound(res, 'gift')
    res.json({ gift: giftFromRow(row) })
  })

  router.delete('/api/gifts/:id', ...write, async (req, res) => {
    if (!isUuid(req.params.id)) return badId(res)
    if (!(await db.deleteGift(req.user.id, req.params.id))) return notFound(res, 'gift')
    res.json({ ok: true })
  })

  return router
}
