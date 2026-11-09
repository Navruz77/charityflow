// M6 tests: the plan's dry-run cases (S6.3, S6.4), once-only delivery
// (S6.5, NFR8), time zones, and the routes. Fakes only: no Supabase, no Brevo.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { decideReminders } from './decideReminders.js'
import { runReminderJob } from './runReminderJob.js'
import { createApp } from '../app.js'
import { createAuthLimits } from '../auth/rateLimit.js'
import { encodeSession } from '../auth/session.js'
import { hijriOfIsoDate } from '../../src/lib/hijriParts.js'

// Real calendar dates (Umm al-Qura, checked with the same Intl the app uses).
const RAMADAN_FIRST = '2027-02-08'
const RAMADAN_LAST = '2027-03-08'
const DHUL_HIJJAH_FIRST = '2027-05-07'
const JUMADA_THANI_FIRST = '2026-11-11' // Hijri month 6
const JUMADA_THANI_LAST = '2026-12-09'

const days = (from, to) => {
  const out = []
  for (let t = Date.parse(`${from}T12:00:00Z`); t <= Date.parse(`${to}T12:00:00Z`); t += 864e5) out.push(new Date(t).toISOString().slice(0, 10))
  return out
}
// 10:00 New York time on a given day.
const at10NY = (iso) => new Date(`${iso}T15:00:00Z`)
const on = (type, inApp = true, email = false) => ({ type, enabled: true, inApp, email })
const user = (prefs, extra = {}) => ({ userId: 'u1', timeZone: 'America/New_York', zakatHijriMonth: null, prefs, ...extra })
const dueTypesOn = (iso, u) => decideReminders({ now: at10NY(iso), users: [u] }).due.map((d) => d.type)

describe('dry runs for each type (S6.3, S6.4)', () => {
  it('the test dates really are those Hijri dates', () => {
    expect(hijriOfIsoDate(RAMADAN_FIRST)).toMatchObject({ month: 9, day: 1 })
    expect(hijriOfIsoDate(RAMADAN_LAST).month).toBe(9)
    expect(hijriOfIsoDate('2027-03-09').month).toBe(10)
    expect(hijriOfIsoDate(DHUL_HIJJAH_FIRST)).toMatchObject({ month: 12, day: 1 })
  })

  it('Zakat month: every day of the month, and not the day after', () => {
    const u = user([on('zakatMonth')], { zakatHijriMonth: 6 })
    for (const d of days(JUMADA_THANI_FIRST, JUMADA_THANI_LAST)) expect(dueTypesOn(d, u), d).toEqual(['zakatMonth'])
    expect(dueTypesOn('2026-12-10', u)).toEqual([])
    expect(dueTypesOn('2026-11-10', u)).toEqual([])
  })

  it('Zakat month: never without a Zakat date', () => {
    const u = user([on('zakatMonth')])
    for (const d of days(JUMADA_THANI_FIRST, JUMADA_THANI_LAST)) expect(dueTypesOn(d, u)).toEqual([])
  })

  it('Ramadan: every day of Ramadan only', () => {
    const u = user([on('ramadan')])
    for (const d of days(RAMADAN_FIRST, RAMADAN_LAST)) expect(dueTypesOn(d, u), d).toEqual(['ramadan'])
    expect(dueTypesOn('2027-02-07', u)).toEqual([])
    expect(dueTypesOn('2027-03-09', u)).toEqual([])
  })

  it('Friday: only on Fridays', () => {
    const u = user([on('friday')])
    for (const d of days('2026-11-09', '2026-11-22')) {
      const isFriday = new Date(`${d}T12:00:00Z`).getUTCDay() === 5
      expect(dueTypesOn(d, u), d).toEqual(isFriday ? ['friday'] : [])
    }
  })

  it('Dhul-Hijjah: only its first day', () => {
    const u = user([on('dhulHijjah')])
    expect(dueTypesOn(DHUL_HIJJAH_FIRST, u)).toEqual(['dhulHijjah'])
    expect(dueTypesOn('2027-05-06', u)).toEqual([])
    expect(dueTypesOn('2027-05-08', u)).toEqual([])
  })

  it('nothing when a type is off, or turned on with no channel', () => {
    const off = user([{ type: 'ramadan', enabled: false, inApp: true, email: true }])
    expect(dueTypesOn(RAMADAN_FIRST, off)).toEqual([])
    const noChannel = user([{ type: 'ramadan', enabled: true, inApp: false, email: false }])
    expect(dueTypesOn(RAMADAN_FIRST, noChannel)).toEqual([])
  })

  it('each chosen channel is a separate reminder', () => {
    const r = decideReminders({ now: at10NY(RAMADAN_FIRST), users: [user([on('ramadan', true, true)])] })
    expect(r.due.map((d) => d.channel)).toEqual(['inApp', 'email'])
    expect(r.due[0].localDate).toBe(RAMADAN_FIRST)
  })

  it('nothing before 09:00 local time, then the first run after 9 sends (late runs still count)', () => {
    const u = user([on('friday')])
    expect(decideReminders({ now: new Date('2026-11-13T13:59:00Z'), users: [u] }).due).toEqual([]) // 08:59 NY
    expect(decideReminders({ now: new Date('2026-11-13T14:00:00Z'), users: [u] }).due).toHaveLength(1) // 09:00 NY
    expect(decideReminders({ now: new Date('2026-11-14T04:30:00Z'), users: [u] }).due).toHaveLength(1) // 23:30 NY, still Friday
  })

  it('two users in different time zones each get it on their own local date', () => {
    const tashkent = { ...user([on('friday')]), userId: 'tash', timeZone: 'Asia/Tashkent' }
    const newYork = { ...user([on('friday')]), userId: 'ny' }
    // 05:00 UTC Friday: 10:00 Friday in Tashkent, 00:00 Friday in New York (before 9).
    let r = decideReminders({ now: new Date('2026-11-13T05:00:00Z'), users: [tashkent, newYork] })
    expect(r.due.map((d) => [d.userId, d.localDate])).toEqual([['tash', '2026-11-13']])
    // 20:00 UTC Friday: 01:00 Saturday in Tashkent, 15:00 Friday in New York.
    r = decideReminders({ now: new Date('2026-11-13T20:00:00Z'), users: [tashkent, newYork] })
    expect(r.due.map((d) => [d.userId, d.localDate])).toEqual([['ny', '2026-11-13']])
  })

  it('a bad stored time zone skips that user instead of failing the run', () => {
    const r = decideReminders({ now: at10NY(RAMADAN_FIRST), users: [user([on('ramadan')], { timeZone: 'Mars/Base' }), { ...user([on('ramadan')]), userId: 'ok' }] })
    expect(r.due.map((d) => d.userId)).toEqual(['ok'])
    expect(r.skipped).toEqual([{ userId: 'u1', reason: 'bad_time_zone' }])
  })
})

