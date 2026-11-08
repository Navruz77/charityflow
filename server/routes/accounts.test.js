// M4 route tests. They run the real Express app against an in-memory fake
// of Supabase Auth and the database, so no test touches the real services.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import { createAuthLimits } from '../auth/rateLimit.js'

// ---------------------------------------------------------------- fakes

function makeFakes() {
  const users = new Map() // email -> { id, email, password, confirmed }
  const sessions = new Map() // access token -> { userId, refresh, sessionId }
  const refreshTokens = new Map() // refresh token -> sessionId
  const liveSessions = new Set() // sessionIds that are still signed in
  const profiles = new Map() // userId -> { time_zone }
  const admins = new Set()
  const adminLog = []
  const tokensByHash = new Map() // email-link token_hash -> userId
  let counter = 0

  const ok = (data, status = 200) => ({ ok: true, status, data })
  const err = (status, data) => ({ ok: false, status, data })

  function startSession(user) {
    counter += 1
    const sessionId = `s${counter}`
    const access = `access-${counter}`
    const refresh = `refresh-${counter}`
    liveSessions.add(sessionId)
    sessions.set(access, { userId: user.id, refresh, sessionId })
    refreshTokens.set(refresh, sessionId)
    return { access_token: access, refresh_token: refresh, user: { id: user.id, email: user.email } }
  }
  const userById = (id) => [...users.values()].find((u) => u.id === id)

  const auth = {
    async signUp(email, password) {
      if (users.has(email)) return ok({ id: 'fake', email, identities: [] }) // Supabase's obfuscated reply
      counter += 1
      const user = { id: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`, email, password, confirmed: false }
      users.set(email, user)
      tokensByHash.set(`confirm-${email}`, user.id)
      return ok({ id: user.id, email, identities: [{ id: 'i' }] })
    },
    async signIn(email, password) {
      const user = users.get(email)
      if (!user || user.password !== password) return err(400, { error_code: 'invalid_credentials' })
      if (!user.confirmed) return err(400, { error_code: 'email_not_confirmed' })
      return ok(startSession(user))
    },
    async refresh(refreshToken) {
      const sessionId = refreshTokens.get(refreshToken)
      if (!sessionId || !liveSessions.has(sessionId)) return err(400, { error_code: 'refresh_token_not_found' })
      const old = [...sessions.entries()].find(([, s]) => s.sessionId === sessionId)
      return ok(startSession(userById(old[1].userId)))
    },
    async getUser(access) {
      const s = sessions.get(access)
      if (!s || !liveSessions.has(s.sessionId) || !userById(s.userId)) return err(403, { error_code: 'session_not_found' })
      const user = userById(s.userId)
      return ok({ id: user.id, email: user.email })
    },
    async signOut(access, scope) {
      const s = sessions.get(access)
      if (!s) return err(401, {})
      for (const other of sessions.values()) {
        if (other.userId !== s.userId) continue
        const isThis = other.sessionId === s.sessionId
        if (scope === 'global' || (scope === 'local' && isThis) || (scope === 'others' && !isThis)) {
          liveSessions.delete(other.sessionId)
        }
      }
      return ok(null, 204)
    },
    async resendSignup() {
      return ok({})
    },
    async recover(email) {
      if (users.has(email)) tokensByHash.set(`reset-${email}`, users.get(email).id)
      return ok({})
    },
    async verify(tokenHash) {
      const userId = tokensByHash.get(tokenHash)
      if (!userId) return err(403, { error_code: 'otp_expired' })
      tokensByHash.delete(tokenHash)
      const user = userById(userId)
      user.confirmed = true
      return ok(startSession(user))
    },
    async updatePassword(access, password) {
      const user = userById(sessions.get(access).userId)
      user.password = password
      return ok({ id: user.id })
    },
    async deleteUser(id) {
      const user = userById(id)
      if (!user) return err(404, {})
      users.delete(user.email)
      profiles.delete(id) // what "on delete cascade" does in the real database
      admins.delete(id)
      return ok({})
    },
  }

  const db = {
    async getProfile(userId) {
      return profiles.get(userId) ?? null
    },
    async ensureProfile(userId, timeZone) {
      if (!profiles.has(userId)) profiles.set(userId, { time_zone: timeZone })
    },
    async updateTimeZone(userId, timeZone) {
      profiles.get(userId).time_zone = timeZone
    },
    async isAdmin(userId) {
      return admins.has(userId)
    },
    async adminReadUserData(adminId, subjectId) {
      adminLog.push({ adminId, subjectId })
      return { profile: profiles.get(subjectId) ?? null }
    },
    async adminStats() {
      return { users: users.size, calculations: 0 }
    },
  }

  return { auth, db, users, profiles, admins, adminLog }
}

// ------------------------------------------------------------- helpers

let server
let base
let fakes
let currentLimits

beforeAll(async () => {
  // One server for the file; the fakes are swapped per test through this proxy.
  const auth = new Proxy({}, { get: (_, k) => (...a) => fakes.auth[k](...a) })
  const db = new Proxy({}, { get: (_, k) => (...a) => fakes.db[k](...a) })
  const breach = { isBreached: async (pw) => fakes.breached.has(pw) }
  const limits = new Proxy({}, { get: (_, k) => currentLimits[k] })
  const app = createApp({ auth, db, breach, limits })
  await new Promise((resolve) => {
    server = app.listen(0, resolve)
  })
  base = `http://127.0.0.1:${server.address().port}`
})

afterAll(() => new Promise((resolve) => server.close(resolve)))

beforeEach(() => {
  fakes = makeFakes()
  fakes.breached = new Set(['Leaked-but-long-1'])
  currentLimits = createAuthLimits()
})

// A tiny browser: remembers the session cookie between requests.
function browser() {
  let cookie = null
  async function call(method, path, body, extraHeaders = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) {
      const pair = setCookie.split(';')[0]
      cookie = pair.endsWith('=') ? null : pair
    }
    const data = await res.json().catch(() => null)
    return { status: res.status, data, setCookie }
  }
  return {
    get: (p) => call('GET', p),
    post: (p, b, h) => call('POST', p, b ?? {}, h),
    put: (p, b) => call('PUT', p, b),
    del: (p, b) => call('DELETE', p, b ?? {}),
    get cookie() {
      return cookie
    },
  }
}

// Registers, confirms through the email link and returns a signed-in browser.
async function confirmedUser(email, password = 'Blue-garden-42', timeZone = 'America/New_York') {
  const b = browser()
  await b.post('/api/auth/register', { email, password, timeZone })
  await b.post('/api/auth/confirm', { tokenHash: `confirm-${email}`, type: 'email' })
  return b
}

// ---------------------------------------------------------------- tests

describe('register (S3.2)', () => {
  it('needs a valid email and a password of at least 8 characters', async () => {
    const b = browser()
    expect((await b.post('/api/auth/register', { email: 'nope', password: 'Blue-garden-42' })).status).toBe(400)
    const short = await b.post('/api/auth/register', { email: 'a@x.com', password: 'Abc-123' })
    expect(short.status).toBe(400)
    expect(short.data.error).toBe('invalid_password')
  })

  it('creates the account, stores the browser time zone, and waits for confirmation', async () => {
    const b = browser()
    const res = await b.post('/api/auth/register', { email: 'A@X.com ', password: 'Blue-garden-42', timeZone: 'Asia/Tashkent' })
    expect(res.status).toBe(201)
    expect(res.data.needsConfirmation).toBe(true)
    expect(b.cookie).toBeNull() // not signed in until confirmed
    const user = fakes.users.get('a@x.com')
    expect(fakes.profiles.get(user.id).time_zone).toBe('Asia/Tashkent')
  })

  it('falls back to UTC for an unknown time zone', async () => {
    await browser().post('/api/auth/register', { email: 'a@x.com', password: 'Blue-garden-42', timeZone: 'Mars/Base' })
    expect(fakes.profiles.get(fakes.users.get('a@x.com').id).time_zone).toBe('UTC')
  })

  it('refuses an email that already has an account and points to sign-in', async () => {
    await browser().post('/api/auth/register', { email: 'a@x.com', password: 'Blue-garden-42' })
    const again = await browser().post('/api/auth/register', { email: 'a@x.com', password: 'Different-tree-99' })
    expect(again.status).toBe(409)
    expect(again.data.message).toMatch(/sign in/i)
  })

  it('cannot sign in before confirming, and resend always answers ok', async () => {
    const b = browser()
    await b.post('/api/auth/register', { email: 'a@x.com', password: 'Blue-garden-42' })
    const res = await b.post('/api/auth/login', { email: 'a@x.com', password: 'Blue-garden-42' })
    expect(res.status).toBe(403)
    expect(res.data.error).toBe('email_not_confirmed')
    expect((await b.post('/api/auth/resend', { email: 'a@x.com' })).status).toBe(200)
    expect((await b.post('/api/auth/resend', { email: 'nobody@x.com' })).status).toBe(200)
  })

  it('confirming the email link signs the user in; a used link fails', async () => {
    const b = browser()
    await b.post('/api/auth/register', { email: 'a@x.com', password: 'Blue-garden-42' })
    const res = await b.post('/api/auth/confirm', { tokenHash: 'confirm-a@x.com', type: 'email' })
    expect(res.status).toBe(200)
    expect((await b.get('/api/auth/session')).data).toMatchObject({ signedIn: true, email: 'a@x.com' })
    const reused = await browser().post('/api/auth/confirm', { tokenHash: 'confirm-a@x.com', type: 'email' })
    expect(reused.status).toBe(400)
  })
})

describe('sign in and out (S3.3)', () => {
  it('gives the identical message for an unknown email and a wrong password', async () => {
    await confirmedUser('a@x.com')
    const unknown = await browser().post('/api/auth/login', { email: 'b@x.com', password: 'Blue-garden-42' })
    const wrong = await browser().post('/api/auth/login', { email: 'a@x.com', password: 'wrongpass1' })
    expect(unknown.status).toBe(401)
    expect(wrong.status).toBe(401)
    expect(unknown.data).toEqual(wrong.data)
  })

  it('sets an HttpOnly, SameSite=Lax cookie and never returns a token in the body', async () => {
    await confirmedUser('a@x.com')
    const res = await browser().post('/api/auth/login', { email: 'a@x.com', password: 'Blue-garden-42' })
    expect(res.status).toBe(200)
    expect(res.setCookie).toMatch(/HttpOnly/i)
    expect(res.setCookie).toMatch(/SameSite=Lax/i)
    expect(JSON.stringify(res.data)).not.toMatch(/access|refresh|token/i)
  })

  it('signing out ends access, even with a copy of the old cookie', async () => {
    const b = await confirmedUser('a@x.com')
    const stolenCookie = b.cookie
    await b.post('/api/auth/logout')
    expect((await b.get('/api/auth/session')).data.signedIn).toBe(false)
    const replay = await fetch(`${base}/api/profile`, { headers: { Cookie: stolenCookie } })
    expect(replay.status).toBe(401)
  })
})

describe('password reset (S3.4)', () => {
  it('reset always answers ok, so it does not reveal which emails exist', async () => {
    await confirmedUser('a@x.com')
    const known = await browser().post('/api/auth/reset', { email: 'a@x.com' })
    const unknown = await browser().post('/api/auth/reset', { email: 'nobody@x.com' })
    expect(known.status).toBe(200)
    expect(unknown.data).toEqual(known.data)
  })

  it('the link sets a new password, the old one fails, and other devices are signed out', async () => {
    const laptop = await confirmedUser('a@x.com', 'Old-river-stone-7')
    const phone = browser()
    await phone.post('/api/auth/reset', { email: 'a@x.com' })
    expect((await phone.post('/api/auth/confirm', { tokenHash: 'reset-a@x.com', type: 'recovery' })).status).toBe(200)
    expect((await phone.post('/api/auth/new-password', { password: 'New-maple-cloud-9' })).status).toBe(200)

    expect((await laptop.get('/api/profile')).status).toBe(401)
    expect((await phone.get('/api/profile')).status).toBe(200)
    expect((await browser().post('/api/auth/login', { email: 'a@x.com', password: 'Old-river-stone-7' })).status).toBe(401)
    expect((await browser().post('/api/auth/login', { email: 'a@x.com', password: 'New-maple-cloud-9' })).status).toBe(200)
  })

  it('setting a new password needs a session and a valid password', async () => {
    expect((await browser().post('/api/auth/new-password', { password: 'New-maple-cloud-9' })).status).toBe(401)
    const b = await confirmedUser('a@x.com')
    expect((await b.post('/api/auth/new-password', { password: 'short' })).status).toBe(400)
    expect((await b.post('/api/auth/new-password', { password: 'Leaked-but-long-1' })).status).toBe(400)
  })
})

describe('delete account (S3.6)', () => {
  it('needs the typed confirmation, then removes the user and their rows', async () => {
    const b = await confirmedUser('a@x.com')
    const id = fakes.users.get('a@x.com').id
    expect((await b.del('/api/account', {})).status).toBe(400)
    expect(fakes.users.has('a@x.com')).toBe(true)

    const res = await b.del('/api/account', { confirm: 'DELETE', password: 'Blue-garden-42' })
    expect(res.status).toBe(200)
    expect(fakes.users.has('a@x.com')).toBe(false)
    expect(fakes.profiles.has(id)).toBe(false)
    expect((await b.get('/api/auth/session')).data.signedIn).toBe(false)
  })

  it('a guest cannot delete anything', async () => {
    expect((await browser().del('/api/account', { confirm: 'DELETE', password: 'Blue-garden-42' })).status).toBe(401)
  })
})

describe('two users (NFR5, route layer)', () => {
  it('each user only ever sees and changes their own profile', async () => {
    const a = await confirmedUser('a@x.com', 'Blue-garden-42', 'Europe/London')
    const b = await confirmedUser('b@x.com', 'Blue-garden-42', 'Asia/Tokyo')
    const bId = fakes.users.get('b@x.com').id

    expect((await a.get('/api/profile')).data).toMatchObject({ email: 'a@x.com', timeZone: 'Europe/London' })
    // A user id in the body or query is ignored: the session decides.
    await a.put(`/api/profile?user_id=${bId}`, { timeZone: 'America/Chicago', user_id: bId, userId: bId })
    expect(fakes.profiles.get(bId).time_zone).toBe('Asia/Tokyo')
    expect((await a.get('/api/profile')).data.timeZone).toBe('America/Chicago')
    expect((await b.get('/api/profile')).data.timeZone).toBe('Asia/Tokyo')

    // A cannot reach B's data through the admin route or delete B.
    expect((await a.get(`/api/admin/users/${bId}`)).status).toBe(403)
    await a.del('/api/account', { confirm: 'DELETE', password: 'Blue-garden-42', userId: bId })
    expect(fakes.users.has('b@x.com')).toBe(true)
  })
})

describe('admin (NFR5, NFR9)', () => {
  it('an admin read writes exactly one log row; a non-admin call fails and logs nothing', async () => {
    const admin = await confirmedUser('admin@x.com')
    const user = await confirmedUser('u@x.com')
    const adminId = fakes.users.get('admin@x.com').id
    const userId = fakes.users.get('u@x.com').id
    fakes.admins.add(adminId)

    expect((await user.get(`/api/admin/users/${adminId}`)).status).toBe(403)
    expect(fakes.adminLog).toHaveLength(0)

    const res = await admin.get(`/api/admin/users/${userId}`)
    expect(res.status).toBe(200)
    expect(fakes.adminLog).toEqual([{ adminId, subjectId: userId }])

    expect((await admin.get('/api/admin/stats')).data.users).toBe(2)
    expect((await user.get('/api/admin/stats')).status).toBe(403)
    expect((await admin.get('/api/auth/session')).data.isAdmin).toBe(true)
  })
})

describe('request safety', () => {
  it('blocks changes coming from another website (CSRF)', async () => {
    const b = await confirmedUser('a@x.com')
    const res = await b.del('/api/account', { confirm: 'DELETE', password: 'Blue-garden-42' })
    expect(res.status).toBe(200) // same-origin (no Origin header) works

    const c = await confirmedUser('c@x.com')
    const evil = await fetch(`${base}/api/account`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Cookie: c.cookie, Origin: 'https://evil.example' },
      body: JSON.stringify({ confirm: 'DELETE', password: 'Blue-garden-42' }),
    })
    expect(evil.status).toBe(403)
    expect(fakes.users.has('c@x.com')).toBe(true)
  })

  it('a damaged cookie is treated as signed out', async () => {
    const res = await fetch(`${base}/api/profile`, { headers: { Cookie: 'cf_session=not-base64-json' } })
    expect(res.status).toBe(401)
  })

  it('an error inside a route returns a generic message with no details', async () => {
    const b = await confirmedUser('a@x.com')
    fakes.db.getProfile = async () => {
      throw new Error('secret internal detail')
    }
    const res = await b.get('/api/profile')
    expect(res.status).toBe(500)
    expect(JSON.stringify(res.data)).not.toMatch(/secret internal detail/)
  })

  it('unknown /api paths return JSON 404', async () => {
    expect((await browser().get('/api/nope')).status).toBe(404)
  })
})

