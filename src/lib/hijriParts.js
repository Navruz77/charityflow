// Numeric dates for reminders (M6), shared by the server's reminder job and
// the screens so both always agree (M6 unknown 1). Uses the same Intl
// calendar as src/lib/hijri.js: Umm al-Qura, then the civil calendar if a
// browser lacks it. No new dependency.
const CALENDARS = ['islamic-umalqura', 'islamic-civil']

function hijriFormatter(timeZone) {
  for (const calendar of CALENDARS) {
    try {
      const f = new Intl.DateTimeFormat('en-US', { calendar, timeZone, year: 'numeric', month: 'numeric', day: 'numeric' })
      if (f.resolvedOptions().calendar === calendar) return f
    } catch {
      // try the next calendar
    }
  }
  return null
}

// Hijri { year, month, day } of the moment `date`, as seen in `timeZone`.
export function hijriParts(date, timeZone = 'UTC') {
  const f = hijriFormatter(timeZone)
  if (!f) return null
  const parts = Object.fromEntries(f.formatToParts(date).map((p) => [p.type, p.value]))
  const out = { year: Number.parseInt(parts.year, 10), month: Number(parts.month), day: Number(parts.day) }
  return Number.isInteger(out.month) && Number.isInteger(out.day) ? out : null
}

// Hijri parts of a calendar date written YYYY-MM-DD (e.g. a Zakat date).
// Noon UTC keeps it on the same day whatever the time zone.
export function hijriOfIsoDate(isoDate) {
  if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null
  const d = new Date(`${isoDate}T12:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== isoDate) return null
  return hijriParts(d, 'UTC')
}

// The local date (YYYY-MM-DD), hour (0-23) and weekday (0 = Sunday) of the
// moment `date` in `timeZone`.
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export function localParts(date, timeZone) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  })
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]))
  return {
    localDate: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour),
    weekday: WEEKDAYS.indexOf(p.weekday),
  }
}

export const HIJRI_MONTH_NAMES = [
  'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Jumada al-Awwal', 'Jumada al-Thani',
  'Rajab', 'Shaban', 'Ramadan', 'Shawwal', 'Dhul-Qadah', 'Dhul-Hijjah',
]
