// Checks a calculation the browser wants to save (S4.2, S3.5) and builds a
// clean copy of it. Nothing from the request is stored as-is:
//   * `inputs` is rebuilt field by field from an allowlist (B.4), so unknown
//     keys, huge lists and wrong types never reach the database.
//   * the result is worked out again on the server with the same engine and
//     the same prices, and must match what the browser showed. The stored
//     result is the server's own copy, so a saved row can't hold numbers the
//     engine never produced.
import { calculateZakat } from '../../src/engine/calculateZakat.js'

// Limits that keep one row small. Far above anything a real person enters.
export const MAX_ITEMS_PER_LIST = 25
const MAX_CENTS = 1e15 // $10 trillion, still an exact integer in JavaScript
const MAX_GRAMS = 1e9
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const OLDEST_SAVE = Date.parse('2026-01-01T00:00:00Z')
const CLOCK_SKEW_MS = 5 * 60 * 1000

// Same sanity band the price route uses (B.2).
const PRICE_BAND = { goldUsdPerGram: [20, 1000], silverUsdPerGram: [0.2, 100] }

// Each check throws this; the route turns it into a 400 naming the field.
class Invalid extends Error {
  constructor(field) {
    super(`invalid ${field}`)
    this.field = field
  }
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

function cents(v, field) {
  if (!Number.isSafeInteger(v) || v < 0 || v > MAX_CENTS) throw new Invalid(field)
  return v
}

// Gold/silver value may be null ("price the grams instead").
function centsOrNull(v, field) {
  return v === null || v === undefined ? null : cents(v, field)
}

// Optional percentage: undefined means "use the engine's default".
function pctOrDefault(v, field) {
  if (v === undefined || v === null || v === '') return undefined
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) throw new Invalid(field)
  return v
}

// The screens send grams as typed text ("51", "" or "12.5"). Stored as a number.
function grams(v, field) {
  if (v === undefined || v === null || v === '') return 0
  const n = typeof v === 'string' && v.length <= 32 && /^\s*(\d+\.?\d*|\.\d+)\s*$/.test(v) ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > MAX_GRAMS) throw new Invalid(field)
  return n
}

function oneOf(v, allowed, field) {
  if (!allowed.includes(v)) throw new Invalid(field)
  return v
}

function list(v, field, cleanItem) {
  if (v === undefined) return []
  if (!Array.isArray(v) || v.length > MAX_ITEMS_PER_LIST) throw new Invalid(field)
  return v.map((item, i) => {
    if (!isObject(item)) throw new Invalid(`${field}[${i}]`)
    return cleanItem(item, `${field}[${i}]`)
  })
}

function metal(v, field) {
  if (!isObject(v)) throw new Invalid(field)
  return { grams: grams(v.grams, `${field}.grams`), valueCents: centsOrNull(v.valueCents, `${field}.valueCents`) }
}

// Rebuilds the engine inputs (B.4) from an allowlist.
export function cleanInputs(raw) {
  if (!isObject(raw)) throw new Invalid('inputs')
  const debts = isObject(raw.debts) ? raw.debts : null
  if (!debts) throw new Invalid('inputs.debts')
  return {
    cashCents: cents(raw.cashCents, 'cashCents'),
    savingsCents: cents(raw.savingsCents, 'savingsCents'),
    gold: metal(raw.gold, 'gold'),
    silver: metal(raw.silver, 'silver'),
    gems: list(raw.gems, 'gems', (g, f) => ({
      purpose: oneOf(g.purpose, ['personal', 'resale'], `${f}.purpose`),
      valueCents: cents(g.valueCents, `${f}.valueCents`),
    })),
    securities: list(raw.securities, 'securities', (s, f) => ({
      purpose: oneOf(s.purpose, ['trade', 'longTerm'], `${f}.purpose`),
      countInFull: oneOf(s.countInFull ?? false, [true, false], `${f}.countInFull`),
      valueCents: cents(s.valueCents, `${f}.valueCents`),
      zakatableSharePct: pctOrDefault(s.zakatableSharePct, `${f}.zakatableSharePct`),
    })),
    crypto: list(raw.crypto, 'crypto', (c, f) => ({
      purpose: oneOf(c.purpose, ['trade', 'longTerm'], `${f}.purpose`),
      valueCents: cents(c.valueCents, `${f}.valueCents`),
    })),
    realEstateForSale: list(raw.realEstateForSale, 'realEstateForSale', (p, f) => ({
      valueCents: cents(p.valueCents, `${f}.valueCents`),
    })),
    rentals: list(raw.rentals, 'rentals', (r, f) => ({
      rentCollectedUnspentCents: cents(r.rentCollectedUnspentCents, `${f}.rentCollectedUnspentCents`),
      expensesPaidCents: cents(r.expensesPaidCents, `${f}.expensesPaidCents`),
    })),
    businesses: list(raw.businesses, 'businesses', (b, f) => ({
      ownershipPct: pctOrDefault(b.ownershipPct, `${f}.ownershipPct`),
      cashCents: cents(b.cashCents, `${f}.cashCents`),
      inventoryCents: cents(b.inventoryCents, `${f}.inventoryCents`),
      receivablesCents: cents(b.receivablesCents, `${f}.receivablesCents`),
      liabilitiesCents: cents(b.liabilitiesCents, `${f}.liabilitiesCents`),
    })),
    retirement: list(raw.retirement, 'retirement', (r, f) => ({
      method: oneOf(r.method, ['annual', 'whenAccessible'], `${f}.method`),
      vestedBalanceCents: cents(r.vestedBalanceCents, `${f}.vestedBalanceCents`),
      zakatableSharePct: pctOrDefault(r.zakatableSharePct, `${f}.zakatableSharePct`),
      penaltyTaxCents: cents(r.penaltyTaxCents ?? 0, `${f}.penaltyTaxCents`),
    })),
    debts: {
      dueNowCents: cents(debts.dueNowCents, 'debts.dueNowCents'),
      installments12mCents: cents(debts.installments12mCents, 'debts.installments12mCents'),
    },
    nisab: oneOf(raw.nisab, ['gold', 'silver'], 'nisab'),
    heldOneLunarYear: oneOf(raw.heldOneLunarYear, [true, false], 'heldOneLunarYear'),
    zakatDate: raw.zakatDate === null || raw.zakatDate === undefined || raw.zakatDate === '' ? null : isoDate(raw.zakatDate, 'zakatDate'),
  }
}

