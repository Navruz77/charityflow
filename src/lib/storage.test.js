import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveGuestData, loadGuestData, clearGuestData } from './storage.js'

// Minimal in-memory localStorage + window, since tests run in a node
// environment with no browser globals.
function makeFakeStorage() {
  const store = new Map()
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  }
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: makeFakeStorage() })
})

const isValid = (data) => typeof data === 'object' && data !== null && 'x' in data

describe('saveGuestData / loadGuestData', () => {
  it('round-trips valid data', () => {
    expect(saveGuestData('k', { x: 1 }, isValid)).toBe(true)
    expect(loadGuestData('k', isValid)).toEqual({ x: 1 })
  })

  it('refuses to save invalid data', () => {
    expect(saveGuestData('k', { y: 1 }, isValid)).toBe(false)
  })

  it('returns null for missing keys', () => {
    expect(loadGuestData('missing', isValid)).toBeNull()
  })

  it('returns null for corrupted JSON', () => {
    window.localStorage.setItem('k', 'not json')
    expect(loadGuestData('k', isValid)).toBeNull()
  })

  it('returns null for a different storage version', () => {
    window.localStorage.setItem('k', JSON.stringify({ version: 999, data: { x: 1 } }))
    expect(loadGuestData('k', isValid)).toBeNull()
  })

  it('returns null when stored data no longer passes validation', () => {
    window.localStorage.setItem('k', JSON.stringify({ version: 1, data: { y: 1 } }))
    expect(loadGuestData('k', isValid)).toBeNull()
  })

  it('clearGuestData removes the key', () => {
    saveGuestData('k', { x: 1 }, isValid)
    clearGuestData('k')
    expect(loadGuestData('k', isValid)).toBeNull()
  })
})
