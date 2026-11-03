import { describe, it, expect } from 'vitest'
import { calculateZakat } from './calculateZakat.js'

// Prices chosen so nisab is easy to reason about.
const prices = { goldPerGram: 100, silverPerGram: 1.5 }
// gold nisab = 87.48*100 = $8,748.00 ; silver nisab = 612.36*1.5 = $918.54
const base = { heldOneLunarYear: true, nisab: 'silver' }
const calc = (i, p = prices) => calculateZakat({ ...base, ...i }, p)

describe('Appendix A.6 worked examples', () => {
  // Real-world-style prices where $9,851.34 is below gold nisab but above silver.
  const p = { goldPerGram: 140, silverPerGram: 1.6 }
  it('$9,851.34 vs gold nisab -> $0.00', () => {
    const r = calc({ cashCents: 985134, nisab: 'gold' }, p)
    expect(r.status).toBe('belowNisab')
    expect(r.zakatDueCents).toBe(0)
  })
  it('$9,851.34 vs silver nisab -> $246.28', () => {
    const r = calc({ cashCents: 985134 }, p)
    expect(r.zakatDueCents).toBe(24628)
  })
  it('$7,500 vs silver nisab -> $187.50', () => {
    expect(calc({ cashCents: 750000 }, p).zakatDueCents).toBe(18750)
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
    const r = calc({}, { goldPerGram: 100, silverPerGram: 1.2345 })
    expect(r.nisab.valueCents).toBe(Math.round((612.36 * 12345) / 100))
  })
})

describe('categories', () => {
  it('cash and savings count in full', () => {
    expect(calc({ cashCents: 100000, savingsCents: 50000 }).totalZakatableCents).toBe(150000)
  })
  it('gold and silver count at value', () => {
    const r = calc({ gold: { grams: 10, valueCents: 100000 }, silver: { grams: 5, valueCents: 1000 } })
    expect(r.totalZakatableCents).toBe(101000)
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
  it('real estate held for sale counts', () => {
    expect(calc({ realEstateForSale: 2000000 }).totalZakatableCents).toBe(2000000)
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
})

describe('debts and status', () => {
  it('subtracts debts due now and 12-month installments', () => {
    const r = calc({ cashCents: 500000, debts: { dueNowCents: 100000, installments12mCents: 50000 } })
    expect(r.debtsSubtracted).toBe(150000)
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
})

describe('validation', () => {
  it('blank fields are $0', () => {
    const r = calc({ cashCents: '', savingsCents: undefined })
    expect(r.ok).toBe(true)
    expect(r.totalZakatableCents).toBe(0)
  })
  it('rejects negative and non-numeric, names the field, keeps other entries', () => {
    const r = calc({ cashCents: -5, savingsCents: 'abc', realEstateForSale: 200000 })
    expect(r.ok).toBe(false)
    expect(r.errors.map((e) => e.field)).toEqual(['cashCents', 'savingsCents'])
    expect(r.totalZakatableCents).toBe(200000)
  })
  it('reports missing prices', () => {
    const r = calculateZakat({ cashCents: 1000 }, {})
    expect(r.ok).toBe(false)
    expect(r.errors[0].field).toBe('prices')
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
