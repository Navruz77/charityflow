import { describe, it, expect } from 'vitest'
import { calculateZakat } from './calculateZakat.js'

// Prices chosen so nisab is easy to reason about.
const prices = { goldUsdPerGram: 100, silverUsdPerGram: 1.5 }
// gold nisab = 87.48*100 = $8,748.00 ; silver nisab = 612.36*1.5 = $918.54
const base = { heldOneLunarYear: true, nisab: 'silver' }
const calc = (i, p = prices) => calculateZakat({ ...base, ...i }, p)

describe('Appendix B.6 worked example', () => {
  const p = { goldUsdPerGram: 134.34, silverUsdPerGram: 1.96 }
  it('$300,000 cash + 51g gold (priced from grams), silver nisab, held a year', () => {
    const r = calc({ cashCents: 300000, gold: { grams: 51, valueCents: null } }, p)
    expect(r.netCents).toBe(985134)
    expect(r.nisab.valueCents).toBe(120023)
    expect(r.zakatDueCents).toBe(24628)
    expect(r.status).toBe('due')
  })
  it('the same wealth is below gold nisab', () => {
    const r = calc({ cashCents: 300000, gold: { grams: 51, valueCents: null }, nisab: 'gold' }, p)
    expect(r.status).toBe('belowNisab')
    expect(r.zakatDueCents).toBe(0)
  })
})

describe('nisab boundary', () => {
  it('exactly at nisab is due', () => {
    const r = calc({ cashCents: 91854 })
    expect(r.nisab.valueCents).toBe(91854)
    expect(r.status).toBe('due')
    expect(r.zakatDueCents).toBe(2296) // 918.54/40 = 22.9635
  })
  it('one cent under is below nisab', () => {
    expect(calc({ cashCents: 91853 }).status).toBe('belowNisab')
  })
  it('gold nisab uses gold price', () => {
    expect(calc({ nisab: 'gold' }).nisab.valueCents).toBe(874800)
  })
  it('4-decimal prices stay exact', () => {
    const r = calc({}, { goldUsdPerGram: 100, silverUsdPerGram: 1.2345 })
    expect(r.nisab.valueCents).toBe(Math.round((612.36 * 12345) / 100))
  })
})

describe('categories', () => {
  it('cash and savings count in full', () => {
    expect(calc({ cashCents: 100000, savingsCents: 50000 }).totalZakatableCents).toBe(150000)
  })
  it('gold and silver count at an entered value', () => {
    const r = calc({ gold: { grams: 10, valueCents: 100000 }, silver: { grams: 5, valueCents: 1000 } })
    expect(r.totalZakatableCents).toBe(101000)
  })
  it('gold and silver price themselves from grams when value is blank', () => {
    const r = calc({ gold: { grams: 10 } }) // gold price 100/g -> $1,000.00
    expect(r.totalZakatableCents).toBe(100000)
  })
  it('personal gems excluded, resale gems counted', () => {
    const r = calc({ gems: [{ valueCents: 100000, purpose: 'personal' }, { valueCents: 50000, purpose: 'resale' }] })
    expect(r.totalZakatableCents).toBe(50000)
  })
  it('trading securities count in full', () => {
    expect(calc({ securities: [{ valueCents: 100000, purpose: 'trade' }] }).totalZakatableCents).toBe(100000)
  })
  it('long-term securities default to 30%', () => {
    expect(calc({ securities: [{ valueCents: 100000, purpose: 'longTerm' }] }).totalZakatableCents).toBe(30000)
  })
  it('long-term securities with custom share and count-in-full', () => {
    expect(calc({ securities: [{ valueCents: 100000, purpose: 'longTerm', zakatableSharePct: 50 }] }).totalZakatableCents).toBe(50000)
    expect(calc({ securities: [{ valueCents: 100000, purpose: 'longTerm', countInFull: true }] }).totalZakatableCents).toBe(100000)
  })
  it('crypto: trade counts, long-term does not', () => {
    const r = calc({ crypto: [{ valueCents: 40000, purpose: 'trade' }, { valueCents: 90000, purpose: 'longTerm' }] })
    expect(r.totalZakatableCents).toBe(40000)
  })
  it('real estate held for sale is a list, and counts', () => {
    const r = calc({ realEstateForSale: [{ valueCents: 1200000 }, { valueCents: 800000 }] })
    expect(r.totalZakatableCents).toBe(2000000)
  })
  it('rentals are net of expenses and never negative', () => {
    const r = calc({ rentals: [{ rentCollectedUnspentCents: 100000, expensesPaidCents: 30000 }, { rentCollectedUnspentCents: 1000, expensesPaidCents: 5000 }] })
    expect(r.totalZakatableCents).toBe(70000)
  })
  it('business counts ownership share of net assets', () => {
    const r = calc({ businesses: [{ ownershipPct: 50, cashCents: 100000, inventoryCents: 100000, receivablesCents: 50000, liabilitiesCents: 50000 }] })
    expect(r.totalZakatableCents).toBe(100000)
  })
  it('retirement annual uses share minus penalty; whenAccessible is excluded', () => {
    const r = calc({ retirement: [
      { vestedBalanceCents: 1000000, method: 'annual', zakatableSharePct: 100, penaltyTaxCents: 100000 },
      { vestedBalanceCents: 5000000, method: 'whenAccessible' },
    ] })
    expect(r.totalZakatableCents).toBe(900000)
  })
  it('line treatment is only full, reduced or excluded', () => {
    const r = calc({
      securities: [{ valueCents: 100000, purpose: 'longTerm' }],
      businesses: [{ ownershipPct: 50, cashCents: 100000, inventoryCents: 0, receivablesCents: 0, liabilitiesCents: 0 }],
      crypto: [{ valueCents: 100000, purpose: 'longTerm' }],
    })
    const treatments = new Set(r.lines.map((l) => l.treatment))
    expect([...treatments].every((t) => ['full', 'reduced', 'excluded'].includes(t))).toBe(true)
  })
})

