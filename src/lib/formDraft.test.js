import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearDraft, DRAFT_KEY, loadDraft, saveDraft } from './formDraft.js'
import { initialFormState, isValidFormState } from '../hooks/useZakatForm.js'

function fakeStorage() {
  const store = new Map()
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    has: (k) => store.has(k),
  }
}

const PRICES = { goldUsdPerGram: 134.34, silverUsdPerGram: 1.96, fetchedAt: '2026-11-01T06:00:12Z' }

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: fakeStorage(), sessionStorage: fakeStorage() })
})

describe('in-progress form survives a reload (M5 unknown 1)', () => {
  it('restores the entries, the step and an on-screen result', () => {
    const form = { ...initialFormState(), cashCents: '1234.56', nisab: 'gold' }
    saveDraft({ form, stepIndex: 4, pricesUsed: PRICES, showResult: true, reviewReached: true })
    expect(loadDraft(isValidFormState, 11)).toEqual({
      form,
      stepIndex: 4,
      pricesUsed: PRICES,
      showResult: true,
      reviewReached: true,
    })
  })

  it('treats a missing or odd reviewReached as not reached', () => {
    saveDraft({ form: initialFormState(), stepIndex: 2, pricesUsed: null, showResult: false, reviewReached: 'yes' })
    expect(loadDraft(isValidFormState, 11).reviewReached).toBe(false)
  })

  it('keeps it in sessionStorage, not localStorage', () => {
    saveDraft({ form: initialFormState(), stepIndex: 0, pricesUsed: null, showResult: false })
    expect(window.sessionStorage.has(DRAFT_KEY)).toBe(true)
    expect(window.localStorage.has(DRAFT_KEY)).toBe(false)
  })

  it('removes the old pre-M5 localStorage copy', () => {
    window.localStorage.setItem('charityflow.zakat.guestSave.v1', '{}')
    loadDraft(isValidFormState, 11)
    expect(window.localStorage.has('charityflow.zakat.guestSave.v1')).toBe(false)
  })

  it('ignores damaged or out-of-range drafts', () => {
    window.sessionStorage.setItem(DRAFT_KEY, 'nope')
    expect(loadDraft(isValidFormState, 11)).toBeNull()
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, data: { form: { cashCents: '1' } } }))
    expect(loadDraft(isValidFormState, 11)).toBeNull()
    saveDraft({ form: initialFormState(), stepIndex: 99, pricesUsed: { goldUsdPerGram: -1 }, showResult: true })
    expect(loadDraft(isValidFormState, 11)).toMatchObject({ stepIndex: 0, pricesUsed: null, showResult: false })
  })

  it('start over clears it', () => {
    saveDraft({ form: initialFormState(), stepIndex: 2, pricesUsed: null, showResult: false })
    clearDraft()
    expect(loadDraft(isValidFormState, 11)).toBeNull()
  })

  it('works (without saving) when storage is blocked', () => {
    vi.stubGlobal('window', {
      get sessionStorage() {
        throw new Error('SecurityError')
      },
      get localStorage() {
        throw new Error('SecurityError')
      },
    })
    expect(() => saveDraft({ form: initialFormState(), stepIndex: 0 })).not.toThrow()
    expect(loadDraft(isValidFormState, 11)).toBeNull()
  })
})
