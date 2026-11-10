// Wording shared by the result screen and the Saved page.
export const STATUS_COPY = {
  due: { className: 'due', title: 'Zakat is due' },
  belowNisab: { className: 'below', title: 'Below nisab — no Zakat due' },
  notYetDue: { className: 'notyet', title: 'Not yet due' },
  // Nothing is due on this year's wealth, but past years' Zakat still is.
  unpaidPriorOnly: { className: 'due', title: 'Unpaid Zakat from previous years is due' },
  needsNisab: { className: 'notyet', title: 'Choose a nisab to see your result' },
  needsHawl: { className: 'notyet', title: 'Answer the one-year question to see your result' },
}

export function statusCopy(status) {
  return STATUS_COPY[status] ?? STATUS_COPY.belowNisab
}

// "3 hours old", "2 days old" — the age of the prices a result used (S5.1, S12.2).
export function priceAge(fetchedAt, now = Date.now()) {
  const t = Date.parse(fetchedAt)
  if (Number.isNaN(t)) return null
  const minutes = Math.max(0, Math.round((now - t) / 60000))
  if (minutes < 60) return minutes <= 1 ? 'just now' : `${minutes} minutes old`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} old`
  return `${Math.round(hours / 24)} days old`
}
