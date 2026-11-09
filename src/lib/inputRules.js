// Input rules shared by every form and by the server, so both always agree.
//
// The `clean...Text` functions run on every keystroke and paste: they keep
// only the characters a field allows, so letters and symbols can't be typed
// into a number field at all. They return the cleaned text; the field shows
// exactly that. Checking the final value (range, required) happens on submit,
// and the server checks everything again on its own.

// Biggest amounts accepted anywhere (the server uses the same numbers).
export const MAX_DOLLAR_DIGITS = 13 // up to $9,999,999,999,999.99, still exact in integer cents
export const MAX_CENTS = 1e15
export const MAX_GRAMS_DIGITS = 9 // under a billion grams
export const MAX_ITEMS_PER_LIST = 25 // gems, holdings, properties, businesses...
export const DATE_MIN = '1900-01-01'
export const DATE_MAX = '2200-12-31'
// Planner (M7): goal and gift amounts, and the earliest gift date.
export const MAX_PLANNER_CENTS = 1e12 // $10,000,000,000.00
export const GIFT_DATE_MIN = '2000-01-01'
export const NAME_MAX = 100
export const RECIPIENT_MAX = 100
export const NOTE_MAX = 500
export const EMAIL_MAX = 254

// Keeps digits and one decimal point, with at most `maxInt` whole-number
// digits and `maxDecimals` decimals. Commas are allowed in the whole-number
// part when `commas` is true (people type "1,250.00"). Anything else —
// letters, "$", "-", "e", spaces, other scripts' digits — is dropped.
function cleanDecimal(text, { maxInt, maxDecimals, commas = false }) {
  if (typeof text !== 'string') return ''
  let out = ''
  let seenDot = false
  let intDigits = 0
  let decimals = 0
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') {
      if (seenDot) {
        if (decimals >= maxDecimals) continue
        decimals += 1
      } else {
        if (intDigits >= maxInt) continue
        intDigits += 1
      }
      out += ch
    } else if (ch === '.' && !seenDot && maxDecimals > 0) {
      seenDot = true
      out += ch
    } else if (ch === ',' && commas && !seenDot && intDigits > 0) {
      out += ch
    }
  }
  return out
}

// Dollar amounts: "1,250.50". Paste "$1,250.50" and the "$" is dropped.
export const cleanMoneyText = (text) => cleanDecimal(text, { maxInt: MAX_DOLLAR_DIGITS, maxDecimals: 2, commas: true })

// Grams of gold or silver: up to 4 decimals.
export const cleanGramsText = (text) => cleanDecimal(text, { maxInt: MAX_GRAMS_DIGITS, maxDecimals: 4 })

// Percentages 0 to 100, up to 2 decimals. A keystroke that would go above
// 100 is refused (the previous text is kept).
export function cleanPercentText(text, previous = '') {
  const out = cleanDecimal(text, { maxInt: 3, maxDecimals: 2 })
  return out !== '' && out !== '.' && Number(out) > 100 ? previous : out
}

// A real calendar date written YYYY-MM-DD, between DATE_MIN and DATE_MAX.
export function isValidIsoDate(value, { min = DATE_MIN, max = DATE_MAX } = {}) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const t = Date.parse(`${value}T00:00:00Z`)
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== value) return false
  return value >= min && value <= max
}

// Grams text -> a number (0 for blank), or null if it isn't a plain number.
export function gramsTextToNumber(text) {
  if (text === undefined || text === null || String(text).trim() === '') return 0
  const s = String(text).trim()
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) && n < 10 ** MAX_GRAMS_DIGITS ? n : null
}
