// M7 route tests (S8.1, S8.2, NFR5): in-memory fakes, no Supabase.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import { createAuthLimits } from '../auth/rateLimit.js'
import { encodeSession } from '../auth/session.js'
import { MAX_GOALS_PER_USER } from './planner.js'

const USERS = { 'token-a': { id: '00000000-0000-4000-8000-00000000000a', email: 'a@x.com' }, 'token-b': { id: '00000000-0000-4000-8000-00000000000b', email: 'b@x.com' } }
const A = USERS['token-a'].id
let state
let server
let base

const newId = () => `00000000-0000-4000-9000-${String(++state.n).padStart(12, '0')}`
const mine = (rows, userId, id) => rows.find((r) => r.id === id && r.user_id === userId)

// Behaves like the real tables, including "goal removed -> goal_id null".
function makeDb() {
  return {
    async listGoals(userId) {
      return state.goals.filter((g) => g.user_id === userId)
    },
    async getGoal(userId, id) {
      return mine(state.goals, userId, id) ?? null
    },
    async countGoals(userId) {
      return state.goals.filter((g) => g.user_id === userId).length
    },
    async insertGoal(userId, g) {
      const row = { id: newId(), user_id: userId, name: g.name, amount_cents: g.amountCents, period: g.period, created_at: '2026-11-08T12:00:00Z' }
      state.goals.push(row)
      return row
    },
    async updateGoal(userId, id, g) {
      const row = mine(state.goals, userId, id)
      if (!row) return null
      Object.assign(row, { name: g.name, amount_cents: g.amountCents, period: g.period })
      return row
    },
    async removeGoal(userId, id) {
      const goal = mine(state.goals, userId, id)
      if (!goal) return false
      for (const g of state.gifts) if (g.goal_id === id && g.user_id === userId) Object.assign(g, { goal_label: goal.name, goal_id: null })
      state.goals = state.goals.filter((x) => x !== goal)
      return true
    },
    async listGifts(userId) {
      return state.gifts.filter((g) => g.user_id === userId)
    },
    async countGifts(userId) {
      return state.gifts.filter((g) => g.user_id === userId).length
    },
    async insertGift(userId, g) {
      const row = { id: newId(), user_id: userId, amount_cents: g.amountCents, given_on: g.givenOn, recipient: g.recipient, note: g.note, goal_id: g.goalId, goal_label: null }
      state.gifts.push(row)
      return row
    },
    async updateGift(userId, id, g) {
      const row = mine(state.gifts, userId, id)
      if (!row) return null
      Object.assign(row, { amount_cents: g.amountCents, given_on: g.givenOn, recipient: g.recipient, note: g.note, goal_id: g.goalId })
      if (g.goalId !== null) row.goal_label = null
      return row
    },
    async deleteGift(userId, id) {
      const before = state.gifts.length
      state.gifts = state.gifts.filter((g) => !(g.id === id && g.user_id === userId))
      return state.gifts.length < before
    },
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
  }
  const db = new Proxy({}, { get: (_, k) => (...a) => makeDb()[k](...a) })
  const limits = new Proxy({}, { get: (_, k) => state.limits[k] })
  const app = createApp({ auth, db, breach: { isBreached: async () => false }, limits })
  await new Promise((r) => {
    server = app.listen(0, r)
  })
  base = `http://127.0.0.1:${server.address().port}`
})
afterAll(() => new Promise((r) => server.close(r)))
beforeEach(() => {
  state = { goals: [], gifts: [], n: 0, limits: createAuthLimits() }
})