function isoDate(v, field) {
  if (typeof v !== 'string' || !ISO_DATE.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw new Invalid(field)
  return v
}

// A timestamp in the past (small clock skew allowed), not before 2026.
function pastTimestamp(v, field, now) {
  const t = typeof v === 'string' && v.length <= 40 ? Date.parse(v) : NaN
  if (Number.isNaN(t) || t < OLDEST_SAVE || t > now + CLOCK_SKEW_MS) throw new Invalid(field)
  return new Date(t).toISOString()
}

export function cleanPrices(raw, now) {
  if (!isObject(raw)) throw new Invalid('pricesUsed')
  const out = {}
  for (const [key, [low, high]] of Object.entries(PRICE_BAND)) {
    const v = raw[key]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < low || v > high) throw new Invalid(`pricesUsed.${key}`)
    out[key] = v
  }
  out.fetchedAt = pastTimestamp(raw.fetchedAt, 'pricesUsed.fetchedAt', now)
  return out
}

// The figures the person saw on screen. They must equal the server's own run.
const COMPARED = [
  ['status', (r) => r.status],
  ['zakatDueCents', (r) => r.zakatDueCents],
  ['netCents', (r) => r.netCents],
  ['totalZakatableCents', (r) => r.totalZakatableCents],
  ['nisab.valueCents', (r) => r.nisab?.valueCents],
]

// Returns { ok: true, row } ready for the database, or { ok: false, field }.
// `body` is one calculation in the B.3 shape: { savedAt?, zakatDate?,
// inputs, nisabChoice, pricesUsed, result }.
export function cleanCalculation(body, now = Date.now()) {
  try {
    if (!isObject(body)) throw new Invalid('calculation')
    const inputs = cleanInputs(body.inputs)
    if (body.nisabChoice !== inputs.nisab) throw new Invalid('nisabChoice')
    const pricesUsed = cleanPrices(body.pricesUsed, now)
    const savedAt = body.savedAt === undefined ? new Date(now).toISOString() : pastTimestamp(body.savedAt, 'savedAt', now)

    const result = calculateZakat(inputs, pricesUsed)
    if (!result.ok || !['due', 'belowNisab', 'notYetDue'].includes(result.status)) throw new Invalid('inputs')
    if (!isObject(body.result)) throw new Invalid('result')
    for (const [field, pick] of COMPARED) {
      if (pick(body.result) !== pick(result)) throw new Invalid(`result.${field}`)
    }

    return {
      ok: true,
      row: {
        saved_at: savedAt,
        zakat_date: inputs.zakatDate,
        nisab_choice: inputs.nisab,
        inputs,
        prices_used: pricesUsed,
        result: { ...result, pricesUsed: { ...result.pricesUsed, fetchedAt: pricesUsed.fetchedAt } },
      },
    }
  } catch (err) {
    if (err instanceof Invalid) return { ok: false, field: err.field }
    throw err
  }
}

// Database row -> the shape the browser uses (same as a guest save, B.3).
export function rowToCalculation(row) {
  return {
    id: row.id,
    savedAt: row.saved_at,
    zakatDate: { gregorian: row.zakat_date ?? null },
    inputs: row.inputs,
    nisabChoice: row.nisab_choice,
    pricesUsed: row.prices_used,
    result: row.result,
  }
}