// ------------------------------------------------------------- the job

function makeStore() {
  const sent = new Map() // "user|type|channel|date" -> row
  const key = (r) => `${r.userId}|${r.type}|${r.channel}|${r.localDate}`
  return {
    sent,
    users: [],
    async listReminderUsers() {
      return this.users
    },
    async insertReminderSent(row) {
      if (sent.has(key(row))) return false
      sent.set(key(row), { ...row, readAt: null })
      return true
    },
    async deleteReminderSent(row) {
      sent.delete(key(row))
    },
  }
}
function makeMailer(ok = true) {
  const outbox = []
  return { outbox, async send(msg) { outbox.push(msg); return { ok } } }
}
const fakeAuth = { async getUserEmail(id) { return `${id}@example.com` } }

describe('the job (S6.5, NFR8)', () => {
  it('a dry run reports and writes or sends nothing', async () => {
    const db = makeStore()
    db.users = [user([on('ramadan', true, true)])]
    const mailer = makeMailer()
    const r = await runReminderJob({ now: at10NY(RAMADAN_FIRST), db, auth: fakeAuth, mailer, dryRun: true })
    expect(r.dryRun).toBe(true)
    expect(r.due).toHaveLength(2)
    // The workflow logs are public: no user id or email in a dry run.
    expect(r.due[0].user).toBe('user 1')
    expect(JSON.stringify(r)).not.toMatch(/u1|@/)
    expect(db.sent.size).toBe(0)
    expect(mailer.outbox).toHaveLength(0)
  })

  it('running twice in an hour, or again later that day, creates no duplicate and sends one email', async () => {
    const db = makeStore()
    db.users = [user([on('ramadan', true, true)])]
    const mailer = makeMailer()
    const first = await runReminderJob({ now: at10NY(RAMADAN_FIRST), db, auth: fakeAuth, mailer })
    expect(first).toMatchObject({ inApp: 1, emailSent: 1, alreadySent: 0 })
    const again = await runReminderJob({ now: new Date(at10NY(RAMADAN_FIRST).getTime() + 20 * 60e3), db, auth: fakeAuth, mailer })
    const evening = await runReminderJob({ now: new Date(`${RAMADAN_FIRST}T23:00:00Z`), db, auth: fakeAuth, mailer })
    expect(again).toMatchObject({ inApp: 0, emailSent: 0, alreadySent: 2 })
    expect(evening).toMatchObject({ inApp: 0, emailSent: 0, alreadySent: 2 })
    expect(db.sent.size).toBe(2)
    expect(mailer.outbox).toHaveLength(1)
    // The next day is a new reminder.
    await runReminderJob({ now: at10NY('2027-02-09'), db, auth: fakeAuth, mailer })
    expect(mailer.outbox).toHaveLength(2)
  })

  it('the email has no financial figures and links to the settings', async () => {
    const db = makeStore()
    db.users = [user([on('zakatMonth', false, true)], { zakatHijriMonth: 9 })]
    const mailer = makeMailer()
    await runReminderJob({ now: at10NY(RAMADAN_FIRST), db, auth: fakeAuth, mailer, appUrl: 'https://charityflow.onrender.com' })
    const [msg] = mailer.outbox
    expect(msg.to).toBe('u1@example.com')
    expect(msg.subject).toBe('Your Zakat month')
    expect(msg.text).not.toMatch(/\$|\d+\.\d{2}/)
    expect(msg.text).toContain('https://charityflow.onrender.com/#/reminders')
  })

  it('when Brevo refuses, the day is given back so the next run tries again', async () => {
    const db = makeStore()
    db.users = [user([on('friday', false, true)])]
    const failing = makeMailer(false)
    const r = await runReminderJob({ now: at10NY('2026-11-13'), db, auth: fakeAuth, mailer: failing })
    expect(r).toMatchObject({ emailSent: 0, emailFailed: 1 })
    expect(db.sent.size).toBe(0)
    const working = makeMailer(true)
    const retry = await runReminderJob({ now: new Date('2026-11-13T16:00:00Z'), db, auth: fakeAuth, mailer: working })
    expect(retry).toMatchObject({ emailSent: 1 })
    expect(db.sent.size).toBe(1)
  })

  it('turning a reminder off stops it from the next occasion', async () => {
    const db = makeStore()
    db.users = [user([on('friday')])]
    const mailer = makeMailer()
    await runReminderJob({ now: at10NY('2026-11-13'), db, auth: fakeAuth, mailer })
    db.users = [user([{ type: 'friday', enabled: false, inApp: true, email: false }])]
    const next = await runReminderJob({ now: at10NY('2026-11-20'), db, auth: fakeAuth, mailer })
    expect(next.due).toBe(0)
    expect(db.sent.size).toBe(1)
  })
})

