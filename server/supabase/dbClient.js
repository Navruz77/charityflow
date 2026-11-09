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
