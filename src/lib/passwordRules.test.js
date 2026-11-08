import { describe, expect, it } from 'vitest'
import { passwordProblems, passwordStrength } from './passwordRules.js'

describe('passwordProblems', () => {
  it('accepts reasonable passwords', () => {
    for (const pw of ['Blue-garden-42', 'correct horse battery', 'tY7#kq92', 'sabr wa shukr 2026']) {
      expect(passwordProblems(pw, 'nadia@example.com'), pw).toEqual([])
    }
  })

  it('enforces the 8-character minimum and the 72-byte maximum', () => {
    expect(passwordProblems('Ab3$xyz')).toEqual(['tooShort'])
    expect(passwordProblems('a'.repeat(73))).toEqual(['tooLong'])
    expect(passwordProblems('é'.repeat(37))).toEqual(['tooLong']) // 74 bytes, 37 characters
  })

  it('rejects common passwords, also with digits or symbols stuck on', () => {
    for (const pw of ['password', 'Password2024!', '12345678', 'qwertyuiop', 'Bismillah786', 'P@ssw0rd', 'charityflow1']) {
      expect(passwordProblems(pw), pw).toContain('common')
    }
  })

  it('rejects repeats and simple sequences', () => {
    expect(passwordProblems('aaaaaaaa')).toContain('repeated')
    expect(passwordProblems('abcabcabc')).toContain('repeated')
    expect(passwordProblems('abcdefgh')).toContain('sequence')
    expect(passwordProblems('98765432')).toContain('sequence')
  })

  it('rejects passwords containing the email name', () => {
    expect(passwordProblems('Nadia.2026!', 'nadia@example.com')).toContain('containsEmail')
    expect(passwordProblems('Blue-garden-42', 'al@example.com')).toEqual([]) // names under 3 letters ignored
  })
})

describe('passwordStrength', () => {
  it('is 0 for anything the rules refuse and grows with length and variety', () => {
    expect(passwordStrength('password1')).toBe(0)
    expect(passwordStrength('tY7kq9zr')).toBeGreaterThan(0)
    expect(passwordStrength('Blue-garden-lamp-42')).toBe(4)
  })
})