describe('debts and status', () => {
  it('subtracts debts due now and 12-month installments', () => {
    const r = calc({ cashCents: 500000, debts: { dueNowCents: 100000, installments12mCents: 50000 } })
    expect(r.debtsSubtracted).toEqual({ dueNowCents: 100000, installments12mCents: 50000 })
    expect(r.netCents).toBe(350000)
    expect(r.zakatDueCents).toBe(8750)
  })
  it('net never goes below zero', () => {
    expect(calc({ cashCents: 1000, debts: { dueNowCents: 99999 } }).netCents).toBe(0)
  })
  it('notYetDue when not held a full lunar year', () => {
    const r = calc({ cashCents: 500000, heldOneLunarYear: false })
    expect(r.status).toBe('notYetDue')
    expect(r.zakatDueCents).toBe(0)
  })
  it('needsNisab when nisab is not chosen', () => {
    const r = calc({ cashCents: 500000, nisab: undefined })
    expect(r.status).toBe('needsNisab')
    expect(r.zakatDueCents).toBe(0)
    expect(r.nisab.valueCents).toBeNull()
  })
  it('needsHawl when heldOneLunarYear is not set, unless already below nisab', () => {
    const r = calc({ cashCents: 500000, heldOneLunarYear: undefined })
    expect(r.status).toBe('needsHawl')
    const below = calc({ cashCents: 100, heldOneLunarYear: undefined })
    expect(below.status).toBe('belowNisab')
  })
})

describe('validation', () => {
  it('blank fields are $0', () => {
    const r = calc({ cashCents: '', savingsCents: undefined })
    expect(r.ok).toBe(true)
    expect(r.totalZakatableCents).toBe(0)
  })
  it('rejects negative and non-numeric, names the field and code, keeps other entries', () => {
    const r = calc({ cashCents: -5, savingsCents: 'abc', realEstateForSale: [{ valueCents: 200000 }] })
    expect(r.ok).toBe(false)
    expect(r.errors).toEqual([
      { field: 'cashCents', code: 'negative' },
      { field: 'savingsCents', code: 'notANumber' },
    ])
    expect(r.totalZakatableCents).toBe(200000)
  })
  it('reports missing prices by field and code', () => {
    const r = calculateZakat({ cashCents: 1000 }, {})
    expect(r.ok).toBe(false)
    expect(r.errors).toEqual([
      { field: 'prices.goldUsdPerGram', code: 'missingPrice' },
      { field: 'prices.silverUsdPerGram', code: 'missingPrice' },
    ])
  })
})

describe('performance', () => {
  it('1,000 calculations in under 1 second', () => {
    const input = { ...base, cashCents: 985134, securities: [{ valueCents: 100000, purpose: 'longTerm' }], rentals: [{ rentCollectedUnspentCents: 5000, expensesPaidCents: 100 }] }
    const t = performance.now()
    for (let i = 0; i < 1000; i++) calculateZakat(input, prices)
    expect(performance.now() - t).toBeLessThan(1000)
  })
})