describe('password rules on the server (NIST-style)', () => {
  it('refuses common, patterned, email-based and breached passwords', async () => {
    const tries = {
      'Password2024!': 'common',
      '12345678': 'common',
      aaaaaaaa: 'repeated',
      abcdefgh: 'sequence',
      'Nadia-2024x': 'email',
      'Leaked-but-long-1': 'breach',
    }
    for (const password of Object.keys(tries)) {
      const res = await browser().post('/api/auth/register', { email: 'nadia@x.com', password })
      expect(res.status, password).toBe(400)
      expect(res.data.error).toBe('invalid_password')
    }
    expect(fakes.users.size).toBe(0)
    const good = await browser().post('/api/auth/register', { email: 'nadia@x.com', password: 'Blue-garden-42' })
    expect(good.status).toBe(201)
  })
})

describe('rate limits', () => {
  it('slows down repeated wrong passwords for one email, with the same answer for unknown emails', async () => {
    await confirmedUser('a@x.com')
    for (let i = 0; i < 5; i++) {
      expect((await browser().post('/api/auth/login', { email: 'a@x.com', password: `Wrong-${i}-xx` })).status).toBe(401)
      expect((await browser().post('/api/auth/login', { email: 'ghost@x.com', password: `Wrong-${i}-xx` })).status).toBe(401)
    }
    await browser().post('/api/auth/login', { email: 'a@x.com', password: 'Wrong-6-xx' })
    await browser().post('/api/auth/login', { email: 'ghost@x.com', password: 'Wrong-6-xx' })
    const known = await browser().post('/api/auth/login', { email: 'a@x.com', password: 'Blue-garden-42' })
    const unknown = await browser().post('/api/auth/login', { email: 'ghost@x.com', password: 'Blue-garden-42' })
    expect(known.status).toBe(429) // even the right password waits
    expect(unknown.status).toBe(429)
    expect(known.data).toEqual(unknown.data)
    // Another email is not affected.
    await confirmedUser('b@x.com')
    expect((await browser().post('/api/auth/login', { email: 'b@x.com', password: 'Blue-garden-42' })).status).toBe(200)
  })

  it('limits reset emails per address and says so with Retry-After', async () => {
    for (let i = 0; i < 3; i++) {
      expect((await browser().post('/api/auth/reset', { email: 'a@x.com' })).status).toBe(200)
    }
    const res = await fetch(`${base}/api/auth/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@x.com' }),
    })
    expect(res.status).toBe(429)
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0)
  })

  it('limits account creation per device', async () => {
    for (let i = 0; i < 10; i++) {
      await browser().post('/api/auth/register', { email: `u${i}@x.com`, password: 'Blue-garden-42' })
    }
    expect((await browser().post('/api/auth/register', { email: 'u99@x.com', password: 'Blue-garden-42' })).status).toBe(429)
  })
})

describe('delete needs the password again', () => {
  it('a wrong password removes nothing', async () => {
    const b = await confirmedUser('a@x.com')
    const res = await b.del('/api/account', { confirm: 'DELETE', password: 'Not-my-password-1' })
    expect(res.status).toBe(401)
    expect(fakes.users.has('a@x.com')).toBe(true)
    expect((await b.del('/api/account', { confirm: 'DELETE' })).status).toBe(401)
    expect(fakes.users.has('a@x.com')).toBe(true)
  })
})