async function call(token, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Cookie: `cf_session=${encodeSession(token, 'r')}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, data: await res.json().catch(() => null) }
}
const addGoal = (token, body = { name: 'Monthly sadaqah', amountCents: 10000, period: 'monthly' }) => call(token, 'POST', '/api/goals', body)
const addGift = (token, body) => call(token, 'POST', '/api/gifts', { amountCents: 2500, givenOn: '2026-11-05', ...body })

describe('goals (S8.1)', () => {
  it('guests are refused', async () => {
    expect((await call(null, 'GET', '/api/goals')).status).toBe(401)
    expect((await addGoal(null)).status).toBe(401)
    expect((await call(null, 'GET', '/api/gifts')).status).toBe(401)
  })

  it('create, change and list', async () => {
    const made = await addGoal('token-a')
    expect(made.status).toBe(201)
    expect(made.data.goal).toMatchObject({ name: 'Monthly sadaqah', amountCents: 10000, period: 'monthly' })
    const id = made.data.goal.id
    const changed = await call('token-a', 'PUT', `/api/goals/${id}`, { name: 'Yearly', amountCents: 120000, period: 'yearly' })
    expect(changed.data.goal).toMatchObject({ name: 'Yearly', amountCents: 120000, period: 'yearly' })
    expect((await call('token-a', 'GET', '/api/goals')).data.goals).toHaveLength(1)
  })

  it('refuses bad goals', async () => {
    const bad = [
      { name: '', amountCents: 100, period: 'monthly' },
      { name: '   ', amountCents: 100, period: 'monthly' },
      { name: 'x'.repeat(101), amountCents: 100, period: 'monthly' },
      { name: 'ok', amountCents: 0, period: 'monthly' },
      { name: 'ok', amountCents: 10.5, period: 'monthly' },
      { name: 'ok', amountCents: -100, period: 'monthly' },
      { name: 'ok', amountCents: 100, period: 'weekly' },
      { name: 42, amountCents: 100, period: 'monthly' },
    ]
    for (const body of bad) expect((await addGoal('token-a', body)).status, JSON.stringify(body)).toBe(400)
    expect(state.goals).toHaveLength(0)
  })

  it('stores names as plain text and strips control characters', async () => {
    const r = await addGoal('token-a', { name: '  <b>Mosque</b>\u0000 fund ', amountCents: 100, period: 'monthly' })
    expect(r.data.goal.name).toBe('<b>Mosque</b> fund')
  })

  it('removing a goal keeps its gifts, labelled with its name, linked to no goal', async () => {
    const goalId = (await addGoal('token-a')).data.goal.id
    await addGift('token-a', { goalId })
    expect((await call('token-a', 'DELETE', `/api/goals/${goalId}`)).status).toBe(200)
    const gifts = (await call('token-a', 'GET', '/api/gifts')).data.gifts
    expect(gifts).toHaveLength(1)
    expect(gifts[0]).toMatchObject({ goalId: null, goalLabel: 'Monthly sadaqah' })
  })

  it('caps the number of goals', async () => {
    for (let i = 0; i < MAX_GOALS_PER_USER; i++) state.goals.push({ id: `x${i}`, user_id: A })
    expect((await addGoal('token-a')).status).toBe(409)
  })
})

describe('gifts (S8.2)', () => {
  it('log with optional recipient, note and goal; edit; delete', async () => {
    const goalId = (await addGoal('token-a')).data.goal.id
    const made = await addGift('token-a', { recipient: 'Local food bank', note: 'Cash', goalId })
    expect(made.status).toBe(201)
    expect(made.data.gift).toMatchObject({ amountCents: 2500, givenOn: '2026-11-05', recipient: 'Local food bank', note: 'Cash', goalId })
    const plain = await addGift('token-a', {})
    expect(plain.data.gift).toMatchObject({ recipient: null, note: null, goalId: null })

    const id = made.data.gift.id
    const edited = await call('token-a', 'PUT', `/api/gifts/${id}`, { amountCents: 3000, givenOn: '2026-10-31', goalId })
    expect(edited.data.gift).toMatchObject({ amountCents: 3000, givenOn: '2026-10-31', recipient: null })
    expect((await call('token-a', 'DELETE', `/api/gifts/${id}`)).status).toBe(200)
    expect((await call('token-a', 'GET', '/api/gifts')).data.gifts).toHaveLength(1)
  })

  it('choosing a goal for a gift from a removed goal clears the old label', async () => {
    const oldGoal = (await addGoal('token-a')).data.goal.id
    const giftId = (await addGift('token-a', { goalId: oldGoal })).data.gift.id
    await call('token-a', 'DELETE', `/api/goals/${oldGoal}`)
    // Editing other fields keeps the label...
    let g = (await call('token-a', 'PUT', `/api/gifts/${giftId}`, { amountCents: 100, givenOn: '2026-11-01' })).data.gift
    expect(g.goalLabel).toBe('Monthly sadaqah')
    // ...choosing a new goal clears it.
    const newGoal = (await addGoal('token-a', { name: 'New', amountCents: 500, period: 'yearly' })).data.goal.id
    g = (await call('token-a', 'PUT', `/api/gifts/${giftId}`, { amountCents: 100, givenOn: '2026-11-01', goalId: newGoal })).data.gift
    expect(g).toMatchObject({ goalId: newGoal, goalLabel: null })
  })

  it('refuses bad gifts', async () => {
    const tomorrowPlus = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10)
    const bad = [
      { amountCents: 0 },
      { amountCents: '25' },
      { givenOn: '2026-02-30' },
      { givenOn: 'yesterday' },
      { givenOn: tomorrowPlus },
      { givenOn: '1999-12-31' },
      { recipient: 'x'.repeat(101) },
      { note: 'x'.repeat(501) },
      { goalId: 'not-a-uuid' },
    ]
    for (const body of bad) expect((await addGift('token-a', body)).status, JSON.stringify(body)).toBe(400)
    expect(state.gifts).toHaveLength(0)
  })
})

describe('two users (NFR5)', () => {
  it("cannot see, change, delete or attach to the other's goals and gifts", async () => {
    const goalA = (await addGoal('token-a')).data.goal.id
    const giftA = (await addGift('token-a', { goalId: goalA })).data.gift.id

    expect((await call('token-b', 'GET', '/api/goals')).data.goals).toEqual([])
    expect((await call('token-b', 'GET', '/api/gifts')).data.gifts).toEqual([])
    expect((await call('token-b', 'PUT', `/api/goals/${goalA}`, { name: 'hijack', amountCents: 1, period: 'monthly' })).status).toBe(404)
    expect((await call('token-b', 'DELETE', `/api/goals/${goalA}`)).status).toBe(404)
    expect((await call('token-b', 'PUT', `/api/gifts/${giftA}`, { amountCents: 1, givenOn: '2026-11-01' })).status).toBe(404)
    expect((await call('token-b', 'DELETE', `/api/gifts/${giftA}`)).status).toBe(404)
    // B cannot log a gift against A's goal.
    const cross = await addGift('token-b', { goalId: goalA })
    expect(cross.status).toBe(400)
    expect(cross.data.field).toBe('goalId')

    expect(state.goals.find((g) => g.id === goalA).name).toBe('Monthly sadaqah')
    expect(state.gifts.find((g) => g.id === giftA)).toMatchObject({ amount_cents: 2500, goal_id: goalA })
    expect(state.gifts.filter((g) => g.user_id !== A)).toHaveLength(0)
  })

  it('ignores a user id sent in the body', async () => {
    await addGoal('token-a', { name: 'n', amountCents: 1, period: 'monthly', user_id: USERS['token-b'].id })
    expect(state.goals[0].user_id).toBe(A)
  })
})
