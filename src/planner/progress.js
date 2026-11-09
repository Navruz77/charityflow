// Sadaqah planner rules (M7, S8.1 to S8.3). Pure functions: no network, no
// screens, no clock (the caller passes `today`). Money is integer cents.
//
// Periods are calendar months or calendar years in the user's stored time
// zone (M7 unknown 2). Gift dates are plain calendar dates (YYYY-MM-DD), so
// the time zone only matters for "today" and for the day a goal was created.
import { localParts } from '../lib/hijriParts.js'

// "2026-11" for a monthly goal, "2026" for a yearly one.
export function periodKey(isoDate, period) {
  return period === 'yearly' ? isoDate.slice(0, 4) : isoDate.slice(0, 7)
}

// The period just before `key` ("2026-01" -> "2025-12", "2026" -> "2025").
export function previousPeriod(key) {
  if (key.length === 4) return String(Number(key) - 1)
  const [y, m] = key.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

// Today's date (YYYY-MM-DD) in a time zone; UTC if the zone is unknown.
export function todayIn(timeZone, now = new Date()) {
  try {
    return localParts(now, timeZone).localDate
  } catch {
    return localParts(now, 'UTC').localDate
  }
}

// Total given toward one goal in each period: Map(periodKey -> cents).
// Only gifts that point at this goal count; a gift with no goal, or whose
// goal was removed (goalId null), counts toward none.
export function totalsByPeriod(goal, gifts) {
  const totals = new Map()
  for (const g of gifts) {
    if (g.goalId !== goal.id) continue
    const key = periodKey(g.givenOn, goal.period)
    totals.set(key, (totals.get(key) ?? 0) + g.amountCents)
  }
  return totals
}

// Progress for one goal (S8.3, A.27).
// goal: { id, amountCents, period: 'monthly'|'yearly', createdOn: 'YYYY-MM-DD' }
// gifts: [{ goalId, amountCents, givenOn: 'YYYY-MM-DD' }]
// Returns { periodKey, givenCents, remainingCents, met, streak }.
//
// streak: how many completed periods in a row, ending with the one just
// before the current period, reached the amount. A completed period below
// the amount ends it (back to 0). Only periods from the goal's creation
// period count (M7 unknown 1). The current period is not "completed" yet,
// so it shows as `met` but never breaks or adds to the streak.
export function goalProgress(goal, gifts, today) {
  const totals = totalsByPeriod(goal, gifts)
  const current = periodKey(today, goal.period)
  const first = periodKey(goal.createdOn, goal.period)
  const givenCents = totals.get(current) ?? 0

  let streak = 0
  for (let key = previousPeriod(current); key >= first; key = previousPeriod(key)) {
    if ((totals.get(key) ?? 0) >= goal.amountCents) streak += 1
    else break
  }

  return {
    periodKey: current,
    givenCents,
    remainingCents: Math.max(0, goal.amountCents - givenCents),
    met: givenCents >= goal.amountCents, // exactly at the amount is met
    streak,
  }
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// "November 2026" or "2026".
export function periodLabel(key) {
  if (key.length === 4) return key
  const [y, m] = key.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}
