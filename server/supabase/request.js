// Shared helper for calling Supabase over HTTPS with the server's secret
// key. Used by authClient.js (sign-in) and dbClient.js (tables). The key
// comes only from an environment variable and is never sent to the browser.
const REQUEST_TIMEOUT_MS = 8000

export function supabaseUrl() {
  const url = process.env.SUPABASE_URL
  if (!url) throw new Error('SUPABASE_URL is not set')
  return url.replace(/\/$/, '')
}

function secretKey() {
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) throw new Error('SUPABASE_SECRET_KEY is not set')
  return key
}

// Calls Supabase and returns { ok, status, data }. Never throws for an HTTP
// error status (callers decide what a 400 means); it throws only when the
// network fails or times out.
//
// `userToken` is a signed-in user's access token. It goes in the
// Authorization header; the secret key always goes on `apikey` only (the new
// sb_secret_ keys are not JWTs and break if sent as a Bearer token).
export async function supabaseRequest(path, { method = 'GET', body, userToken, headers = {} } = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(`${supabaseUrl()}${path}`, {
      method,
      headers: {
        apikey: secretKey(),
        'Content-Type': 'application/json',
        ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await res.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { raw: text }
    }
    return { ok: res.ok, status: res.status, data }
  } finally {
    clearTimeout(timeout)
  }
}

// Supabase Auth reports errors in two shapes depending on version:
// { error_code: 'invalid_credentials', msg } or { error: 'invalid_grant',
// error_description }. This returns one lowercase string to match on.
export function authErrorCode(data) {
  if (!data || typeof data !== 'object') return ''
  return String(data.error_code || data.code || data.error || '').toLowerCase()
}

export function authErrorText(data) {
  if (!data || typeof data !== 'object') return ''
  return String(data.msg || data.error_description || data.message || '').toLowerCase()
}
