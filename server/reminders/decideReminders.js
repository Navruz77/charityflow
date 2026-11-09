// Decides which reminders are due at a given moment (M6, S6.3 to S6.5).
// Pure: no database, no email, no clock. The caller passes `now`, so the
// same code runs for real and for a pretend "as-of" dry run.
import { hijriParts, localParts } from '../../src/lib/hijriParts.js'
import { REMINDER_TYPES } from '../../src/content/reminderText.js'

export const SEND_FROM_HOUR = 9 // nothing goes out before 09:00 local time
const RAMADAN = 9
const DHUL_HIJJAH = 12
const FRIDAY = 5

// Which types are due on this local day.
export function dueTypes({ weekday, hijriMonth, hijriDay }, zakatHijriMonth) {
  const due = new Set()
  // S6.3: every day of the Hijri month of the Zakat date; never without one.
  if (Number.isInteger(zakatHijriMonth) && hijriMonth === zakatHijriMonth) due.add('zakatMonth')
  // S6.4
  if (hijriMonth === RAMADAN) due.add('ramadan')
  if (weekday === FRIDAY) due.add('friday')
  if (hijriMonth === DHUL_HIJJAH && hijriDay === 1) due.add('dhulHijjah')
  return due
}

// `users`: [{ userId, timeZone, zakatHijriMonth, prefs: [{ type, enabled, inApp, email }] }]
// Returns { due: [{ userId, type, channel, localDate }], skipped: [{ userId, reason }] }.
// Each entry in `due` is one row the job will try to insert into
// reminders_sent; the table's unique key makes repeats harmless (NFR8).
export function decideReminders({ now, users }) {
  const due = []
  const skipped = []
  for (const user of users) {
    let local
    let hijri
    try {
      local = localParts(now, user.timeZone || 'UTC')
      hijri = hijriParts(now, user.timeZone || 'UTC')
    } catch {
      skipped.push({ userId: user.userId, reason: 'bad_time_zone' })
      continue
    }
    if (!hijri) {
      skipped.push({ userId: user.userId, reason: 'no_hijri_calendar' })
      continue
    }
    // M6 unknown 2: the first run after 09:00 sends, so a late run still does.
    if (local.hour < SEND_FROM_HOUR) {
      skipped.push({ userId: user.userId, reason: 'before_9' })
      continue
    }
    const today = dueTypes({ weekday: local.weekday, hijriMonth: hijri.month, hijriDay: hijri.day }, user.zakatHijriMonth)
    for (const pref of user.prefs) {
      if (!pref.enabled || !REMINDER_TYPES.includes(pref.type) || !today.has(pref.type)) continue
      if (pref.inApp) due.push({ userId: user.userId, type: pref.type, channel: 'inApp', localDate: local.localDate })
      if (pref.email) due.push({ userId: user.userId, type: pref.type, channel: 'email', localDate: local.localDate })
    }
  }
  return { due, skipped }
}
