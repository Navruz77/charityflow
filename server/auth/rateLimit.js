// In-memory rate limits for the account routes. Supabase's own limits see
// every request as coming from our one server, so they can't tell one
// attacker from all our users; these limits can.
//
// Kept in memory: fine for our single Render instance. A restart clears
// them, which only ever makes things more lenient, never locks anyone out.
const MAX_KEYS = 20000 // stops a flood of new keys from using up memory

// "At most `max` tries per `windowMs` for each key" (a key is an IP address
// or an email). hit() counts one try and says whether it is allowed.
export function createLimiter({ windowMs, max, now = () => Date.now() }) {
  const entries = new Map() // key -> { count, resetAt }

  function sweep(t) {
    if (entries.size < MAX_KEYS) return
    for (const [key, e] of entries) if (e.resetAt <= t) entries.delete(key)
    if (entries.size >= MAX_KEYS) entries.clear()
  }

  return {
    hit(key) {
      const t = now()
      let e = entries.get(key)
      if (!e || e.resetAt <= t) {
        sweep(t)
        e = { count: 0, resetAt: t + windowMs }
        entries.set(key, e)
      }
      e.count += 1
      if (e.count <= max) return { allowed: true }
      return { allowed: false, retryAfterSec: Math.ceil((e.resetAt - t) / 1000) }
    },
  }
}

// Failed sign-ins for one email. The first `freeFailures` cost nothing; after
// that each failure doubles the wait (30s, 1m, 2m, ... up to 15 minutes).
// There is never a permanent lockout, so an attacker can't lock a real user
// out for long. A correct password clears the record.
export function createFailureBackoff({
  freeFailures = 5,
  baseMs = 30 * 1000,
  maxMs = 15 * 60 * 1000,
  forgetMs = 60 * 60 * 1000,
  now = () => Date.now(),
} = {}) {
  const entries = new Map() // key -> { failures, lastAt, blockedUntil }

  function current(key, t) {
    const e = entries.get(key)
    if (e && t - e.lastAt > forgetMs) {
      entries.delete(key)
      return null
    }
    return e ?? null
  }

  return {
    check(key) {
      const t = now()
      const e = current(key, t)
      if (e && e.blockedUntil > t) return { allowed: false, retryAfterSec: Math.ceil((e.blockedUntil - t) / 1000) }
      return { allowed: true }
    },
    fail(key) {
      const t = now()
      if (entries.size >= MAX_KEYS) entries.clear()
      const e = current(key, t) ?? { failures: 0, lastAt: t, blockedUntil: 0 }
      e.failures += 1
      e.lastAt = t
      if (e.failures > freeFailures) {
        e.blockedUntil = t + Math.min(baseMs * 2 ** (e.failures - freeFailures - 1), maxMs)
      }
      entries.set(key, e)
    },
    succeed(key) {
      entries.delete(key)
    },
  }
}

// Builds every limit the account routes use, fresh for each app (tests get
// their own). Numbers are per IP address unless they say "per email".
export function createAuthLimits() {
  const minutes = (n) => n * 60 * 1000
  return {
    loginIp: createLimiter({ windowMs: minutes(15), max: 30 }),
    loginEmail: createFailureBackoff(), // failed passwords, per email
    registerIp: createLimiter({ windowMs: minutes(60), max: 10 }),
    emailSendIp: createLimiter({ windowMs: minutes(60), max: 10 }), // resend + reset
    emailSendEmail: createLimiter({ windowMs: minutes(60), max: 3 }), // per email
    confirmIp: createLimiter({ windowMs: minutes(15), max: 30 }),
    newPasswordIp: createLimiter({ windowMs: minutes(15), max: 10 }),
    // Saved calculations (M5): per signed-in user, plus a per-IP ceiling.
    calcReadUser: createLimiter({ windowMs: minutes(15), max: 120 }),
    calcWriteUser: createLimiter({ windowMs: minutes(15), max: 40 }),
    calcIp: createLimiter({ windowMs: minutes(15), max: 300 }),
    // Profile, reminder settings and in-app reminders (M6), per user.
    settingsReadUser: createLimiter({ windowMs: minutes(15), max: 300 }),
    settingsWriteUser: createLimiter({ windowMs: minutes(15), max: 60 }),
    // The reminder job route, per IP (only the hourly workflow should call it).
    jobIp: createLimiter({ windowMs: minutes(15), max: 20 }),
  }
}
