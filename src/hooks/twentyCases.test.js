import { describe, it, expect } from 'vitest'
import { calculateZakat } from '../engine/calculateZakat.js'
import { buildEngineInputs, initialFormState, emptyGem, emptySecurity, emptyCrypto, emptyRealEstate, emptyRental, emptyBusiness, emptyRetirement } from './useZakatForm.js'

// The 20 cases Mufti Ahmad confirmed against the engine's rules (see
// PROJECT.md Status). Each case is entered as a user would type it — through
// the same form-text -> buildEngineInputs() path the screens use — and
// checked against the confirmed engine's own output, to prove the screens'
// input handling doesn't change the answer. Prices match Appendix B.6.
const prices = { goldUsdPerGram: 134.34, silverUsdPerGram: 1.96 }

function form(overrides) {
  const f = initialFormState()
  f.nisab = 'silver'
  f.heldOneLunarYear = true
  return { ...f, ...overrides }
}

const cases = [
  {
    name: '1. B.6 baseline: cash + gold priced from grams, silver nisab',
    build: () => form({ cashCents: '3000.00', gold: { grams: '51', valueCents: '' } }),
    expected: { netCents: 985134, nisabValueCents: 120023, status: 'due', zakatDueCents: 24628 },
  },
  {
    name: '2. Same wealth is below gold nisab',
    build: () => form({ cashCents: '3000.00', gold: { grams: '51', valueCents: '' }, nisab: 'gold' }),
    expected: { netCents: 985134, status: 'belowNisab', zakatDueCents: 0 },
  },
  {
    name: '3. Cash above silver nisab',
    build: () => form({ cashCents: '1500.00' }),
    expected: { netCents: 150000, status: 'due', zakatDueCents: 3750 },
  },
  {
    name: '4. Cash below silver nisab',
    build: () => form({ cashCents: '1000.00' }),
    expected: { netCents: 100000, status: 'belowNisab', zakatDueCents: 0 },
  },
  {
    name: '5. Cash exactly at silver nisab is due',
    build: () => form({ cashCents: '1200.23' }),
    expected: { netCents: 120023, status: 'due', zakatDueCents: 3001 },
  },
  {
    name: '6. Gold priced from grams, above nisab',
    build: () => form({ gold: { grams: '20', valueCents: '' } }),
    expected: { netCents: 268680, status: 'due', zakatDueCents: 6717 },
  },
  {
    name: '7. Silver priced from grams, below nisab',
    build: () => form({ silver: { grams: '300', valueCents: '' } }),
    expected: { netCents: 58800, status: 'belowNisab', zakatDueCents: 0 },
  },
  {
    name: '8. Gems held for resale count',
    build: () => form({ gems: [{ ...emptyGem(), valueCents: '2000.00', purpose: 'resale' }] }),
    expected: { netCents: 200000, status: 'due', zakatDueCents: 5000 },
  },
  {
    name: '9. Gems for personal use are excluded',
    build: () => form({ gems: [{ ...emptyGem(), valueCents: '2000.00', purpose: 'personal' }] }),
    expected: { netCents: 0, status: 'belowNisab', zakatDueCents: 0 },
  },
  {
    name: '10. Trading securities count in full',
    build: () => form({ securities: [{ ...emptySecurity(), valueCents: '5000.00', purpose: 'trade' }] }),
    expected: { netCents: 500000, status: 'due', zakatDueCents: 12500 },
  },
  {
    name: '11. Long-term securities default to a 30% share',
    build: () => form({ securities: [{ ...emptySecurity(), valueCents: '10000.00', purpose: 'longTerm' }] }),
    expected: { netCents: 300000, status: 'due', zakatDueCents: 7500 },
  },
  {
    name: '12. Long-term securities counted in full when chosen',
    build: () => form({ securities: [{ ...emptySecurity(), valueCents: '10000.00', purpose: 'longTerm', countInFull: true }] }),
    expected: { netCents: 1000000, status: 'due', zakatDueCents: 25000 },
  },
  {
    name: '13. Crypto held for trading counts in full',
    build: () => form({ crypto: [{ ...emptyCrypto(), valueCents: '4000.00', purpose: 'trade' }] }),
    expected: { netCents: 400000, status: 'due', zakatDueCents: 10000 },
  },
  {
    name: '14. Long-term crypto is excluded',
    build: () => form({ crypto: [{ ...emptyCrypto(), valueCents: '4000.00', purpose: 'longTerm' }] }),
    expected: { netCents: 0, status: 'belowNisab', zakatDueCents: 0 },
  },
  {
    name: '15. Multiple properties for sale add up',
    build: () => form({ realEstateForSale: [{ ...emptyRealEstate(), valueCents: '6000.00' }, { ...emptyRealEstate(), valueCents: '4000.00' }] }),
    expected: { netCents: 1000000, status: 'due', zakatDueCents: 25000 },
  },
  {
    name: '16. Rental income net of expenses',
    build: () => form({ rentals: [{ ...emptyRental(), rentCollectedUnspentCents: '3000.00', expensesPaidCents: '500.00' }] }),
    expected: { netCents: 250000, status: 'due', zakatDueCents: 6250 },
  },
  {
    name: '17. Business counts ownership share of net assets',
    build: () =>
      form({
        businesses: [{ ...emptyBusiness(), ownershipPct: '50', cashCents: '4000.00', inventoryCents: '2000.00', receivablesCents: '1000.00', liabilitiesCents: '1000.00' }],
      }),
    expected: { netCents: 300000, status: 'due', zakatDueCents: 7500 },
  },
  {
    name: '18. Retirement "annual" uses the vested share minus penalty',
    build: () => form({ retirement: [{ ...emptyRetirement(), vestedBalanceCents: '10000.00', method: 'annual', penaltyTaxCents: '1000.00' }] }),
    expected: { netCents: 900000, status: 'due', zakatDueCents: 22500 },
  },
  {
    name: '19. Retirement "when accessible" is excluded',
    build: () => form({ retirement: [{ ...emptyRetirement(), vestedBalanceCents: '50000.00', method: 'whenAccessible' }] }),
    expected: { netCents: 0, status: 'belowNisab', zakatDueCents: 0 },
  },
  {
    name: '20. Debts due now and installments are subtracted',
    build: () => form({ cashCents: '3000.00', debts: { dueNowCents: '500.00', installments12mCents: '300.00' } }),
    expected: { netCents: 220000, status: 'due', zakatDueCents: 5500 },
  },
]

describe('the 20 confirmed cases, entered through the screens', () => {
  for (const { name, build, expected } of cases) {
    it(name, () => {
      const { inputs, localErrors } = buildEngineInputs(build())
      expect(localErrors).toEqual([])
      const r = calculateZakat(inputs, prices)
      expect(r.ok).toBe(true)
      expect(r.netCents).toBe(expected.netCents)
      expect(r.status).toBe(expected.status)
      expect(r.zakatDueCents).toBe(expected.zakatDueCents)
      if (expected.nisabValueCents !== undefined) {
        expect(r.nisab.valueCents).toBe(expected.nisabValueCents)
      }
    })
  }
})
