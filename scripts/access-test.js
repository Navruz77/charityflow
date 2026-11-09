// M4 live access test (NFR5). Run by hand, never in CI:
//
//   1. npm run build && npm start            (in one terminal)
//   2. npm run test:access                   (in another)
//
// Needs in .env: SUPABASE_URL, SUPABASE_SECRET_KEY, and
// SUPABASE_PUBLISHABLE_KEY (used ONLY here, to act as a user straight
// against the database and prove the row-level rules). APP_URL defaults
// to http://localhost:3000.
//
// It creates two throwaway confirmed users (no email is sent), checks that
// user A can never read, change or delete user B's data -- first through our
// /api routes, then through the database rules alone -- checks the admin log,
// deletes B through DELETE /api/account and confirms no row of B remains,
// then removes A. It cleans up even if a check fails.

import { calculateZakat } from '../src/engine/calculateZakat.js'

const APP = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')
const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const SECRET = process.env.SUPABASE_SECRET_KEY
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY

if (!SB || !SECRET || !PUBLISHABLE) {
  console.error('Set SUPABASE_URL, SUPABASE_SECRET_KEY and SUPABASE_PUBLISHABLE_KEY in .env first.')
  process.exit(2)
}

let failures = 0
function check(name, passed, detail = '') {
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${passed || !detail ? '' : `  (${detail})`}`)
  if (!passed) failures += 1
}

async function http(url, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, ok: res.ok, data, setCookie: res.headers.get('set-cookie') }
}

// --- as the server (secret key): set-up, cleanup and checking results
const asServer = (path, opts = {}) => http(SB + path, { ...opts, headers: { apikey: SECRET, ...opts.headers } })
// --- as a user straight against the database (publishable key + their token)
const asUser = (token, path, opts = {}) =>
  http(SB + path, {
    ...opts,
    headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${token}`, Prefer: 'return=representation', ...opts.headers },
  })

// A tiny browser for our app that keeps the session cookie.
function appBrowser() {
  let cookie = null
  return {
    async call(method, path, body) {
      const res = await http(APP + path, { method, body, headers: cookie ? { Cookie: cookie } : {} })
      if (res.setCookie) {
        const pair = res.setCookie.split(';')[0]
        cookie = pair.endsWith('=') ? null : pair
      }
      return res
    },
    get cookie() {
      return cookie
    },
  }
}

const USER_TABLES = ['profiles', 'calculations', 'reminder_prefs', 'reminders_sent', 'goals', 'gifts']

async function countRows(table, userId) {
  const res = await asServer(`/rest/v1/${table}?user_id=eq.${userId}&select=user_id`)
  return Array.isArray(res.data) ? res.data.length : NaN
}

