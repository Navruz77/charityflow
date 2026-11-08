import { describe, expect, it } from 'vitest'
import { createFailureBackoff, createLimiter } from './rateLimit.js'

describe('createLimiter', () => {
  it('allows max tries per window, then refuses until the window ends', () => {
    let t = 0
    const l = createLimiter({ windowMs: 60000, max: 3, now: () => t })
    expect([1, 2, 3].map(() => l.hit('ip').allowed)).toEqual([true, true, true])
    expect(l.hit('ip')).toEqual({ allowed: false, retryAfterSec: 60 })
    expect(l.hit('other').allowed).toBe(true)
    t = 60000
    expect(l.hit('ip').allowed).toBe(true)
  })
})

describe('createFailureBackoff', () => {
  it('gives 5 free failures, then doubling waits capped at 15 minutes, never permanent', () => {
    let t = 0
    const b = createFailureBackoff({ now: () => t })
    for (let i = 0; i < 5; i++) b.fail('a@x.com')
    expect(b.check('a@x.com').allowed).toBe(true)
    b.fail('a@x.com')
    expect(b.check('a@x.com')).toEqual({ allowed: false, retryAfterSec: 30 })
    t += 30000
    b.fail('a@x.com')
    expect(b.check('a@x.com').retryAfterSec).toBe(60)
    for (let i = 0; i < 20; i++) b.fail('a@x.com')
    expect(b.check('a@x.com').retryAfterSec).toBe(15 * 60)
    t += 15 * 60 * 1000
    expect(b.check('a@x.com').allowed).toBe(true)
  })

  it('a success clears the record, and old failures are forgotten after an hour', () => {
    let t = 0
    const b = createFailureBackoff({ now: () => t })
    for (let i = 0; i < 6; i++) b.fail('a')
    b.succeed('a')
    expect(b.check('a').allowed).toBe(true)
    for (let i = 0; i < 5; i++) b.fail('b')
    t += 61 * 60 * 1000
    b.fail('b') // counts as the first failure again
    expect(b.check('b').allowed).toBe(true)
  })
})
