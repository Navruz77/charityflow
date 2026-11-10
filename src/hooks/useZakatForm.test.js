import { describe, expect, it } from 'vitest'
import { calculateZakat } from '../engine/calculateZakat.js'
import { buildEngineInputs, initialFormState } from './useZakatForm.js'

const prices = { goldUsdPerGram: 134.34, silverUsdPerGram: 1.96 }

describe('buildEngineInputs', () => {
  it('maps blank text fields to 0 with no errors', () => {
    const { inputs, localErrors } = buildEngineInputs(initialFormState())
    expect(localErrors).toEqual([])
    expect(inputs.cashCents).toBe(0)
    expect(inputs.debts.dueNowCents).toBe(0)
    expect(inputs.gold.valueCents).toBeNull()
  })

  it('reports a local error for malformed text and still converts the rest', () => {
    const form = initialFormState()
    form.cashCents = 'not a number'
    form.savingsCents = '100'
    const { inputs, localErrors } = buildEngineInputs(form)
    expect(localErrors).toEqual([{ field: 'cashCents', code: 'notANumber' }])
    expect(inputs.savingsCents).toBe(10000)
  })

  // Appendix B.6: $300,000 cash + 51g gold (priced from grams), silver nisab, held a year.
  it('reproduces the B.6 worked example end-to-end through form text', () => {
    const form = initialFormState()
    form.cashCents = '3000.00'
    form.gold.grams = '51'
    form.nisab = 'silver'
    form.heldOneLunarYear = true

    const { inputs, localErrors } = buildEngineInputs(form)
    expect(localErrors).toEqual([])
    expect(inputs.gold.valueCents).toBeNull() // blank value -> priced from grams

    const result = calculateZakat(inputs, prices)
    expect(result.ok).toBe(true)
    expect(result.status).toBe('due')
    expect(result.netCents).toBe(985134)
    expect(result.zakatDueCents).toBe(24628)
  })
})

describe('new debt boxes and unpaid Zakat, entered as typed', () => {
  const prices = { goldUsdPerGram: 134.34, silverUsdPerGram: 1.96 }
  it('the form has no gems and no installments box', () => {
    const f = initialFormState()
    expect(f.gems).toBeUndefined()
    expect(f.debts.installments12mCents).toBeUndefined()
    expect(Object.keys(f.debts)).toHaveLength(7)
  })
  it("$40,000 cash, $3,000 unpaid from last year: $1,000 + $3,000 = $4,000", () => {
    const form = {
      ...initialFormState(),
      nisab: 'silver',
      heldOneLunarYear: true,
      cashCents: '40,000.00',
      debts: { ...initialFormState().debts, creditCardCents: '0' },
      unpaidZakat: [{ amountCents: '3,000' }],
    }
    const { inputs, localErrors } = buildEngineInputs(form)
    expect(localErrors).toEqual([])
    const r = calculateZakat(inputs, prices)
    expect(r.zakatDueCents).toBe(400000)
  })
  it('bad text in a new box names that box', () => {
    const form = { ...initialFormState(), debts: { ...initialFormState().debts, owedToFamilyCents: '12.345' } }
    expect(buildEngineInputs(form).localErrors).toEqual([{ field: 'debts.owedToFamilyCents', code: 'notANumber' }])
  })
})
