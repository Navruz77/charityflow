import { describe, expect, it } from 'vitest'
import { cleanGramsText, cleanMoneyText, cleanPercentText, gramsTextToNumber, isValidIsoDate } from './inputRules.js'
import { buildEngineInputs, initialFormState } from '../hooks/useZakatForm.js'
import { describeField, getErrorMessage } from '../content/errorText.js'

describe('money boxes: only an amount can be typed or pasted', () => {
  it('drops letters, symbols, minus signs and exponents', () => {
    expect(cleanMoneyText('abc')).toBe('')
    expect(cleanMoneyText('12a3')).toBe('123')
    expect(cleanMoneyText('$1,250.50')).toBe('1,250.50')
    expect(cleanMoneyText('-500')).toBe('500')
    expect(cleanMoneyText('1e5')).toBe('15')
    expect(cleanMoneyText(' 1 000 ')).toBe('1000')
    expect(cleanMoneyText('<script>')).toBe('')
    expect(cleanMoneyText('１２３')).toBe('') // full-width digits are not ASCII digits
  })

  it('allows one decimal point and at most 2 decimals', () => {
    expect(cleanMoneyText('1.2.3')).toBe('1.23')
    expect(cleanMoneyText('10.999')).toBe('10.99')
    expect(cleanMoneyText('.5')).toBe('.5')
  })

  it('caps whole-dollar digits so cents stay exact', () => {
    expect(cleanMoneyText('12345678901234567')).toBe('1234567890123')
  })

  it('commas only inside the whole-dollar part', () => {
    expect(cleanMoneyText(',100')).toBe('100')
    expect(cleanMoneyText('1.5,0')).toBe('1.50')
  })

  it('handles non-text safely', () => {
    expect(cleanMoneyText(undefined)).toBe('')
    expect(cleanMoneyText(null)).toBe('')
  })
})

describe('grams and percentage boxes', () => {
  it('grams: digits and one point, 4 decimals, no commas', () => {
    expect(cleanGramsText('51g')).toBe('51')
    expect(cleanGramsText('12.34567')).toBe('12.3456')
    expect(cleanGramsText('1,000')).toBe('1000')
    expect(cleanGramsText('-3')).toBe('3')
  })

  it('percent: 0 to 100 only; a keystroke past 100 is refused', () => {
    expect(cleanPercentText('30%')).toBe('30')
    expect(cleanPercentText('100')).toBe('100')
    expect(cleanPercentText('101', '10')).toBe('10')
    expect(cleanPercentText('1000', '100')).toBe('100')
    expect(cleanPercentText('99.999')).toBe('99.99')
    expect(cleanPercentText('abc')).toBe('')
  })

  it('grams text to a number', () => {
    expect(gramsTextToNumber('')).toBe(0)
    expect(gramsTextToNumber('51')).toBe(51)
    expect(gramsTextToNumber('12.5')).toBe(12.5)
    expect(gramsTextToNumber('abc')).toBeNull()
    expect(gramsTextToNumber('1e3')).toBeNull()
    expect(gramsTextToNumber('-1')).toBeNull()
  })
})

describe('dates', () => {
  it('only real dates in range', () => {
    expect(isValidIsoDate('2026-11-09')).toBe(true)
    expect(isValidIsoDate('2026-02-29')).toBe(false) // not a leap year
    expect(isValidIsoDate('2026-13-01')).toBe(false)
    expect(isValidIsoDate('1899-12-31')).toBe(false)
    expect(isValidIsoDate('2201-01-01')).toBe(false)
    expect(isValidIsoDate('11/09/2026')).toBe(false)
    expect(isValidIsoDate(20261109)).toBe(false)
  })
})

describe('the calculator still catches bad text that got in another way (e.g. an old draft)', () => {
  it('flags bad grams and dates instead of passing them to the engine', () => {
    const form = { ...initialFormState(), gold: { grams: 'abc', valueCents: '' }, zakatDate: '2026-02-30' }
    const { inputs, localErrors } = buildEngineInputs(form)
    expect(inputs.gold.grams).toBe(0)
    expect(inputs.zakatDate).toBeNull()
    expect(localErrors.map((e) => e.field)).toEqual(['gold.grams', 'zakatDate'])
  })

  it('error text is plain language and never shows internal names', () => {
    const msg = getErrorMessage('securities[0].valueCents', 'notANumber')
    expect(msg).toBe('Enter an amount in dollars, like 1,250.00.')
    expect(getErrorMessage('businesses[1].ownershipPct', 'notANumber')).toMatch(/percentage/)
    expect(describeField('securities[0].valueCents')).toEqual({ step: 2, label: 'Holding 1: value' })
    expect(describeField('debts.creditCardCents')).toEqual({ step: 8, label: 'Credit card balances' })
    expect(describeField('unpaidZakat[1].amountCents')).toEqual({ step: 9, label: 'Unpaid year 2: amount' })
    expect(describeField('gold.grams')).toEqual({ step: 1, label: 'Grams of gold' })
  })
})
