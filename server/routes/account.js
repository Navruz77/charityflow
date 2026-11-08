// Signed-in routes for the user's own account (B.7), plus the admin route.
// Every handler uses req.user.id from the verified session; nothing ever
// takes a user id from the request body or query.
import express from 'express'
import { clearSessionCookie, requireUser } from '../auth/session.js'
import { cleanTimeZone, isUuid, normalizeEmail } from '../auth/validate.js'
import { tooMany } from '../auth/guards.js'

// The exact word the user must type to delete their account (S3.6).
export const DELETE_CONFIRM_WORD = 'DELETE'

export function createAccountRouter({ auth, db, limits }) {
  const router = express.Router()
  const signedIn = requireUser(auth)

  // Only lets admins through. Used after signedIn.
  async function adminOnly(req, res, next) {
    if (!(await db.isAdmin(req.user.id))) {
      return res.status(403).json({ error: 'forbidden', message: 'Admins only.' })
    }
    next()
  }

  // GET /api/profile — the user's own profile row.
  router.get('/api/profile', signedIn, async (req, res) => {
    const profile = await db.getProfile(req.user.id)
    res.json({
      email: req.user.email,
      timeZone: profile?.time_zone ?? null,
      zakatDate: profile?.zakat_date ?? null,
      createdAt: profile?.created_at ?? null,
    })
  })

  // PUT /api/profile { timeZone } — M6 adds the Zakat date here.
  router.put('/api/profile', signedIn, async (req, res) => {
    const timeZone = cleanTimeZone(req.body?.timeZone)
    if (!timeZone) {
      return res.status(400).json({ error: 'invalid_time_zone', message: 'Unknown time zone.' })
    }
    await db.ensureProfile(req.user.id, timeZone)
    await db.updateTimeZone(req.user.id, timeZone)
    res.json({ ok: true })
  })

  // DELETE /api/account { confirm: 'DELETE', password } — removes the
  // sign-in record with the secret key; "on delete cascade" removes every
  // row (S3.6). The password is asked again so someone using a device that
  // was left signed in can't wipe the account.
  router.delete('/api/account', signedIn, async (req, res) => {
    if (req.body?.confirm !== DELETE_CONFIRM_WORD) {
      return res.status(400).json({
        error: 'confirmation_required',
        message: `Type ${DELETE_CONFIRM_WORD} to confirm.`,
      })
    }
    // Same failed-password limit as sign-in, so this can't be used to guess.
    const email = normalizeEmail(req.user.email)
    const wait = limits.loginEmail.check(email)
    if (!wait.allowed) return tooMany(res, wait.retryAfterSec)
    const password = req.body?.password
    const check = typeof password === 'string' && password.length > 0 ? await auth.signIn(email, password) : { ok: false }
    if (check.status === 429) return tooMany(res, 300)
    if (!check.ok) {
      if (check.status >= 500) {
        return res.status(502).json({ error: 'auth_unavailable', message: 'Could not check your password. Nothing was removed.' })
      }
      limits.loginEmail.fail(email)
      return res.status(401).json({ error: 'wrong_password', message: 'That password is not correct. Nothing was removed.' })
    }
    limits.loginEmail.succeed(email)

    const result = await auth.deleteUser(req.user.id)
    if (!result.ok) {
      console.error('deleteUser failed:', result.status)
      return res.status(502).json({ error: 'delete_failed', message: 'Could not delete the account. Nothing was removed.' })
    }
    clearSessionCookie(req, res)
    res.json({ ok: true })
  })

  // GET /api/admin/users/:id — an admin reads one user's data. Goes through
  // admin_read_user_data, which writes one admin_access_log row (NFR5).
  router.get('/api/admin/users/:id', signedIn, adminOnly, async (req, res) => {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'invalid_id', message: 'Not a user id.' })
    }
    res.json(await db.adminReadUserData(req.user.id, req.params.id))
  })

  // GET /api/admin/stats — user and saved-calculation counts (NFR9).
  router.get('/api/admin/stats', signedIn, adminOnly, async (req, res) => {
    res.json(await db.adminStats(req.user.id))
  })

  return router
}
