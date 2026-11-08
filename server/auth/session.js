// The session lives in one HttpOnly cookie, so page scripts can never read
// the tokens inside it. The cookie holds the Supabase access token (short
// lived) and refresh token; every request re-checks them with Supabase.
export const COOKIE_NAME = 'cf_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

// Reads one cookie value from the Cookie header without a library.
export function readCookie(header, name) {
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return null
}

// { access, refresh } <-> cookie text (base64url JSON).
export function encodeSession(access, refresh) {
  return Buffer.from(JSON.stringify({ a: access, r: refresh })).toString('base64url')
}

export function decodeSession(value) {
  if (!value) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (typeof parsed.a === 'string' && typeof parsed.r === 'string') {
      return { access: parsed.a, refresh: parsed.r }
    }
  } catch {
    // fall through: a damaged cookie is treated as no session
  }
  return null
}

// Secure (HTTPS-only) whenever the request came in over HTTPS. On Render the
// app sits behind a proxy, so index.js sets "trust proxy" for req.secure.
function cookieOptions(req) {
  return { httpOnly: true, secure: req.secure, sameSite: 'lax', path: '/' }
}

export function setSessionCookie(req, res, access, refresh) {
  res.cookie(COOKIE_NAME, encodeSession(access, refresh), { ...cookieOptions(req), maxAge: MAX_AGE_SECONDS * 1000 })
}

export function clearSessionCookie(req, res) {
  res.clearCookie(COOKIE_NAME, cookieOptions(req))
}

// Works out who is signed in. Returns { user, accessToken } or null.
// Steps: check the access token with Supabase; if it was rejected (usually
// expired), try the refresh token once and store the new pair. If both fail
// the session is over (signed out, password reset elsewhere, or deleted).
// Throws only if Supabase could not be reached, so a network blip never
// signs anyone out.
export async function loadSession(req, res, auth) {
  const session = decodeSession(readCookie(req.headers.cookie, COOKIE_NAME))
  if (!session) return null

  const first = await auth.getUser(session.access)
  if (first.ok) return { user: toUser(first.data), accessToken: session.access }

  if (first.status >= 500) throw new Error(`auth check failed with ${first.status}`)

  const refreshed = await auth.refresh(session.refresh)
  if (refreshed.status >= 500) throw new Error(`token refresh failed with ${refreshed.status}`)
  if (!refreshed.ok || !refreshed.data?.access_token) {
    clearSessionCookie(req, res)
    return null
  }

  setSessionCookie(req, res, refreshed.data.access_token, refreshed.data.refresh_token)
  return { user: toUser(refreshed.data.user), accessToken: refreshed.data.access_token }
}

function toUser(u) {
  return { id: u.id, email: u.email }
}

// Route guard: only lets signed-in users through, and puts the user on
// req.user. Every route that touches user data must use this.
export function requireUser(auth) {
  return async (req, res, next) => {
    const session = await loadSession(req, res, auth)
    if (!session) {
      return res.status(401).json({ error: 'signed_out', message: 'Please sign in.' })
    }
    req.user = session.user
    req.accessToken = session.accessToken
    next()
  }
}
