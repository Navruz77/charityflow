import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, currentTheme, savedTheme, THEME_KEY } from './theme.js'

function fakeStorage() {
  const store = new Map()
  return { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
}

let prefersDark
beforeEach(() => {
  prefersDark = false
  vi.stubGlobal('window', { localStorage: fakeStorage(), matchMedia: () => ({ matches: prefersDark }) })
  vi.stubGlobal('document', { documentElement: { dataset: {} } })
})

describe('light/dark switch', () => {
  it('follows the device until a choice is made', () => {
    expect(savedTheme()).toBe(null)
    expect(currentTheme()).toBe('light')
    prefersDark = true
    expect(currentTheme()).toBe('dark')
  })
  it('a choice shows at once and is remembered over the device setting', () => {
    prefersDark = true
    applyTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(savedTheme()).toBe('light')
    expect(currentTheme()).toBe('light')
  })
  it('stores only the word, in the shared versioned format', () => {
    applyTheme('dark')
    expect(JSON.parse(window.localStorage.getItem(THEME_KEY))).toEqual({ version: 1, data: 'dark' })
  })
  it('ignores anything else, saved or passed in', () => {
    window.localStorage.setItem(THEME_KEY, JSON.stringify({ version: 1, data: 'purple' }))
    expect(savedTheme()).toBe(null)
    applyTheme('purple')
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })
  it('still switches when storage is blocked', () => {
    window.localStorage.setItem = () => {
      throw new Error('blocked')
    }
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
