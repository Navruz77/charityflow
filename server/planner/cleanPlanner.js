// Checks goal and gift input for the planner routes (M7). Builds a clean
// copy from an allowlist; unknown fields are dropped. Text is stored as
// plain text and always shown as plain text (React escapes it).
export const MAX_AMOUNT_CENTS = 1e12 // $10 billion: far above any real gift
const NAME_MAX = 100
const RECIPIENT_MAX = 100
const NOTE_MAX = 500
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
// Control characters (except normal spaces) are removed from text.
// eslint-disable-next-line no-control-regex -- matching them is the point
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

class Invalid extends Error {
  constructor(field, message) {
    super(message)
    this.field = field
  }
}

function text(value, field, max, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new Invalid(field, 'This is required.')
    return null
  }
  if (typeof value !== 'string') throw new Invalid(field, 'Must be text.')
  const clean = value.replace(CONTROL, '').trim()
  if (required && clean === '') throw new Invalid(field, 'This is required.')
  if (clean.length > max) throw new Invalid(field, `Keep it to ${max} characters or fewer.`)
  return clean === '' ? null : clean
}

function amount(value) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_AMOUNT_CENTS) {
    throw new Invalid('amountCents', 'Enter an amount above $0.00.')
  }
  return value
}

// A gift date: a real calendar date, from 2000 up to one day after the
// server's today (a gift can't be in the future; one day covers time zones).
function giftDate(value, now) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) throw new Invalid('givenOn', 'Enter a date.')
  const t = Date.parse(`${value}T00:00:00Z`)
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== value) throw new Invalid('givenOn', 'Enter a real date.')
  if (value < '2000-01-01' || t > now + 24 * 60 * 60 * 1000) throw new Invalid('givenOn', 'The date cannot be in the future.')
  return value
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function wrap(fn) {
  try {
    return { ok: true, value: fn() }
  } catch (err) {
    if (err instanceof Invalid) return { ok: false, field: err.field, message: err.message }
    throw err
  }
}

// { name, amountCents, period } -> clean goal fields.
export function cleanGoal(body) {
  return wrap(() => {
    if (!body || typeof body !== 'object') throw new Invalid('goal', 'Not a goal.')
    if (body.period !== 'monthly' && body.period !== 'yearly') throw new Invalid('period', 'Choose monthly or yearly.')
    return { name: text(body.name, 'name', NAME_MAX, { required: true }), amountCents: amount(body.amountCents), period: body.period }
  })
}

// { amountCents, givenOn, recipient?, note?, goalId? } -> clean gift fields.
// goalId is only checked for shape here; the route checks it is the user's.
export function cleanGift(body, now = Date.now()) {
  return wrap(() => {
    if (!body || typeof body !== 'object') throw new Invalid('gift', 'Not a gift.')
    const goalId = body.goalId === undefined || body.goalId === null || body.goalId === '' ? null : body.goalId
    if (goalId !== null && (typeof goalId !== 'string' || !UUID.test(goalId))) throw new Invalid('goalId', 'Choose one of your goals.')
    return {
      amountCents: amount(body.amountCents),
      givenOn: giftDate(body.givenOn, now),
      recipient: text(body.recipient, 'recipient', RECIPIENT_MAX),
      note: text(body.note, 'note', NOTE_MAX),
      goalId,
    }
  })
}

// Database rows -> the shapes the browser uses.
export const goalFromRow = (r) => ({ id: r.id, name: r.name, amountCents: Number(r.amount_cents), period: r.period, createdAt: r.created_at })
export const giftFromRow = (r) => ({
  id: r.id,
  amountCents: Number(r.amount_cents),
  givenOn: r.given_on,
  recipient: r.recipient,
  note: r.note,
  goalId: r.goal_id,
  goalLabel: r.goal_label,
})
