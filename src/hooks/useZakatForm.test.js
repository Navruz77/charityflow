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
