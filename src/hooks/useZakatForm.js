import { useEffect, useState } from 'react'
import { calculateZakat } from '../engine/calculateZakat.js'
import { dollarsTextToCents, dollarsTextToCentsOrNull, percentTextToNumber } from '../lib/money.js'
import { loadGuestData, saveGuestData, clearGuestData } from '../lib/storage.js'

const STORAGE_KEY = 'charityflow.zakat.guestSave.v1'

export const emptyGem = () => ({ valueCents: '', purpose: 'personal' })
export const emptySecurity = () => ({ valueCents: '', purpose: 'longTerm', countInFull: false, zakatableSharePct: '' })
export const emptyCrypto = () => ({ valueCents: '', purpose: 'longTerm' })
export const emptyRealEstate = () => ({ valueCents: '' })
export const emptyRental = () => ({ rentCollectedUnspentCents: '', expensesPaidCents: '' })
export const emptyBusiness = () => ({ ownershipPct: '', cashCents: '', inventoryCents: '', receivablesCents: '', liabilitiesCents: '' })
export const emptyRetirement = () => ({ vestedBalanceCents: '', method: 'whenAccessible', zakatableSharePct: '', penaltyTaxCents: '' })

export function initialFormState() {
  return {
    cashCents: '',
    savingsCents: '',
    gold: { grams: '', valueCents: '' },
    silver: { grams: '', valueCents: '' },
    gems: [emptyGem()],
    securities: [emptySecurity()],
    crypto: [emptyCrypto()],
    realEstateForSale: [emptyRealEstate()],
    rentals: [emptyRental()],
    businesses: [emptyBusiness()],
    retirement: [emptyRetirement()],
    debts: { dueNowCents: '', installments12mCents: '' },
    nisab: 'silver',
    heldOneLunarYear: false,
    zakatDate: '',
  }
}

// Shape stored in localStorage must look roughly like the form state, so
// a corrupted or old-version blob doesn't get fed back into the form.
function isValidSavedState(data) {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.gems) &&
    Array.isArray(data.securities) &&
    Array.isArray(data.crypto) &&
    Array.isArray(data.realEstateForSale) &&
    Array.isArray(data.rentals) &&
    Array.isArray(data.businesses) &&
    Array.isArray(data.retirement) &&
    typeof data.debts === 'object'
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
    gold: { grams: form.gold.grams, valueCents: moneyOrNull('gold.valueCents', form.gold.valueCents, localErrors) },
    silver: { grams: form.silver.grams, valueCents: moneyOrNull('silver.valueCents', form.silver.valueCents, localErrors) },
    gems: form.gems.map((g, i) => ({
      purpose: g.purpose,
      valueCents: money(`gems[${i}].valueCents`, g.valueCents, localErrors),
    })),
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
    debts: {
      dueNowCents: money('debts.dueNowCents', form.debts.dueNowCents, localErrors),
      installments12mCents: money('debts.installments12mCents', form.debts.installments12mCents, localErrors),
    },
    nisab: form.nisab,
    heldOneLunarYear: form.heldOneLunarYear,
    zakatDate: form.zakatDate || null,
  }
  return { inputs, localErrors }
}

export function useZakatForm() {
  const [form, setForm] = useState(() => loadGuestData(STORAGE_KEY, isValidSavedState) ?? initialFormState())

  useEffect(() => {
    saveGuestData(STORAGE_KEY, form, isValidSavedState)
  }, [form])

  const resetForm = () => {
    clearGuestData(STORAGE_KEY)
    setForm(initialFormState())
  }

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
    return { ...result, errors, ok: errors.length === 0 }
  }

  return { form, setForm, resetForm, calculate }
}
