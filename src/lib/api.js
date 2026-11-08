// Calls our own server's /api. The browser never talks to Supabase or any
// other service. The session cookie is HttpOnly, so it is sent by the
// browser automatically and page scripts never see it.
//
// Always resolves (never throws) to { ok, status, data }. status 0 means the
// request never reached the server (offline, or the server is asleep).
export async function api(method, path, body) {
  try {
    const res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, data }
  } catch {
    return {
      ok: false,
      status: 0,
      data: { message: 'Could not reach CharityFlow. Check your connection and try again.' },
    }
  }
}

// The browser's time zone name, e.g. "America/New_York" (sent when an
// account is created so reminders arrive on the user's local day).
export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
