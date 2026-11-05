import { describe, expect, it } from 'vitest'
import { dollarsTextToCents, centsToDisplay, percentTextToNumber } from './money.js'

describe('dollarsTextToCents', () => {
  it('treats blank as $0', () => {
    expect(dollarsTextToCents('')).toBe(0)
    expect(dollarsTextToCents(undefined)).toBe(0)
    expect(dollarsTextToCents(null)).toBe(0)
  })

  it('parses plain and comma-formatted dollar amounts', () => {
    expect(dollarsTextToCents('9851.34')).toBe(985134)
    expect(dollarsTextToCents('9,851.34')).toBe(985134)
    expect(dollarsTextToCents('100')).toBe(10000)
  })

  it('rejects negative or non-numeric text', () => {
    expect(dollarsTextToCents('-5')).toBeNull()
    expect(dollarsTextToCents('abc')).toBeNull()
    expect(dollarsTextToCents('1.234')).toBeNull()
  })
})

describe('centsToDisplay', () => {
  it('formats cents as a dollar string', () => {
    expect(centsToDisplay(24628)).toBe('$246.28')
    expect(centsToDisplay(0)).toBe('$0.00')
    expect(centsToDisplay(985134)).toBe('$9,851.34')
  })
})

describe('percentTextToNumber', () => {
  it('accepts 0-100, rejects out of range or invalid', () => {
    expect(percentTextToNumber('30')).toBe(30)
    expect(percentTextToNumber('')).toBeNull()
    expect(percentTextToNumber('150')).toBeNull()
    expect(percentTextToNumber('-1')).toBeNull()
  })
})