// ------------------------------------------------------------- routes

const USERS = { 'token-a': { id: '00000000-0000-4000-8000-00000000000a', email: 'a@x.com' }, 'token-b': { id: '00000000-0000-4000-8000-00000000000b', email: 'b@x.com' } }
const TOKEN = 'job-token-for-tests-0123456789abcdef'
let server
let base
let state

function makeRouteDb() {
  return {
    async ensureProfile(userId, tz) {
      if (!state.profiles.has(userId)) state.profiles.set(userId, { time_zone: tz, zakat_date: null, zakat_hijri_month: null, zakat_hijri_day: null })
    },
    async updateTimeZone(userId, tz) {
      state.profiles.get(userId).time_zone = tz
    },
    async getProfile(userId) {
      return state.profiles.get(userId) ?? null
    },
    async setZakatDate(userId, z) {
      Object.assign(state.profiles.get(userId), { zakat_date: z.date, zakat_hijri_month: z.hijriMonth, zakat_hijri_day: z.hijriDay })
    },
    async getReminderPrefs(userId) {
      return state.prefs.filter((p) => p.user_id === userId)
    },
    async saveReminderPrefs(userId, prefs) {
      state.prefs = state.prefs.filter((p) => p.user_id !== userId)
      for (const p of prefs) state.prefs.push({ user_id: userId, type: p.type, enabled: p.enabled, in_app: p.inApp, email: p.email })
    },
    async listInAppReminders(userId) {
      return state.sent.filter((r) => r.user_id === userId && r.channel === 'inApp')
    },
    async markRemindersRead(userId, one) {
      for (const r of state.sent) {
        if (r.user_id !== userId || r.read_at) continue
        if (one && (r.type !== one.type || r.local_date !== one.localDate)) continue
        r.read_at = 'now'
      }
    },
    async listReminderUsers() {
      const ids = [...new Set(state.prefs.filter((p) => p.enabled).map((p) => p.user_id))]
      return ids.map((id) => ({
        userId: id,
        timeZone: state.profiles.get(id)?.time_zone ?? 'UTC',
        zakatHijriMonth: state.profiles.get(id)?.zakat_hijri_month ?? null,
        prefs: state.prefs.filter((p) => p.user_id === id).map((p) => ({ type: p.type, enabled: p.enabled, inApp: p.in_app, email: p.email })),
      }))
    },
    async insertReminderSent(row) {
      if (state.sent.some((r) => r.user_id === row.userId && r.type === row.type && r.channel === row.channel && r.local_date === row.localDate)) return false
      state.sent.push({ user_id: row.userId, type: row.type, channel: row.channel, local_date: row.localDate, read_at: null })
      return true
    },
    async deleteReminderSent() {},
  }
}

