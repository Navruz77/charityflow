// Database reads and writes for account data, through Supabase's REST API
// with the secret key. The secret key bypasses row-level security, so EVERY
// function here takes the signed-in user's id and filters by it. Never add a
// function that reads or writes user rows without a user id.
import { supabaseRequest } from './request.js'

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
