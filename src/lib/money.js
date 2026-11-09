// Money helpers. Money is always an integer number of cents.
import { MAX_CENTS, MAX_DOLLAR_DIGITS } from './inputRules.js'
// Dollar text from inputs is sanitized here, at the boundary, before it
// ever reaches the Zakat engine.

// Turns raw dollar text ("9,851.34", "", "-5", "abc") into integer cents.
// Blank means $0. Anything that isn't a non-negative amount with at most 2
// decimals, or is above the app-wide maximum, returns null so the caller
// can show a field error instead of silently guessing.
// Works with whole numbers only (dollars and cents read separately), so no
// floating-point rounding ever touches money.
export function dollarsTextToCents(text) {
  if (text === undefined || text === null) return 0
  const trimmed = String(text).trim()
  if (trimmed === '') return 0
  // Commas only as thousands separators in the whole-dollar part.
  const match = /^(\d{1,3}(?:,\d{3})+|\d*)(?:\.(\d{0,2}))?$/.exec(trimmed)
  if (!match || (match[1] === '' && !match[2])) return null
  const dollars = match[1].replace(/,/g, '')
  if (dollars.length > MAX_DOLLAR_DIGITS) return null
  const cents = Number(dollars || '0') * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents : null
}

// Like dollarsTextToCents, but blank/missing returns null instead of 0 —
// used where "not entered" must be told apart from "entered as $0" (e.g.
// gold/silver value, where blank means "price the grams instead").
export function dollarsTextToCentsOrNull(text) {
  if (text === undefined || text === null) return null
  if (String(text).trim() === '') return null
  return dollarsTextToCents(text)
}

// Formats integer cents as "$1,234.56".
export function centsToDisplay(cents) {
  const n = Number(cents)
  if (!Number.isFinite(n)) return '$0.00'
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(Math.round(n))
  const dollars = Math.floor(abs / 100)
  const rem = String(abs % 100).padStart(2, '0')
  return `${sign}$${dollars.toLocaleString('en-US')}.${rem}`
}

// Turns raw percent text into a 0-100 number, or null if invalid.
export function percentTextToNumber(text) {
  if (text === undefined || text === null) return null
  const trimmed = String(text).trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < 0 || n > 100) return null
  return n
}
