// Sends deliberately wrong data to every route that writes something, and
// checks each one answers 400 (never 500, never a stored row). In-memory
// fakes only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import { createAuthLimits } from '../auth/rateLimit.js'
import { encodeSession } from '../auth/session.js'

const USER = { id: '00000000-0000-4000-8000-00000000000a', email: 'a@x.com' }
const writes = []
let server
let base

beforeAll(async () => {
  const auth = {
    async getUser(t) {
      return t === 'tok' ? { ok: true, status: 200, data: USER } : { ok: false, status: 403, data: {} }
    },
    async refresh() {
      return { ok: false, status: 400, data: {} }
    },
  }
  // Any database call is recorded; reads return empty, writes are a failure of this test.
  const db = new Proxy({}, {
    get: (_, name) => async (...args) => {
      if (/^(insert|update|save|set|remove|delete|mark|ensure)/.test(name)) writes.push(name)
      if (name.startsWith('count')) return 0
      if (name.startsWith('list') || name === 'getReminderPrefs') return []
      if (name === 'getGoal' || name === 'getProfile') return null
      // A stored row, for the control case below.
      if (name.startsWith('insert')) {
        return { id: '00000000-0000-4000-9000-000000000009', name: 'x', amount_cents: 1, period: 'monthly', created_at: 'now', given_on: '2026-11-01', goal_id: null }
      }
      return args.length ? null : []
    },
  })
  const app = createApp({ auth, db, breach: { isBreached: async () => false }, limits: createAuthLimits() })
  await new Promise((r) => {
    server = app.listen(0, r)
  })
  base = `http://127.0.0.1:${server.address().port}`
})
afterAll(() => new Promise((r) => server.close(r)))

async function send(method, path, rawBody) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: `cf_session=${encodeSession('tok', 'r')}` },
    body: rawBody,
  })
  return res.status
}

// Raw JSON text, so values like 1e400 (Infinity once parsed) can be sent.
const HOSTILE = [
  'null',
  '[]',
  '"text"',
  '42',
  '{}',
  '{"amountCents":"100","givenOn":"2026-11-01"}',
  '{"amountCents":1e400,"givenOn":"2026-11-01"}',
  '{"amountCents":-1,"givenOn":"2026-11-01"}',
  '{"amountCents":100,"givenOn":["2026-11-01"]}',
  '{"amountCents":100,"givenOn":"2026-11-01","note":{"$gt":""}}',
  '{"name":["a"],"amountCents":100,"period":"monthly"}',
  '{"name":"ok","amountCents":100,"period":{"toString":"monthly"}}',
  '{"__proto__":{"admin":true},"name":"ok","amountCents":0,"period":"monthly"}',
  '{"calculations":"all"}',
  '{"calculations":[null]}',
  '{"calculations":[{"inputs":[],"result":{}}]}',
  '{"prefs":"on"}',
  '{"prefs":[{"type":"ramadan","enabled":1,"inApp":true,"email":false}]}',
  '{"zakatDate":{"y":2026}}',
  '{"zakatDate":"2026-11-09\' OR 1=1 --"}',
  '{"timeZone":"../../etc/passwd"}',
  '{"type":"ramadan","localDate":"2026-11-09;drop table"}',
]

const ROUTES = [
  ['POST', '/api/goals'],
  ['PUT', '/api/goals/00000000-0000-4000-9000-000000000001'],
  ['POST', '/api/gifts'],
  ['PUT', '/api/gifts/00000000-0000-4000-9000-000000000001'],
  ['POST', '/api/calculations'],
  ['PUT', '/api/reminder-prefs'],
  ['PUT', '/api/profile'],
  ['POST', '/api/reminders/read'],
]

describe('hostile input on every write route', () => {
  it('is refused with 400 and nothing is written', async () => {
    for (const [method, path] of ROUTES) {
      for (const body of HOSTILE) {
        const status = await send(method, path, body)
        expect(status, `${method} ${path} ${body}`).toBe(400)
      }
    }
    expect(writes).toEqual([])
  })

  it('broken JSON gets a plain 400', async () => {
    expect(await send('POST', '/api/goals', '{"name": ')).toBe(400)
  })

  it('ids in the URL must be real ids', async () => {
    for (const id of ['1', "1' OR '1'='1", '..%2F..%2Fadmin', '00000000-0000-4000-9000-00000000000g']) {
      expect(await send('DELETE', `/api/goals/${id}`, '{}'), id).toBe(400)
      expect(await send('DELETE', `/api/gifts/${id}`, '{}'), id).toBe(400)
      expect(await send('DELETE', `/api/calculations/${id}`, '{}'), id).toBe(400)
    }
  })

  it('control: a valid request through the same setup is accepted and written', async () => {
    writes.length = 0
    expect(await send('POST', '/api/goals', '{"name":"Monthly","amountCents":100,"period":"monthly"}')).toBe(201)
    expect(await send('POST', '/api/gifts', '{"amountCents":250,"givenOn":"2026-11-01"}')).toBe(201)
    expect(writes).toEqual(['insertGoal', 'insertGift'])
  })
})
