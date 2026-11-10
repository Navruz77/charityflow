// Keeps the half-filled calculator in sessionStorage so nothing is lost if
// the page reloads, for example when a new app version installs itself
// (M5 unknown 1, autoUpdate). sessionStorage lasts only while this tab is
// open, so a shared computer doesn't keep someone's figures after they
// close the tab. Every read and write is wrapped in try/catch and checked.

export const DRAFT_KEY = 'cf.v1.draft'
const DRAFT_VERSION = 2 // 2: gems step removed, unpaid-Zakat step added

// Before M5 the form was kept in localStorage under this key. B.3 allows
// only three localStorage keys, so it is removed on load.
const OLD_LOCAL_KEY = 'charityflow.zakat.guestSave.v1'

function session() {
  try {
    return window.sessionStorage
  } catch {
    return null // storage blocked (some private modes)
  }
}

// `isValidForm` comes from useZakatForm so both agree on the form's shape.
export function loadDraft(isValidForm, maxStep) {
  try {
    window.localStorage.removeItem(OLD_LOCAL_KEY)
  } catch {
    // ignore
  }
  try {
    const raw = session()?.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== DRAFT_VERSION) return null
    const d = parsed.data
    if (!d || !isValidForm(d.form)) return null
    const stepIndex = Number.isInteger(d.stepIndex) && d.stepIndex >= 0 && d.stepIndex <= maxStep ? d.stepIndex : 0
    const p = d.pricesUsed
    const pricesUsed =
      p && Number(p.goldUsdPerGram) > 0 && Number(p.silverUsdPerGram) > 0 && typeof p.fetchedAt === 'string' ? p : null
    return {
      form: d.form,
      stepIndex,
      pricesUsed,
      showResult: d.showResult === true && pricesUsed !== null,
      reviewReached: d.reviewReached === true,
    }
  } catch {
    return null
  }
}

export function saveDraft(draft) {
  try {
    session()?.setItem(DRAFT_KEY, JSON.stringify({ version: DRAFT_VERSION, data: draft }))
  } catch {
    // full or blocked: the form still works, it just won't survive a reload
  }
}

export function clearDraft() {
  try {
    session()?.removeItem(DRAFT_KEY)
  } catch {
    // ignore
  }
}
