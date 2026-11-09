// M7 "Proving it works" cases (S8.1 to S8.3).
import { describe, expect, it } from 'vitest'
import { goalProgress, periodKey, periodLabel, previousPeriod, todayIn } from './progress.js'

const monthly = { id: 'g1', amountCents: 10000, period: 'monthly', createdOn: '2026-08-15' }
const yearly = { id: 'g2', amountCents: 120000, period: 'yearly', createdOn: '2025-03-01' }
const gift = (givenOn, amountCents, goalId = 'g1') => ({ givenOn, amountCents, goalId })
const TODAY = '2026-11-20'

describe('periods', () => {
  it('are calendar months and years', () => {
    expect(periodKey('2026-11-30', 'monthly')).toBe('2026-11')
    expect(periodKey('2026-11-30', 'yearly')).toBe('2026')
    expect(previousPeriod('2026-01')).toBe('2025-12')
    expect(previousPeriod('2026-10')).toBe('2026-09')
    expect(previousPeriod('2026')).toBe('2025')
    expect(periodLabel('2026-11')).toBe('November 2026')
  })

  it("today follows the user's stored time zone", () => {
    const now = new Date('2026-12-01T03:00:00Z') // still Nov 30 in New York
    expect(todayIn('America/New_York', now)).toBe('2026-11-30')
    expect(todayIn('Asia/Tashkent', now)).toBe('2026-12-01')
    expect(todayIn('Not/AZone', now)).toBe('2026-12-01') // falls back to UTC
  })
})

describe('progress this period (S8.3)', () => {
  it('a gift exactly at the amount completes the period; one cent below does not', () => {
    expect(goalProgress(monthly, [gift('2026-11-02', 10000)], TODAY)).toMatchObject({ givenCents: 10000, remainingCents: 0, met: true })
    expect(goalProgress(monthly, [gift('2026-11-02', 9999)], TODAY)).toMatchObject({ givenCents: 9999, remainingCents: 1, met: false })
  })

  it('adds up several gifts and never shows a negative remainder', () => {
    const p = goalProgress(monthly, [gift('2026-11-01', 6000), gift('2026-11-19', 7000), gift('2026-10-31', 5000)], TODAY)
    expect(p).toMatchObject({ periodKey: '2026-11', givenCents: 13000, remainingCents: 0, met: true })
  })

  it('a gift with no goal counts toward none', () => {
    expect(goalProgress(monthly, [gift('2026-11-02', 50000, null)], TODAY).givenCents).toBe(0)
  })

  it("a removed goal's gifts (goalId null, label kept) stop counting", () => {
    const removed = { ...gift('2026-11-02', 50000, null), goalLabel: 'Old goal' }
    expect(goalProgress(monthly, [removed], TODAY).givenCents).toBe(0)
  })

  it('only counts gifts for this goal', () => {
    expect(goalProgress(monthly, [gift('2026-11-02', 50000, 'other')], TODAY).givenCents).toBe(0)
  })
})

describe('streaks (S8.3)', () => {
  const metEveryMonth = [gift('2026-08-20', 10000), gift('2026-09-05', 10000), gift('2026-10-10', 10000)]

  it('counts completed periods in a row, from the creation month', () => {
    expect(goalProgress(monthly, metEveryMonth, TODAY).streak).toBe(3) // Aug, Sep, Oct
  })

  it('the current period does not count until it closes, and cannot break the streak', () => {
    expect(goalProgress(monthly, [...metEveryMonth, gift('2026-11-01', 99999)], TODAY).streak).toBe(3)
    expect(goalProgress(monthly, metEveryMonth, TODAY).met).toBe(false)
  })

  it('a period that closed below the amount resets the streak to 0', () => {
    const octShort = [gift('2026-08-20', 10000), gift('2026-09-05', 10000), gift('2026-10-10', 9999)]
    expect(goalProgress(monthly, octShort, TODAY).streak).toBe(0)
    const sepShort = [gift('2026-08-20', 10000), gift('2026-09-05', 1), gift('2026-10-10', 10000)]
    expect(goalProgress(monthly, sepShort, TODAY).streak).toBe(1) // only October since the gap
  })

  it('does not count periods before the goal was created', () => {
    const early = [gift('2026-06-01', 10000), gift('2026-07-01', 10000), ...metEveryMonth]
    expect(goalProgress(monthly, early, TODAY).streak).toBe(3)
  })

  it('editing or deleting a past gift recalculates it', () => {
    const edited = metEveryMonth.map((g) => (g.givenOn === '2026-09-05' ? { ...g, amountCents: 500 } : g))
    expect(goalProgress(monthly, edited, TODAY).streak).toBe(1)
    const deleted = metEveryMonth.filter((g) => g.givenOn !== '2026-10-10')
    expect(goalProgress(monthly, deleted, TODAY).streak).toBe(0)
  })

  it('moving a gift across a period boundary changes both periods', () => {
    // A gift dated Oct 31 moved to Nov 1: October drops below, November rises.
    const before = [gift('2026-08-20', 10000), gift('2026-09-05', 10000), gift('2026-10-31', 10000)]
    const after = [gift('2026-08-20', 10000), gift('2026-09-05', 10000), gift('2026-11-01', 10000)]
    expect(goalProgress(monthly, before, TODAY)).toMatchObject({ streak: 3, givenCents: 0 })
    expect(goalProgress(monthly, after, TODAY)).toMatchObject({ streak: 0, givenCents: 10000, met: true })
  })

  it('works for yearly goals across years', () => {
    const gifts = [gift('2025-12-31', 120000, 'g2'), gift('2026-01-01', 5000, 'g2')]
    expect(goalProgress(yearly, gifts, TODAY)).toMatchObject({ periodKey: '2026', givenCents: 5000, remainingCents: 115000, streak: 1 })
  })

  it('a goal created this period has no streak yet', () => {
    expect(goalProgress({ ...monthly, createdOn: '2026-11-03' }, [gift('2026-11-04', 10000)], TODAY)).toMatchObject({ streak: 0, met: true })
  })
})
