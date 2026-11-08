// Small input checks shared by the account routes.

// Loose on purpose: Supabase does the real check. This only stops obvious junk.
export function isEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

// S3.2: at least 8 characters. 72 is the most Supabase's hashing uses.
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 72
export function isValidPassword(value) {
  return typeof value === 'string' && value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX
}

// A real IANA time zone name such as America/New_York, or null.
export function cleanTimeZone(value) {
  if (typeof value !== 'string' || value.length > 64) return null
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return value
  } catch {
    return null
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isUuid(value) {
  return typeof value === 'string' && UUID.test(value)
}
