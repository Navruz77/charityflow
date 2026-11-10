import { useState } from 'react'
import { calculateZakat, DEBT_FIELDS } from '../engine/calculateZakat.js'
import { dollarsTextToCents, dollarsTextToCentsOrNull, percentTextToNumber } from '../lib/money.js'
import { gramsTextToNumber, isValidIsoDate } from '../lib/inputRules.js'

export const emptySecurity = () => ({ valueCents: '', purpose: 'longTerm', countInFull: false, zakatableSharePct: '' })
export const emptyCrypto = () => ({ valueCents: '', purpose: 'longTerm' })
export const emptyRealEstate = () => ({ valueCents: '' })
export const emptyRental = () => ({ rentCollectedUnspentCents: '', expensesPaidCents: '' })
export const emptyBusiness = () => ({ ownershipPct: '', cashCents: '', inventoryCents: '', receivablesCents: '', liabilitiesCents: '' })
export const emptyRetirement = () => ({ vestedBalanceCents: '', method: 'whenAccessible', zakatableSharePct: '', penaltyTaxCents: '' })
export const emptyUnpaidYear = () => ({ amountCents: '' })

// The debt boxes on the Debts step (the old installments box is gone).
export const DEBT_FORM_FIELDS = DEBT_FIELDS.filter((k) => k !== 'installments12mCents')
const emptyDebts = () => Object.fromEntries(DEBT_FORM_FIELDS.map((k) => [k, '']))

export function initialFormState() {
  return {
    cashCents: '',
    savingsCents: '',
    gold: { grams: '', valueCents: '' },
    silver: { grams: '', valueCents: '' },
    securities: [emptySecurity()],
    crypto: [emptyCrypto()],
    realEstateForSale: [emptyRealEstate()],
    rentals: [emptyRental()],
    businesses: [emptyBusiness()],
    retirement: [emptyRetirement()],
    debts: emptyDebts(),
    unpaidZakat: [emptyUnpaidYear()],
    nisab: '', // '' means not chosen yet — no default per PROJECT.md S1.9
    heldOneLunarYear: null, // null means not answered yet
    zakatDate: '',
  }
}

// A restored draft (src/lib/formDraft.js) must look like the form state,
// so a damaged or old-version copy is never fed back into the form.
export function isValidFormState(data) {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.securities) &&
    Array.isArray(data.crypto) &&
    Array.isArray(data.realEstateForSale) &&
    Array.isArray(data.rentals) &&
    Array.isArray(data.businesses) &&
    Array.isArray(data.retirement) &&
    Array.isArray(data.unpaidZakat) &&
    data.debts !== null &&
    typeof data.debts === 'object' &&
    DEBT_FORM_FIELDS.every((k) => typeof data.debts[k] === 'string')
  )
}

// Converts raw text amounts into integer cents. Returns both the engine
// input value and a local error (same {field, code} shape as the engine)
// when the text doesn't parse as a non-negative dollar amount.
function money(path, text, errors) {
  const cents = dollarsTextToCents(text)
  if (cents === null) {
    errors.push({ field: path, code: 'notANumber' })
    return 0
  }
  return cents
}

// Like money(), but blank text stays null (not 0) — used for gold/silver
// value, where blank means "price the grams instead."
function moneyOrNull(path, text, errors) {
  if (text === undefined || text === null || String(text).trim() === '') return null
  const cents = dollarsTextToCentsOrNull(text)
  if (cents === null) {
    errors.push({ field: path, code: 'notANumber' })
    return null
  }
  return cents
}

// Grams as typed -> a number (blank = 0); bad text is an error, not a guess.
function grams(path, text, errors) {
  const n = gramsTextToNumber(text)
  if (n === null) {
    errors.push({ field: path, code: 'notANumber' })
    return 0
  }
  return n
}

// The optional Zakat date: blank, or a real date from 1900 to 2200.
function zakatDate(text, errors) {
  if (!text) return null
  if (!isValidIsoDate(text)) {
    errors.push({ field: 'zakatDate', code: 'notADate' })
    return null
  }
  return text
}

function percent(path, text, errors, fallback) {
  if (text === '' || text === undefined) return fallback
  const n = percentTextToNumber(text)
  if (n === null) {
    errors.push({ field: path, code: 'notANumber' })
    return fallback
  }
  return n
}

