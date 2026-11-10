// Light/dark choice from the header switch. Kept in localStorage (B.3 key
// `cf.v1.theme`, only the word "light" or "dark", nothing personal) so it
// is the same on the next visit. No choice saved = follow the device.
// public/theme-init.js reads the same key before the page draws; keep the
// key and the stored format the same in both files.
import { loadGuestData, saveGuestData } from './storage.js'

export const THEME_KEY = 'cf.v1.theme'
const isTheme = (v) => v === 'light' || v === 'dark'

export function savedTheme() {
  return loadGuestData(THEME_KEY, isTheme)
}

export function deviceTheme() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

// The theme on screen right now.
export function currentTheme() {
  return savedTheme() ?? deviceTheme()
}

// Shows `theme` at once and remembers it (if the browser allows saving).
export function applyTheme(theme) {
  if (!isTheme(theme)) return
  document.documentElement.dataset.theme = theme
  saveGuestData(THEME_KEY, theme, isTheme)
}
