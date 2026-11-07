// The only code that touches the price_cache table. Talks to Supabase's
// REST API (PostgREST) directly over HTTPS with the service-role key, so
// no extra dependency is needed just for one table. The key lives only in
// a Render environment variable — never in the repo or the browser bundle.
const REQUEST_TIMEOUT_MS = 8000

function supabaseHeaders() {
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) throw new Error('SUPABASE_SECRET_KEY is not set')
  // Supabase's new sb_secret_/sb_publishable_ keys are short strings, not
  // JWTs, and must go on the apikey header only. Sending one as
  // Authorization: Bearer makes PostgREST try to parse it as a JWT, fail,
  // and fall back to the anon role -- which then gets a 403 from RLS.
  return {
    apikey: key,
    'Content-Type': 'application/json',
  }
}

function baseUrl() {
  const url = process.env.SUPABASE_URL
  if (!url) throw new Error('SUPABASE_URL is not set')
  return url.replace(/\/$/, '')
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

// Returns the single price_cache row, or null if the table is empty.
export async function getCachedRow() {
  const res = await fetchWithTimeout(`${baseUrl()}/rest/v1/price_cache?id=eq.1&select=*`, {
    headers: supabaseHeaders(),
  })
  if (!res.ok) throw new Error(`price_cache read failed with ${res.status}`)
  const rows = await res.json()
  return rows[0] ?? null
}

// Upserts the single price_cache row (id is always 1).
export async function saveCachedRow(row) {
  const res = await fetchWithTimeout(`${baseUrl()}/rest/v1/price_cache`, {
    method: 'POST',
    headers: { ...supabaseHeaders(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(row),
  })
  if (!res.ok) throw new Error(`price_cache write failed with ${res.status}`)
}