// Builds the engine's `inputs` object from raw form text, collecting any
// local parsing errors (malformed text the engine itself would never see,
// since the engine only receives numbers).
export function buildEngineInputs(form) {
  const localErrors = []
  const inputs = {
    cashCents: money('cashCents', form.cashCents, localErrors),
    savingsCents: money('savingsCents', form.savingsCents, localErrors),
    gold: { grams: grams('gold.grams', form.gold.grams, localErrors), valueCents: moneyOrNull('gold.valueCents', form.gold.valueCents, localErrors) },
    silver: { grams: grams('silver.grams', form.silver.grams, localErrors), valueCents: moneyOrNull('silver.valueCents', form.silver.valueCents, localErrors) },
    securities: form.securities.map((s, i) => ({
      purpose: s.purpose,
      countInFull: s.countInFull,
      valueCents: money(`securities[${i}].valueCents`, s.valueCents, localErrors),
      zakatableSharePct: percent(`securities[${i}].zakatableSharePct`, s.zakatableSharePct, localErrors, undefined),
    })),
    crypto: form.crypto.map((c, i) => ({
      purpose: c.purpose,
      valueCents: money(`crypto[${i}].valueCents`, c.valueCents, localErrors),
    })),
    realEstateForSale: form.realEstateForSale.map((p, i) => ({
      valueCents: money(`realEstateForSale[${i}].valueCents`, p.valueCents, localErrors),
    })),
    rentals: form.rentals.map((r, i) => ({
      rentCollectedUnspentCents: money(`rentals[${i}].rentCollectedUnspentCents`, r.rentCollectedUnspentCents, localErrors),
      expensesPaidCents: money(`rentals[${i}].expensesPaidCents`, r.expensesPaidCents, localErrors),
    })),
    businesses: form.businesses.map((b, i) => ({
      ownershipPct: percent(`businesses[${i}].ownershipPct`, b.ownershipPct, localErrors, undefined),
      cashCents: money(`businesses[${i}].cashCents`, b.cashCents, localErrors),
      inventoryCents: money(`businesses[${i}].inventoryCents`, b.inventoryCents, localErrors),
      receivablesCents: money(`businesses[${i}].receivablesCents`, b.receivablesCents, localErrors),
      liabilitiesCents: money(`businesses[${i}].liabilitiesCents`, b.liabilitiesCents, localErrors),
    })),
    retirement: form.retirement.map((r, i) => ({
      method: r.method,
      vestedBalanceCents: money(`retirement[${i}].vestedBalanceCents`, r.vestedBalanceCents, localErrors),
      zakatableSharePct: percent(`retirement[${i}].zakatableSharePct`, r.zakatableSharePct, localErrors, undefined),
      penaltyTaxCents: money(`retirement[${i}].penaltyTaxCents`, r.penaltyTaxCents, localErrors),
    })),
    debts: Object.fromEntries(DEBT_FORM_FIELDS.map((k) => [k, money(`debts.${k}`, form.debts[k], localErrors)])),
    unpaidZakat: form.unpaidZakat.map((y, i) => ({
      amountCents: money(`unpaidZakat[${i}].amountCents`, y.amountCents, localErrors),
    })),
    nisab: form.nisab,
    heldOneLunarYear: form.heldOneLunarYear,
    zakatDate: zakatDate(form.zakatDate, localErrors),
  }
  return { inputs, localErrors }
}

// `startForm` is a restored draft, if there is one. The calculator page
// keeps the draft in sessionStorage (M5); this hook only holds the state.
export function useZakatForm(startForm) {
  const [form, setForm] = useState(() => startForm ?? initialFormState())

  const resetForm = () => setForm(initialFormState())

  // Runs the engine with a given prices object, merging local parsing
  // errors with the engine's own validation errors.
  const calculate = (prices) => {
    const { inputs, localErrors } = buildEngineInputs(form)
    const result = calculateZakat(inputs, prices)
    const seen = new Set()
    const errors = [...localErrors, ...result.errors].filter((e) => {
      if (seen.has(e.field)) return false
      seen.add(e.field)
      return true
    })
    // `inputs` is returned too, so a result can be saved with exactly
    // what produced it (S4.1, S4.2).
    return { ...result, errors, ok: errors.length === 0, inputs }
  }

  return { form, setForm, resetForm, calculate }
}
