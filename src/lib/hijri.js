// Hijri date display using the platform's own Intl calendars — no new
// dependency. Tries the more precise umm-al-qura calendar first, falls
// back to the simpler civil calendar if the browser lacks it.
export function toHijriDisplay(isoDate) {
  const date = isoDate ? new Date(`${isoDate}T00:00:00`) : new Date()
  if (Number.isNaN(date.getTime())) return null

  for (const calendar of ['islamic-umalqura', 'islamic-civil']) {
    try {
      return new Intl.DateTimeFormat('en-US', { calendar, day: 'numeric', month: 'long', year: 'numeric' }).format(date)
    } catch {
      continue
    }
  }
  return null
}

export function toGregorianDisplay(isoDate) {
  const date = isoDate ? new Date(`${isoDate}T00:00:00`) : new Date()
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}