async function main() {
  const tag = Math.random().toString(36).slice(2, 8)
  const password = `Test-${tag}-pass1`
  const emailA = `cf-access-a-${tag}@example.com`
  const emailB = `cf-access-b-${tag}@example.com`
  const created = []

  try {
    // ---- set-up: two confirmed users
    for (const email of [emailA, emailB]) {
      const res = await asServer('/auth/v1/admin/users', {
        method: 'POST',
        body: { email, password, email_confirm: true },
      })
      if (!res.ok) throw new Error(`could not create test user (${res.status}): ${JSON.stringify(res.data)}`)
      created.push(res.data.id)
    }
    const [idA, idB] = created
    console.log(`Test users: A=${emailA}  B=${emailB}\n`)

    // ---- sign in through our app
    const a = appBrowser()
    const b = appBrowser()
    const loginA = await a.call('POST', '/api/auth/login', { email: emailA, password, timeZone: 'Europe/London' })
    const loginB = await b.call('POST', '/api/auth/login', { email: emailB, password, timeZone: 'Asia/Tokyo' })
    check('A and B sign in through /api/auth/login', loginA.status === 200 && loginB.status === 200, `${loginA.status}/${loginB.status}`)
    check('session cookie is HttpOnly', /HttpOnly/i.test(loginA.setCookie || ''))
    check('login response carries no token', !/token/i.test(JSON.stringify(loginA.data)))

    // ---- S3.3: identical message for unknown email and wrong password
    const wrongPass = await appBrowser().call('POST', '/api/auth/login', { email: emailA, password: 'Wrong-password-1x' })
    const unknown = await appBrowser().call('POST', '/api/auth/login', { email: `nobody-${tag}@example.com`, password })
    check(
      'unknown email and wrong password give the identical answer',
      wrongPass.status === unknown.status && JSON.stringify(wrongPass.data) === JSON.stringify(unknown.data),
    )

    // ---- route layer
    console.log('\n-- /api routes, signed in as A --')
    const profA = await a.call('GET', '/api/profile')
    check('A reads only their own profile', profA.data?.email === emailA && profA.data?.timeZone === 'Europe/London')
    await a.call('PUT', `/api/profile?user_id=${idB}`, { timeZone: 'America/Chicago', user_id: idB, userId: idB })
    const profB = await asServer(`/rest/v1/profiles?user_id=eq.${idB}&select=time_zone`)
    check("A cannot change B's profile by naming B's id", profB.data?.[0]?.time_zone === 'Asia/Tokyo', JSON.stringify(profB.data))
    check("A (not admin) cannot read B through the admin route", (await a.call('GET', `/api/admin/users/${idB}`)).status === 403)
    check('A (not admin) cannot read admin counts', (await a.call('GET', '/api/admin/stats')).status === 403)
    await a.call('DELETE', '/api/account', { userId: idB })
    await a.call('DELETE', '/api/account', { confirm: 'DELETE', password: 'Wrong-pass-123x', userId: idB })
    check('DELETE /api/account without confirmation or with a wrong password removes nothing', (await countRows('profiles', idB)) === 1 && (await countRows('profiles', idA)) === 1)

    // ---- M5: saved calculations through /api/calculations (S4.2, NFR5)
    console.log('\n-- /api/calculations --')
    const inputs = {
      cashCents: 300000, savingsCents: 0, gold: { grams: 51, valueCents: null }, silver: { grams: 0, valueCents: null },
      gems: [], securities: [], crypto: [], realEstateForSale: [], rentals: [], businesses: [], retirement: [],
      debts: { dueNowCents: 0, installments12mCents: 0 }, nisab: 'silver', heldOneLunarYear: true, zakatDate: '2026-11-08',
    }
    const pricesUsed = { goldUsdPerGram: 134.34, silverUsdPerGram: 1.96, fetchedAt: '2026-11-01T06:00:12.000Z' }
    const calcBody = { savedAt: '2026-11-02T10:00:00.000Z', inputs, nisabChoice: 'silver', pricesUsed, result: calculateZakat(inputs, pricesUsed) }
    check('a guest cannot save to an account', (await appBrowser().call('POST', '/api/calculations', { calculations: [calcBody] })).status === 401)
    const savedA = await a.call('POST', '/api/calculations', { calculations: [{ ...calcBody, user_id: idB }] })
    check('A saves a calculation', savedA.status === 201, `${savedA.status} ${JSON.stringify(savedA.data)}`)
    const calcIdA = savedA.data?.calculations?.[0]?.id
    const rowA = (await asServer(`/rest/v1/calculations?id=eq.${calcIdA}&select=*`)).data?.[0]
    check('the row belongs to A even though the body named B', rowA?.user_id === idA)
    check(
      'the row holds every field (date, entries, nisab, prices, result)',
      rowA?.zakat_date === '2026-11-08' && rowA?.nisab_choice === 'silver' && rowA?.inputs?.cashCents === 300000 &&
        rowA?.prices_used?.goldUsdPerGram === 134.34 && rowA?.result?.zakatDueCents === 24628 && Date.parse(rowA?.saved_at) === Date.parse(calcBody.savedAt),
    )
    const tampered = await a.call('POST', '/api/calculations', { calculations: [{ ...calcBody, result: { ...calcBody.result, zakatDueCents: 1 } }] })
    check('a tampered result is refused', tampered.status === 400, `${tampered.status}`)
    const listB = await b.call('GET', '/api/calculations')
    check("B's list does not include A's calculation", listB.status === 200 && !listB.data.calculations.some((c) => c.id === calcIdA))
    const listA = await a.call('GET', '/api/calculations')
    check("A's list has exactly A's calculation", listA.status === 200 && listA.data.calculations.length === 1 && listA.data.calculations[0].id === calcIdA)
    const crossDel = await b.call('DELETE', `/api/calculations/${calcIdA}`)
    check("B cannot delete A's calculation", crossDel.status === 404 && (await countRows('calculations', idA)) === 1, `${crossDel.status}`)
    check('A deletes their own calculation', (await a.call('DELETE', `/api/calculations/${calcIdA}`)).status === 200 && (await countRows('calculations', idA)) === 0)

    // ---- M7: goals and gifts through /api/goals and /api/gifts (S8.1, S8.2, NFR5)
    console.log('\n-- /api/goals and /api/gifts --')
    const goalRes = await a.call('POST', '/api/goals', { name: 'Access test goal', amountCents: 10000, period: 'monthly', user_id: idB })
    const goalIdA = goalRes.data?.goal?.id
    check('A creates a goal', goalRes.status === 201 && !!goalIdA, `${goalRes.status}`)
    const giftRes = await a.call('POST', '/api/gifts', { amountCents: 2500, givenOn: '2026-11-05', recipient: 'Food bank', goalId: goalIdA })
    const giftIdA = giftRes.data?.gift?.id
    check('A logs a gift toward it', giftRes.status === 201 && !!giftIdA, `${giftRes.status}`)
    check('the goal belongs to A even though the body named B', (await countRows('goals', idA)) === 1 && (await countRows('goals', idB)) === 0)
    check("B's goal and gift lists are empty", (await b.call('GET', '/api/goals')).data?.goals?.length === 0 && (await b.call('GET', '/api/gifts')).data?.gifts?.length === 0)
    check("B cannot change A's goal", (await b.call('PUT', `/api/goals/${goalIdA}`, { name: 'x', amountCents: 1, period: 'monthly' })).status === 404)
    check("B cannot delete A's goal", (await b.call('DELETE', `/api/goals/${goalIdA}`)).status === 404 && (await countRows('goals', idA)) === 1)
    check("B cannot change A's gift", (await b.call('PUT', `/api/gifts/${giftIdA}`, { amountCents: 1, givenOn: '2026-11-01' })).status === 404)
    check("B cannot delete A's gift", (await b.call('DELETE', `/api/gifts/${giftIdA}`)).status === 404 && (await countRows('gifts', idA)) === 1)
    check("B cannot log a gift against A's goal", (await b.call('POST', '/api/gifts', { amountCents: 1, givenOn: '2026-11-01', goalId: goalIdA })).status === 400 && (await countRows('gifts', idB)) === 0)
    const removed = await a.call('DELETE', `/api/goals/${goalIdA}`)
    const keptGift = (await asServer(`/rest/v1/gifts?id=eq.${giftIdA}&select=goal_id,goal_label,user_id`)).data?.[0]
    check(
      "removing A's goal keeps the gift, labelled, linked to no goal, still A's",
      removed.status === 200 && keptGift?.goal_id === null && keptGift?.goal_label === 'Access test goal' && keptGift?.user_id === idA,
      JSON.stringify(keptGift),
    )
    check('A deletes the gift', (await a.call('DELETE', `/api/gifts/${giftIdA}`)).status === 200 && (await countRows('gifts', idA)) === 0)

    // ---- give B a row in every table, as B (own token) where users may write
    const tokenA = (await http(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUBLISHABLE }, body: { email: emailA, password } })).data?.access_token
    const tokenB = (await http(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUBLISHABLE }, body: { email: emailB, password } })).data?.access_token
    if (!tokenA || !tokenB) throw new Error('could not get user tokens with the publishable key')

    console.log('\n-- database rules alone (B writes own rows) --')
    const calc = await asUser(tokenB, '/rest/v1/calculations', { method: 'POST', body: { user_id: idB, nisab_choice: 'silver', inputs: {}, prices_used: {}, result: {} } })
    check('B can add their own calculation', calc.status === 201, `${calc.status} ${JSON.stringify(calc.data)}`)
    const pref = await asUser(tokenB, '/rest/v1/reminder_prefs', { method: 'POST', body: { user_id: idB, type: 'friday' } })
    check('B can add their own reminder pref', pref.status === 201, `${pref.status}`)
    const goal = await asUser(tokenB, '/rest/v1/goals', { method: 'POST', body: { user_id: idB, name: 'Test', amount_cents: 1000, period: 'monthly' } })
    check('B can add their own goal', goal.status === 201, `${goal.status}`)
    const gift = await asUser(tokenB, '/rest/v1/gifts', { method: 'POST', body: { user_id: idB, amount_cents: 500, given_on: '2026-11-07', goal_id: goal.data?.[0]?.id } })
    check('B can add their own gift', gift.status === 201, `${gift.status}`)
    const sentByUser = await asUser(tokenB, '/rest/v1/reminders_sent', { method: 'POST', body: { user_id: idB, type: 'friday', channel: 'inApp', local_date: '2026-11-06' } })
    check('B cannot insert reminders_sent (server only)', !sentByUser.ok, `${sentByUser.status}`)
    const sent = await asServer('/rest/v1/reminders_sent', { method: 'POST', body: { user_id: idB, type: 'friday', channel: 'inApp', local_date: '2026-11-06' } })
    check('server can insert reminders_sent', sent.status === 201, `${sent.status}`)
    const markRead = await asUser(tokenB, `/rest/v1/reminders_sent?user_id=eq.${idB}`, { method: 'PATCH', body: { read_at: new Date().toISOString() } })
    check('B can mark their own reminder read', markRead.ok && markRead.data?.length === 1, `${markRead.status}`)

    // A goal belonging to A cannot be attached to B's gift (same-owner rule).
    const goalA = await asUser(tokenA, '/rest/v1/goals', { method: 'POST', body: { user_id: idA, name: 'A goal', amount_cents: 1000, period: 'yearly' } })
    const crossGift = await asUser(tokenB, '/rest/v1/gifts', { method: 'POST', body: { user_id: idB, amount_cents: 1, given_on: '2026-11-07', goal_id: goalA.data?.[0]?.id } })
    check("B cannot attach a gift to A's goal", !crossGift.ok, `${crossGift.status}`)

    console.log('\n-- database rules alone (A attacks B) --')
    for (const table of USER_TABLES) {
      const read = await asUser(tokenA, `/rest/v1/${table}?user_id=eq.${idB}`)
      check(`A cannot read B's ${table}`, read.ok && Array.isArray(read.data) && read.data.length === 0, `${read.status}`)
      const patch = await asUser(tokenA, `/rest/v1/${table}?user_id=eq.${idB}`, { method: 'PATCH', body: table === 'reminders_sent' ? { read_at: null } : { user_id: idA } })
      check(`A cannot change B's ${table}`, !patch.ok || (Array.isArray(patch.data) && patch.data.length === 0), `${patch.status}`)
      const del = await asUser(tokenA, `/rest/v1/${table}?user_id=eq.${idB}`, { method: 'DELETE' })
      check(`A cannot delete B's ${table}`, !del.ok || (Array.isArray(del.data) && del.data.length === 0), `${del.status}`)
    }
    const forged = await asUser(tokenA, '/rest/v1/calculations', { method: 'POST', body: { user_id: idB, nisab_choice: 'gold', inputs: {}, prices_used: {}, result: {} } })
    check('A cannot add a row owned by B', !forged.ok, `${forged.status}`)
    for (const table of ['admins', 'admin_access_log', 'price_cache']) {
      const r = await asUser(tokenA, `/rest/v1/${table}?select=*`)
      check(`a signed-in user cannot read ${table}`, !r.ok || (Array.isArray(r.data) && r.data.length === 0), `${r.status}`)
    }
    const rpc = await asUser(tokenA, '/rest/v1/rpc/admin_read_user_data', { method: 'POST', body: { p_admin: idA, p_subject: idB } })
    check('a signed-in user cannot call admin_read_user_data', !rpc.ok, `${rpc.status}`)
    for (const table of USER_TABLES) {
      check(`B's ${table} row is still there`, (await countRows(table, idB)) >= 1)
    }

    // ---- admin read logs exactly one row
    console.log('\n-- admin --')
    await asServer('/rest/v1/admins', { method: 'POST', body: { user_id: idA } })
    const logPath = `/rest/v1/admin_access_log?admin_id=eq.${idA}&select=id`
    const before = (await asServer(logPath)).data.length
    const adminRead = await a.call('GET', `/api/admin/users/${idB}`)
    const after = (await asServer(logPath)).data.length
    check('admin can read a user through /api/admin/users/:id', adminRead.status === 200 && adminRead.data?.calculations?.length === 1, `${adminRead.status}`)
    check('one admin read writes exactly one log row', after - before === 1, `${before} -> ${after}`)
    check('admin sees counts', (await a.call('GET', '/api/admin/stats')).status === 200)
    await asServer(`/rest/v1/admins?user_id=eq.${idA}`, { method: 'DELETE' })

    // ---- delete B through the app; nothing of B remains
    console.log('\n-- delete account (S3.6) --')
    const bCookie = b.cookie
    const delB = await b.call('DELETE', '/api/account', { confirm: 'DELETE', password })
    check('B deletes their account', delB.status === 200, `${delB.status}`)
    created.splice(created.indexOf(idB), 1)
    for (const table of USER_TABLES) {
      check(`no ${table} row of B remains`, (await countRows(table, idB)) === 0)
    }
    const logB = await asServer(`/rest/v1/admin_access_log?subject_user_id=eq.${idB}&select=id`)
    check('admin log no longer names B', logB.data?.length === 0)
    const authB = await asServer(`/auth/v1/admin/users/${idB}`)
    check("B's sign-in record is gone", authB.status === 404, `${authB.status}`)
    const replay = await http(`${APP}/api/profile`, { headers: { Cookie: bCookie } })
    check("B's old cookie no longer works", replay.status === 401, `${replay.status}`)

    // ---- sign out ends the session
    const aCookie = a.cookie
    await a.call('POST', '/api/auth/logout')
    const afterLogout = await http(`${APP}/api/profile`, { headers: { Cookie: aCookie } })
    check("A's old cookie stops working after sign-out", afterLogout.status === 401, `${afterLogout.status}`)
  } finally {
    for (const id of created) {
      await asServer(`/rest/v1/admins?user_id=eq.${id}`, { method: 'DELETE' })
      await asServer(`/auth/v1/admin/users/${id}`, { method: 'DELETE' })
    }
  }

  console.log(failures === 0 ? '\nAll access checks passed.' : `\n${failures} check(s) FAILED.`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('Access test crashed:', err.message)
  process.exit(1)
})