beforeAll(async () => {
  const auth = {
    async getUser(t) {
      return USERS[t] ? { ok: true, status: 200, data: USERS[t] } : { ok: false, status: 403, data: {} }
    },
    async refresh() {
      return { ok: false, status: 400, data: {} }
    },
    async getUserEmail(id) {
      return Object.values(USERS).find((u) => u.id === id)?.email ?? null
    },
  }
  const db = new Proxy({}, { get: (_, k) => (...a) => makeRouteDb()[k](...a) })
  const limits = new Proxy({}, { get: (_, k) => state.limits[k] })
  const mailer = { async send(m) { state.outbox.push(m); return { ok: true } } }
  const app = createApp({ auth, db, breach: { isBreached: async () => false }, mailer, limits, now: () => state.now })
  await new Promise((r) => {
    server = app.listen(0, r)
  })
  base = `http://127.0.0.1:${server.address().port}`
})
afterAll(() => new Promise((r) => server.close(r)))
beforeEach(() => {
  state = { profiles: new Map(), prefs: [], sent: [], outbox: [], limits: createAuthLimits(), now: at10NY(RAMADAN_FIRST) }
  process.env.JOB_TOKEN = TOKEN
})

async function call(token, method, path, body, headers = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Cookie: `cf_session=${encodeSession(token, 'r')}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, data: await res.json().catch(() => null) }
}
const job = (body = {}, token = TOKEN) => call(null, 'POST', '/api/jobs/reminders', body, { Authorization: `Bearer ${token}` })
const allPrefs = (over = {}) =>
  ['zakatMonth', 'ramadan', 'friday', 'dhulHijjah'].map((type) => ({ type, enabled: false, inApp: false, email: false, ...over[type] }))

describe('reminder settings (S6.5) and the Zakat date (S6.1)', () => {
  it('everything is off until turned on', async () => {
    const r = await call('token-a', 'GET', '/api/reminder-prefs')
    expect(r.status).toBe(200)
    expect(r.data.prefs.every((p) => !p.enabled && !p.inApp && !p.email)).toBe(true)
    expect((await call(null, 'GET', '/api/reminder-prefs')).status).toBe(401)
  })

  it('saves channels separately and refreshes the time zone', async () => {
    const r = await call('token-a', 'PUT', '/api/reminder-prefs', { prefs: allPrefs({ ramadan: { enabled: true, inApp: false, email: true } }), timeZone: 'Asia/Tashkent' })
    expect(r.status).toBe(200)
    const back = (await call('token-a', 'GET', '/api/reminder-prefs')).data.prefs.find((p) => p.type === 'ramadan')
    expect(back).toEqual({ type: 'ramadan', enabled: true, inApp: false, email: true })
    expect(state.profiles.get(USERS['token-a'].id).time_zone).toBe('Asia/Tashkent')
  })

  it('refuses a reminder that is on with no channel, unknown types, and missing types', async () => {
    const bad = [
      allPrefs({ friday: { enabled: true } }),
      [...allPrefs().slice(0, 3), { type: 'birthday', enabled: false, inApp: false, email: false }],
      allPrefs().slice(0, 3),
      allPrefs({ friday: { enabled: 'yes' } }),
    ]
    for (const prefs of bad) expect((await call('token-a', 'PUT', '/api/reminder-prefs', { prefs })).status).toBe(400)
    expect(state.prefs).toHaveLength(0)
  })

  it('sets, changes and removes the Zakat date, storing its Hijri month and day', async () => {
    await call('token-a', 'PUT', '/api/profile', { timeZone: 'America/New_York' })
    let r = await call('token-a', 'PUT', '/api/profile', { zakatDate: RAMADAN_FIRST })
    expect(r.status).toBe(200)
    let p = (await call('token-a', 'GET', '/api/profile')).data
    expect(p).toMatchObject({ zakatDate: RAMADAN_FIRST, zakatHijriMonth: 9, zakatHijriDay: 1 })
    r = await call('token-a', 'PUT', '/api/profile', { zakatDate: DHUL_HIJJAH_FIRST, zakatHijriMonth: 3 })
    p = (await call('token-a', 'GET', '/api/profile')).data
    expect(p).toMatchObject({ zakatDate: DHUL_HIJJAH_FIRST, zakatHijriMonth: 12 }) // the browser can't choose the month
    await call('token-a', 'PUT', '/api/profile', { zakatDate: null })
    p = (await call('token-a', 'GET', '/api/profile')).data
    expect(p).toMatchObject({ zakatDate: null, zakatHijriMonth: null, zakatHijriDay: null })
    for (const zakatDate of ['2026-02-30', 'tomorrow', '3026-01-01', 20261108]) {
      expect((await call('token-a', 'PUT', '/api/profile', { zakatDate })).status, String(zakatDate)).toBe(400)
    }
  })
})

describe('the job route (B.7)', () => {
  it('needs the job token; a guest or a signed-in user cannot run it', async () => {
    expect((await call(null, 'POST', '/api/jobs/reminders', {})).status).toBe(401)
    expect((await call('token-a', 'POST', '/api/jobs/reminders', {})).status).toBe(401)
    expect((await job({}, 'wrong-token-wrong-token-wrong-token')).status).toBe(401)
    process.env.JOB_TOKEN = 'short'
    expect((await job({}, 'short')).status).toBe(503)
  })

  it('end to end: in-app reminder appears once, email sent once, marked read', async () => {
    await call('token-a', 'PUT', '/api/reminder-prefs', { prefs: allPrefs({ ramadan: { enabled: true, inApp: true, email: true } }), timeZone: 'America/New_York' })
    const dry = await job({ asOf: `${RAMADAN_FIRST}T15:00:00Z` })
    expect(dry.data.dryRun).toBe(true)
    expect(dry.data.due).toHaveLength(2)
    expect(state.sent).toHaveLength(0)

    expect((await job()).data).toMatchObject({ inApp: 1, emailSent: 1 })
    expect((await job()).data).toMatchObject({ inApp: 0, emailSent: 0, alreadySent: 2 })
    expect(state.outbox.map((m) => m.to)).toEqual(['a@x.com'])

    const list = (await call('token-a', 'GET', '/api/reminders')).data
    expect(list.unread).toBe(1)
    expect(list.reminders[0]).toMatchObject({ type: 'ramadan', localDate: RAMADAN_FIRST, read: false, title: 'Ramadan reminder' })
    // B sees none of A's reminders and can't mark them read.
    expect((await call('token-b', 'GET', '/api/reminders')).data.reminders).toEqual([])
    await call('token-b', 'POST', '/api/reminders/read', { all: true })
    expect((await call('token-a', 'GET', '/api/reminders')).data.unread).toBe(1)

    await call('token-a', 'POST', '/api/reminders/read', { type: 'ramadan', localDate: RAMADAN_FIRST })
    expect((await call('token-a', 'GET', '/api/reminders')).data.unread).toBe(0)
    expect((await call('token-a', 'POST', '/api/reminders/read', { type: 'x', localDate: 'y' })).status).toBe(400)
  })

  it('refuses a bad as-of time', async () => {
    expect((await job({ asOf: 'next tuesday' })).status).toBe(400)
  })
})
