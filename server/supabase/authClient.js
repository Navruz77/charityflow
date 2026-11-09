// Supabase Auth (sign-up, sign-in, reset, delete), called only from our
// server. Each function returns { ok, status, data } from supabaseRequest.
// Routes depend on this object, so tests can pass a fake one instead.
import { supabaseRequest } from './request.js'

export const authClient = {
  // Creates the sign-in record. Supabase emails the confirmation link.
  signUp(email, password) {
    return supabaseRequest('/auth/v1/signup', { method: 'POST', body: { email, password } })
  },

  // Email + password sign-in. Returns access_token, refresh_token, user.
  signIn(email, password) {
    return supabaseRequest('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: { email, password },
    })
  },

  // Swaps a refresh token for a new access token (they last about 1 hour).
  refresh(refreshToken) {
    return supabaseRequest('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: { refresh_token: refreshToken },
    })
  },

  // Checks an access token with Supabase and returns the user. Fails once
  // the session was signed out, even if the token has not expired yet.
  getUser(accessToken) {
    return supabaseRequest('/auth/v1/user', { userToken: accessToken })
  },

  // scope: 'local' (this device), 'others' (every other device) or 'global'.
  signOut(accessToken, scope = 'local') {
    return supabaseRequest(`/auth/v1/logout?scope=${scope}`, { method: 'POST', userToken: accessToken })
  },

  resendSignup(email) {
    return supabaseRequest('/auth/v1/resend', { method: 'POST', body: { type: 'signup', email } })
  },

  // Sends the password-reset email.
  recover(email) {
    return supabaseRequest('/auth/v1/recover', { method: 'POST', body: { email } })
  },

  // Exchanges the token_hash from an email link for a session.
  // type is 'email' (sign-up confirmation) or 'recovery' (password reset).
  verify(tokenHash, type) {
    return supabaseRequest('/auth/v1/verify', { method: 'POST', body: { token_hash: tokenHash, type } })
  },

  updatePassword(accessToken, password) {
    return supabaseRequest('/auth/v1/user', { method: 'PUT', userToken: accessToken, body: { password } })
  },

  // The user's email address, for the reminder job only (M6). Read with the
  // secret key; returns the address or null.
  async getUserEmail(userId) {
    const res = await supabaseRequest(`/auth/v1/admin/users/${encodeURIComponent(userId)}`)
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`user lookup failed with ${res.status}`)
    return typeof res.data?.email === 'string' ? res.data.email : null
  },

  // Permanently removes the sign-in record using the secret key. The
  // database's "on delete cascade" then removes every row the user owns.
  deleteUser(userId) {
    return supabaseRequest(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' })
  },
}
