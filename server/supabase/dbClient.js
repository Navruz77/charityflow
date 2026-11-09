// Database reads and writes for account data, through Supabase's REST API
// with the secret key. The secret key bypasses row-level security, so EVERY
// function here takes the signed-in user's id and filters by it. Never add a
// function that reads or writes user rows without a user id.
import { supabaseRequest } from './request.js'

const CALC_COLUMNS = 'id,saved_at,zakat_date,nisab_choice,inputs,prices_used,result'

function fail(what, res) {
  return new Error(`${what} failed with ${res.status}`)
}

export const dbClient = {
  async getProfile(userId) {
    const res = await supabaseRequest(
      `/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}&select=time_zone,zakat_date,zakat_hijri_month,zakat_hijri_day,created_at`,
    )
    if (!res.ok) throw fail('profile read', res)
    return res.data[0] ?? null
  },

  // Creates the profile row if it does not exist yet; leaves an existing one alone.
  async ensureProfile(userId, timeZone) {
    const res = await supabaseRequest('/rest/v1/profiles?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: { user_id: userId, time_zone: timeZone },
    })
    if (!res.ok) throw fail('profile create', res)
  },

  async updateTimeZone(userId, timeZone) {
    const res = await supabaseRequest(`/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: { time_zone: timeZone },
    })
    if (!res.ok) throw fail('profile update', res)
  },

  // ---- saved calculations (M5). Every query is filtered by user_id.

  // The user's saved calculations, newest first.
  async listCalculations(userId, limit) {
    const res = await supabaseRequest(
      `/rest/v1/calculations?user_id=eq.${encodeURIComponent(userId)}&select=${CALC_COLUMNS}&order=saved_at.desc&limit=${limit}`,
    )
    if (!res.ok) throw fail('calculations read', res)
    return res.data
  },

  // How many the user has saved (stops at `upTo`, which is all we need).
  async countCalculations(userId, upTo) {
    const res = await supabaseRequest(`/rest/v1/calculations?user_id=eq.${encodeURIComponent(userId)}&select=id&limit=${upTo}`)
    if (!res.ok) throw fail('calculations count', res)
    return res.data.length
  },

  // Adds rows for this user in one request (all or none). The user_id is
  // set here from the session, never taken from the browser.
  async insertCalculations(userId, rows) {
    const res = await supabaseRequest(`/rest/v1/calculations?select=${CALC_COLUMNS}`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: rows.map((row) => ({ ...row, user_id: userId })),
    })
    if (!res.ok) throw fail('calculations insert', res)
    return res.data
  },

  // Deletes one of the user's own calculations. Returns false if no such
  // row belongs to this user.
  async deleteCalculation(userId, id) {
    const res = await supabaseRequest(
      `/rest/v1/calculations?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&select=id`,
      { method: 'DELETE', headers: { Prefer: 'return=representation' } },
    )
    if (!res.ok) throw fail('calculation delete', res)
    return res.data.length > 0
  },

  // ---- Zakat date and reminders (M6). Every query is filtered by user_id.

  // date is YYYY-MM-DD or null (removes it); hijri month/day go with it.
  async setZakatDate(userId, { date, hijriMonth, hijriDay }) {
    const res = await supabaseRequest(`/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: { zakat_date: date, zakat_hijri_month: hijriMonth, zakat_hijri_day: hijriDay },
    })
    if (!res.ok) throw fail('zakat date update', res)
  },

  async getReminderPrefs(userId) {
    const res = await supabaseRequest(
      `/rest/v1/reminder_prefs?user_id=eq.${encodeURIComponent(userId)}&select=type,enabled,in_app,email`,
    )
    if (!res.ok) throw fail('reminder prefs read', res)
    return res.data
  },

  // Writes all four rows for this user (insert or update).
  async saveReminderPrefs(userId, prefs) {
    const res = await supabaseRequest('/rest/v1/reminder_prefs?on_conflict=user_id,type', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: prefs.map((p) => ({ user_id: userId, type: p.type, enabled: p.enabled, in_app: p.inApp, email: p.email })),
    })
    if (!res.ok) throw fail('reminder prefs save', res)
  },

  // The user's in-app reminders on or after `sinceDate` (YYYY-MM-DD).
  async listInAppReminders(userId, sinceDate, limit) {
    const res = await supabaseRequest(
      `/rest/v1/reminders_sent?user_id=eq.${encodeURIComponent(userId)}&channel=eq.inApp&local_date=gte.${encodeURIComponent(sinceDate)}` +
        `&select=type,local_date,created_at,read_at&order=local_date.desc,type.asc&limit=${limit}`,
    )
    if (!res.ok) throw fail('reminders read', res)
    return res.data
  },

  // Marks the user's unread in-app reminders as read: one ({ type,
  // localDate }) or all of them (no argument).
  async markRemindersRead(userId, one) {
    let filter = `user_id=eq.${encodeURIComponent(userId)}&channel=eq.inApp&read_at=is.null`
    if (one) filter += `&type=eq.${encodeURIComponent(one.type)}&local_date=eq.${encodeURIComponent(one.localDate)}`
    const res = await supabaseRequest(`/rest/v1/reminders_sent?${filter}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: { read_at: new Date().toISOString() },
    })
    if (!res.ok) throw fail('reminders mark read', res)
  },

  // ---- reminder job only (POST /api/jobs/reminders, after its JOB_TOKEN
  // check). These read across users by design; no route reachable by a
  // signed-in user calls them.

  // Every user with at least one reminder turned on, with their time zone
  // and Zakat Hijri month.
  async listReminderUsers() {
    const prefs = await supabaseRequest('/rest/v1/reminder_prefs?enabled=eq.true&select=user_id,type,enabled,in_app,email&limit=10000')
    if (!prefs.ok) throw fail('job prefs read', prefs)
    const ids = [...new Set(prefs.data.map((p) => p.user_id))]
    if (ids.length === 0) return []
    const users = new Map(ids.map((id) => [id, { userId: id, timeZone: 'UTC', zakatHijriMonth: null, prefs: [] }]))
    // In batches, to keep each URL short.
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100).map(encodeURIComponent).join(',')
      const res = await supabaseRequest(`/rest/v1/profiles?user_id=in.(${batch})&select=user_id,time_zone,zakat_hijri_month`)
      if (!res.ok) throw fail('job profiles read', res)
      for (const p of res.data) {
        const u = users.get(p.user_id)
        u.timeZone = p.time_zone || 'UTC'
        u.zakatHijriMonth = p.zakat_hijri_month ?? null
      }
    }
    for (const p of prefs.data) {
      users.get(p.user_id).prefs.push({ type: p.type, enabled: p.enabled, inApp: p.in_app, email: p.email })
    }
    return [...users.values()]
  },

  // Inserts one reminders_sent row. Returns true if it was new, false if
  // that user/type/channel/day already had one (the unique key, NFR8).
  async insertReminderSent({ userId, type, channel, localDate }) {
    const res = await supabaseRequest('/rest/v1/reminders_sent?on_conflict=user_id,type,channel,local_date&select=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: { user_id: userId, type, channel, local_date: localDate },
    })
    if (!res.ok) throw fail('reminder insert', res)
    return Array.isArray(res.data) && res.data.length > 0
  },

  // Undoes one insert when its email could not be sent, so the next run retries.
  async deleteReminderSent({ userId, type, channel, localDate }) {
    const q = `user_id=eq.${encodeURIComponent(userId)}&type=eq.${encodeURIComponent(type)}&channel=eq.${encodeURIComponent(channel)}&local_date=eq.${encodeURIComponent(localDate)}`
    const res = await supabaseRequest(`/rest/v1/reminders_sent?${q}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
    if (!res.ok) throw fail('reminder undo', res)
  },

  async isAdmin(userId) {
    const res = await supabaseRequest(`/rest/v1/admins?user_id=eq.${encodeURIComponent(userId)}&select=user_id`)
    if (!res.ok) throw fail('admin check', res)
    return res.data.length > 0
  },

  // Calls the logged admin function (writes one admin_access_log row).
  async adminReadUserData(adminId, subjectId) {
    const res = await supabaseRequest('/rest/v1/rpc/admin_read_user_data', {
      method: 'POST',
      body: { p_admin: adminId, p_subject: subjectId },
    })
    if (!res.ok) throw fail('admin read', res)
    return res.data
  },

  async adminStats(adminId) {
    const res = await supabaseRequest('/rest/v1/rpc/admin_stats', { method: 'POST', body: { p_admin: adminId } })
    if (!res.ok) throw fail('admin stats', res)
    return res.data
  },
}
