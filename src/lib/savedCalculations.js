// Saved calculations (S4.1, S4.2, S3.5).
// Guests: kept only in this browser's localStorage under `cf.v1.saved`
// (Appendix B.3), newest first. Signed-in users: sent to our own server.
// Each saved calculation holds exactly the B.3 fields and nothing else:
// no names, emails or other identifiers (NFR4, NFR6).
import { loadGuestData, saveGuestData } from './storage.js'
import { toHijriDisplay } from './hijri.js'
import { api } from './api.js'

export const SAVED_KEY = 'cf.v1.saved'
export const MAX_GUEST_SAVES = 50 // keeps localStorage well under its size limit
export const TRANSFER_BATCH = 10 // must match MAX_PER_REQUEST on the server

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isCents = (v) => Number.isSafeInteger(v) && v >= 0

// Checks one saved calculation read back from storage. Anything that fails
// is skipped, so one damaged entry never hides the others.
export function isValidSavedCalculation(c) {
  return (
    isObject(c) &&
    typeof c.id === 'string' &&
    c.id.length > 0 &&
    c.id.length <= 64 &&
    typeof c.savedAt === 'string' &&
    !Number.isNaN(Date.parse(c.savedAt)) &&
    isObject(c.zakatDate) &&
    isObject(c.inputs) &&
    (c.nisabChoice === 'gold' || c.nisabChoice === 'silver') &&
    isObject(c.pricesUsed) &&
    Number(c.pricesUsed.goldUsdPerGram) > 0 &&
    Number(c.pricesUsed.silverUsdPerGram) > 0 &&
    typeof c.pricesUsed.fetchedAt === 'string' &&
    isObject(c.result) &&
    typeof c.result.status === 'string' &&
    isCents(c.result.zakatDueCents) &&
    isCents(c.result.netCents) &&
    Array.isArray(c.result.lines) &&
    isObject(c.result.nisab)
  )
}

function newId() {
  try {
    return crypto.randomUUID()
  } catch {
    // Older browsers: random enough for a local list key (not a secret).
    return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  }
}

// Builds the B.3 record from what the result screen shows.
export function buildSavedCalculation({ inputs, result, pricesUsed }) {
  const gregorian = inputs.zakatDate || null
  // Keep only the engine's own result fields (drop the screen's helpers).
  const { ok, errors, ...engineResult } = result
  void ok
  void errors
  return {
    id: newId(),
    savedAt: new Date().toISOString(),
    zakatDate: { gregorian, hijri: toHijriDisplay(gregorian) },
    inputs,
    nisabChoice: inputs.nisab,
    pricesUsed: {
      goldUsdPerGram: pricesUsed.goldUsdPerGram,
      silverUsdPerGram: pricesUsed.silverUsdPerGram,
      fetchedAt: pricesUsed.fetchedAt,
    },
    result: engineResult,
  }
}

// ---------------------------------------------------- on this device

export function loadGuestSaves() {
  const list = loadGuestData(SAVED_KEY, Array.isArray)
  return list ? list.filter(isValidSavedCalculation) : []
}

function writeGuestSaves(list) {
  return saveGuestData(SAVED_KEY, list, Array.isArray)
}

// Adds one to the front of the list. Returns { ok, reason }.
export function addGuestSave(calc) {
  const list = loadGuestSaves()
  if (list.length >= MAX_GUEST_SAVES) return { ok: false, reason: 'full' }
  return writeGuestSaves([calc, ...list]) ? { ok: true } : { ok: false, reason: 'storage' }
}

export function removeGuestSaves(ids) {
  const drop = new Set(ids)
  return writeGuestSaves(loadGuestSaves().filter((c) => !drop.has(c.id)))
}

// ------------------------------------------------------- in an account

// The fields the server accepts for one calculation (it ignores the rest).
function toServerShape(c) {
  return { savedAt: c.savedAt, inputs: c.inputs, nisabChoice: c.nisabChoice, pricesUsed: c.pricesUsed, result: c.result }
}

// Saves one calculation to the signed-in user's account.
// Resolves to { ok, offline, message }.
export async function saveToAccount(calc) {
  const res = await api('POST', '/api/calculations', { calculations: [toServerShape(calc)] })
  return { ok: res.ok, offline: res.status === 0, status: res.status, message: res.data?.message }
}

// S3.5: copies guest saves into the account in small batches. Each batch
// that the server accepts is removed from this device, so pressing "yes"
// twice can't add the same calculation twice. Stops at the first failure.
// Resolves to { added, remaining, offline, message }.
export async function transferGuestSaves(list = loadGuestSaves()) {
  let added = 0
  // Oldest first, so the account's "newest first" order matches the device.
  const oldestFirst = [...list].reverse()
  for (let i = 0; i < oldestFirst.length; i += TRANSFER_BATCH) {
    const batch = oldestFirst.slice(i, i + TRANSFER_BATCH)
    const res = await api('POST', '/api/calculations', { calculations: batch.map(toServerShape) })
    if (!res.ok) {
      return { added, remaining: list.length - added, offline: res.status === 0, message: res.data?.message }
    }
    removeGuestSaves(batch.map((c) => c.id))
    added += batch.length
  }
  return { added, remaining: 0 }
}

// ------------------------------------------- the transfer question (S3.5)
// "No" is kept in sessionStorage, so it is asked again in a new tab or
// after signing in again, but not on every page of this visit.
const DECLINED_KEY = 'cf.v1.transferDeclined'

export function transferDeclined() {
  try {
    return window.sessionStorage.getItem(DECLINED_KEY) === 'yes'
  } catch {
    return false
  }
}

export function rememberTransferDeclined() {
  try {
    window.sessionStorage.setItem(DECLINED_KEY, 'yes')
  } catch {
    // ignore: the prompt just stays hidden until the page reloads
  }
}

export function forgetTransferAnswer() {
  try {
    window.sessionStorage.removeItem(DECLINED_KEY)
  } catch {
    // ignore
  }
}
