// Reminder settings and in-app reminders for signed-in users (B.7, M6).
//   GET  /api/reminder-prefs   the four types (all off until turned on)
//   PUT  /api/reminder-prefs   { prefs: [4 x {type, enabled, inApp, email}], timeZone }
//   GET  /api/reminders        recent in-app reminders (A.23)
//   POST /api/reminders/read   { type, localDate } or { all: true }
// Every handler uses req.user.id from the verified session only.
import express from 'express'
import { requireUser } from '../auth/session.js'
import { cleanTimeZone } from '../auth/validate.js'
import { firstRefusal, tooMany } from '../auth/guards.js'
import { REMINDER_TYPES, reminderText } from '../../src/content/reminderText.js'

const LIST_DAYS = 30 // the in-app list shows the last 30 days
const LIST_LIMIT = 60
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// Checks the four settings. Returns the clean list or null.
export function cleanPrefs(raw) {
  if (!Array.isArray(raw) || raw.length !== REMINDER_TYPES.length) return null
  const seen = new Set()
  const out = []
  for (const p of raw) {
    if (!p || typeof p !== 'object' || !REMINDER_TYPES.includes(p.type) || seen.has(p.type)) return null
    if (![p.enabled, p.inApp, p.email].every((v) => typeof v === 'boolean')) return null
    // S6.5: a reminder that is on must go somewhere.
    if (p.enabled && !p.inApp && !p.email) return null
    seen.add(p.type)
    out.push({ type: p.type, enabled: p.enabled, inApp: p.inApp, email: p.email })
  }
  return out
}

export function createRemindersRouter({ auth, db, limits }) {
  const router = express.Router()
  const signedIn = requireUser(auth)

  const limited = (name) => (req, res, next) => {
    const refused = firstRefusal([[limits[name], req.user.id]])
    if (refused) return tooMany(res, refused.retryAfterSec)
    next()
  }

  router.get('/api/reminder-prefs', signedIn, limited('settingsReadUser'), async (req, res) => {
    const rows = await db.getReminderPrefs(req.user.id)
    const byType = new Map(rows.map((r) => [r.type, r]))
    res.json({
      prefs: REMINDER_TYPES.map((type) => {
        const r = byType.get(type)
        return { type, enabled: !!r?.enabled, inApp: !!r?.in_app, email: !!r?.email }
      }),
    })
  })

  router.put('/api/reminder-prefs', signedIn, limited('settingsWriteUser'), async (req, res) => {
    const prefs = cleanPrefs(req.body?.prefs)
    if (!prefs) {
      return res.status(400).json({
        error: 'invalid_prefs',
        message: 'Each reminder that is on needs "in the app", "by email" or both.',
      })
    }
    await db.saveReminderPrefs(req.user.id, prefs)
    // M6 unknown 4: refresh the stored time zone from the browser on every save.
    const timeZone = cleanTimeZone(req.body?.timeZone)
    if (timeZone) {
      await db.ensureProfile(req.user.id, timeZone)
      await db.updateTimeZone(req.user.id, timeZone)
    }
    res.json({ ok: true, timeZoneSaved: !!timeZone })
  })

  router.get('/api/reminders', signedIn, limited('settingsReadUser'), async (req, res) => {
    const since = new Date(Date.now() - LIST_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const rows = await db.listInAppReminders(req.user.id, since, LIST_LIMIT)
    const reminders = rows
      .filter((r) => reminderText[r.type])
      .map((r) => ({
        type: r.type,
        localDate: r.local_date,
        read: r.read_at !== null,
        title: reminderText[r.type].subject,
        text: reminderText[r.type].body,
      }))
    res.json({ reminders, unread: reminders.filter((r) => !r.read).length })
  })

  router.post('/api/reminders/read', signedIn, limited('settingsWriteUser'), async (req, res) => {
    if (req.body?.all === true) {
      await db.markRemindersRead(req.user.id)
      return res.json({ ok: true })
    }
    const { type, localDate } = req.body ?? {}
    if (!REMINDER_TYPES.includes(type) || typeof localDate !== 'string' || !ISO_DATE.test(localDate)) {
      return res.status(400).json({ error: 'invalid_reminder', message: 'Not a reminder.' })
    }
    await db.markRemindersRead(req.user.id, { type, localDate })
    res.json({ ok: true })
  })

  return router
}
