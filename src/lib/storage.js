// Versioned localStorage wrapper for the guest save. Every read/write is
// wrapped in try/catch (localStorage can throw in private mode, be full,
// or hold data from an old app version) and validated with `isValid`.

const STORAGE_VERSION = 1

export function saveGuestData(key, data, isValid) {
  try {
    if (!isValid(data)) return false
    const payload = JSON.stringify({ version: STORAGE_VERSION, data })
    window.localStorage.setItem(key, payload)
    return true
  } catch {
    return false
  }
}

export function loadGuestData(key, isValid) {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== STORAGE_VERSION) return null
    if (!isValid(parsed.data)) return null
    return parsed.data
  } catch {
    return null
  }
}

export function clearGuestData(key) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore: nothing we can do if localStorage is unavailable
  }
}
