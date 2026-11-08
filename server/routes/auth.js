// /api/auth routes (B.7, S3.2 to S3.4). All sign-in work happens here on the
// server; the browser only ever gets an HttpOnly cookie, never a token.
// Every route is rate limited (server/auth/rateLimit.js), and every new
// password is checked against the shared rules and known breaches.
import express from 'express'
import { authErrorCode, authErrorText } from '../supabase/request.js'
import { clearSessionCookie, loadSession, requireUser, setSessionCookie } from '../auth/session.js'
import { cleanTimeZone, isEmail, normalizeEmail } from '../auth/validate.js'
import { firstRefusal, passwordRefusal, tooMany } from '../auth/guards.js'

// One message for a wrong email AND a wrong password (S3.3), so nobody can
// learn which addresses have accounts.
const SIGNIN_FAILED = 'Sign-in failed. Check your email and password and try again.'

export function createAuthRouter({ auth, db, breach, limits }) {
  const router = express.Router()

  // Creates the profile row the first time we see a user. Never blocks
  // sign-in if it fails; it is retried on the next sign-in.
  async function ensureProfile(userId, timeZone) {
    try {
      await db.ensureProfile(userId, cleanTimeZone(timeZone) ?? 'UTC')
    } catch (err) {
      console.error('ensureProfile failed:', err.message)
    }
  }

  function badEmail(res) {
    return res.status(400).json({ error: 'invalid_email', message: 'Enter a valid email address.' })
  }

  // POST /api/auth/register { email, password, timeZone }
  router.post('/api/auth/register', async (req, res) => {
    const refused = firstRefusal([[limits.registerIp, req.ip]])
    if (refused) return tooMany(res, refused.retryAfterSec)

    const email = normalizeEmail(req.body?.email)
    const password = req.body?.password
    if (!isEmail(email)) return badEmail(res)
    const weak = await passwordRefusal(password, email, breach)
    if (weak) return res.status(400).json({ error: 'invalid_password', message: weak })

    const result = await auth.signUp(email, password)
    const code = authErrorCode(result.data)
    if (result.status === 429) return tooMany(res, 300)
    // Supabase answers an existing, confirmed email either with an error or
    // with a user that has no identities. S3.2 says to refuse it and point
    // to sign-in, so we report both cases the same way.
    const user = result.data?.user ?? result.data
    const alreadyExists =
      code === 'user_already_exists' ||
      code === 'email_exists' ||
      (result.ok && Array.isArray(user?.identities) && user.identities.length === 0)
    if (alreadyExists) {
      return res.status(409).json({ error: 'email_taken', message: 'An account with this email already exists. Please sign in.' })
    }
    if (code === 'weak_password') {
      return res.status(400).json({ error: 'invalid_password', message: 'That password is too weak. Try a longer one.' })
    }
    if (!result.ok || !user?.id) {
      console.error('signUp failed:', result.status, code)
      return res.status(502).json({ error: 'register_failed', message: 'Could not create the account. Please try again.' })
    }

    // The browser's time zone is stored now; reminders (M6) depend on it.
    await ensureProfile(user.id, req.body?.timeZone)

    // Normally Supabase waits for the email confirmation. If confirmations
    // were ever switched off, a session comes back and we sign them in.
    if (result.data?.access_token) {
      setSessionCookie(req, res, result.data.access_token, result.data.refresh_token)
      return res.status(201).json({ ok: true, needsConfirmation: false })
    }
    res.status(201).json({ ok: true, needsConfirmation: true })
  })

  // POST /api/auth/resend { email } — sends the confirmation email again.
  // Always says "sent" so it can't be used to test which emails exist.
  router.post('/api/auth/resend', async (req, res) => {
    const email = normalizeEmail(req.body?.email)
    if (!isEmail(email)) return badEmail(res)
    const refused = firstRefusal([
      [limits.emailSendIp, req.ip],
      [limits.emailSendEmail, `resend:${email}`],
    ])
    if (refused) return tooMany(res, refused.retryAfterSec)
    const result = await auth.resendSignup(email)
    if (result.status === 429) return tooMany(res, 300)
    res.json({ ok: true })
  })

  // POST /api/auth/login { email, password, timeZone }
  router.post('/api/auth/login', async (req, res) => {
    const email = normalizeEmail(req.body?.email)
    const password = req.body?.password

    // Two limits: tries from this device, and failed passwords for this
    // email (whether or not it has an account, so this reveals nothing).
    const ipRefused = firstRefusal([[limits.loginIp, req.ip]])
    if (ipRefused) return tooMany(res, ipRefused.retryAfterSec)
    const emailCheck = limits.loginEmail.check(email)
    if (!emailCheck.allowed) return tooMany(res, emailCheck.retryAfterSec)

    if (!isEmail(email) || typeof password !== 'string' || password.length === 0) {
      return res.status(401).json({ error: 'signin_failed', message: SIGNIN_FAILED })
    }

    const result = await auth.signIn(email, password)
    if (result.status === 429) return tooMany(res, 300)
    if (result.ok && result.data?.access_token) {
      limits.loginEmail.succeed(email)
      setSessionCookie(req, res, result.data.access_token, result.data.refresh_token)
      await ensureProfile(result.data.user.id, req.body?.timeZone)
      return res.json({ ok: true, user: { email: result.data.user.email } })
    }

    // Supabase only says "not confirmed" after the password was right, so
    // this message does not reveal anything to someone without the password.
    const code = authErrorCode(result.data)
    if (code === 'email_not_confirmed' || authErrorText(result.data).includes('not confirmed')) {
      return res.status(403).json({
        error: 'email_not_confirmed',
        message: 'Please confirm your email first. We can send the link again.',
      })
    }
    if (result.status >= 500) {
      return res.status(502).json({ error: 'auth_unavailable', message: 'Sign-in is not available right now.' })
    }
    limits.loginEmail.fail(email)
    res.status(401).json({ error: 'signin_failed', message: SIGNIN_FAILED })
  })

  // POST /api/auth/logout — ends the session on Supabase and clears the cookie.
  router.post('/api/auth/logout', async (req, res) => {
    try {
      const session = await loadSession(req, res, auth)
      if (session) await auth.signOut(session.accessToken, 'local')
    } catch (err) {
      console.error('logout: could not reach Supabase:', err.message)
    }
    clearSessionCookie(req, res)
    res.json({ ok: true })
  })

  // POST /api/auth/reset { email } — emails a reset link. Always says "sent".
  router.post('/api/auth/reset', async (req, res) => {
    const email = normalizeEmail(req.body?.email)
    if (!isEmail(email)) return badEmail(res)
    const refused = firstRefusal([
      [limits.emailSendIp, req.ip],
      [limits.emailSendEmail, `reset:${email}`],
    ])
    if (refused) return tooMany(res, refused.retryAfterSec)
    const result = await auth.recover(email)
    if (result.status === 429) return tooMany(res, 300)
    res.json({ ok: true })
  })

  // POST /api/auth/confirm { tokenHash, type, timeZone }
  // Called by the #/confirm page after the user taps the link in an email.
  // type 'email' confirms a new account; 'recovery' starts a password reset.
  // Either way the user ends up signed in on this browser.
  router.post('/api/auth/confirm', async (req, res) => {
    const refused = firstRefusal([[limits.confirmIp, req.ip]])
    if (refused) return tooMany(res, refused.retryAfterSec)
    const tokenHash = req.body?.tokenHash
    const type = req.body?.type
    if (typeof tokenHash !== 'string' || tokenHash.length > 200 || !['email', 'recovery'].includes(type)) {
      return res.status(400).json({ error: 'link_invalid', message: 'This link is not valid.' })
    }
    const result = await auth.verify(tokenHash, type)
    if (!result.ok || !result.data?.access_token) {
      return res.status(400).json({
        error: 'link_invalid',
        message: 'This link has expired or was already used. Please ask for a new one.',
      })
    }
    setSessionCookie(req, res, result.data.access_token, result.data.refresh_token)
    await ensureProfile(result.data.user.id, req.body?.timeZone)
    res.json({ ok: true, type })
  })

  // POST /api/auth/new-password { password } — after a reset link. Then
  // signs out every other device (S3.4).
  router.post('/api/auth/new-password', requireUser(auth), async (req, res) => {
    const refused = firstRefusal([[limits.newPasswordIp, req.ip]])
    if (refused) return tooMany(res, refused.retryAfterSec)
    const password = req.body?.password
    const weak = await passwordRefusal(password, req.user.email, breach)
    if (weak) return res.status(400).json({ error: 'invalid_password', message: weak })

    const result = await auth.updatePassword(req.accessToken, password)
    if (!result.ok) {
      const code = authErrorCode(result.data)
      if (code === 'same_password') {
        return res.status(400).json({ error: 'invalid_password', message: 'Choose a password different from your old one.' })
      }
      if (code === 'weak_password') {
        return res.status(400).json({ error: 'invalid_password', message: 'That password is too weak. Try a longer one.' })
      }
      console.error('updatePassword failed:', result.status, code)
      return res.status(502).json({ error: 'update_failed', message: 'Could not change the password. Please try again.' })
    }
    // Failed sign-ins before the reset no longer count against the owner.
    limits.loginEmail.succeed(normalizeEmail(req.user.email))
    const others = await auth.signOut(req.accessToken, 'others')
    if (!others.ok) console.error('sign out other devices failed:', others.status)
    res.json({ ok: true })
  })

  // GET /api/auth/session — who is signed in, for the header and pages.
  router.get('/api/auth/session', async (req, res) => {
    const session = await loadSession(req, res, auth)
    if (!session) return res.json({ signedIn: false })
    let isAdmin = false
    try {
      isAdmin = await db.isAdmin(session.user.id)
    } catch (err) {
      console.error('isAdmin failed:', err.message)
    }
    res.json({ signedIn: true, email: session.user.email, isAdmin })
  })

  return router
}
