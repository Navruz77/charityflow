// M5 tests for /api/calculations (S4.2, S3.5, NFR5). The real Express app
// runs against in-memory fakes, so no test touches Supabase.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import { createAuthLimits } from '../auth/rateLimit.js'
import { encodeSession } from '../auth/session.js'
import { calculateZakat } from '../../src/engine/calculateZakat.js'
import { MAX_PER_REQUEST, MAX_SAVED_PER_USER } from './calculations.js'

const USER_A = { id: '00000000-0000-4000-8000-00000000000a', email: 'a@x.com' }
const USER_B = { id: '00000000-0000-4000-8000-00000000000b', email: 'b@x.com' }
const TOKENS = { 'token-a': USER_A, 'token-b': USER_B }

let rows // the fake `calculations` table
let counter
let server
let base
let limits

function makeDb() {
  return {
    async listCalculations(userId, limit) {
      return rows
        .filter((r) => r.user_id === userId)
        .sort((x, y) => y.saved_at.localeCompare(x.saved_at))
        .slice(0, limit)
    },
    async countCalculations(userId, upTo) {
      return Math.min(rows.filter((r) => r.user_id === userId).length, upTo)
    },
    async insertCalculations(userId, newRows) {
      const added = newRows.map((r) => {
        counter += 1
        return { ...r, user_id: userId, id: `00000000-0000-4000-9000-${String(counter).padStart(12, '0')}` }
      })
      rows.push(...added)
      return added
    },
    async deleteCalculation(userId, id) {
      const i = rows.findIndex((r) => r.id === id && r.user_id === userId)
      if (i === -1) return false
      rows.splice(i, 1)
      return true
    },
  }
}

const auth = {
  async getUser(token) {
    const u = TOKENS[token]
    return u ? { ok: true, status: 200, data: u } : { ok: false, status: 403, data: {} }
  },
  async refresh() {
    return { ok: false, status: 400, data: {} }
  },
}

beforeAll(async () => {
  const db = new Proxy({}, { get: (_, k) => (...a) => makeDb()[k](...a) })
  const lim = new Proxy({}, { get: (_, k) => limits[k] })
  const app = createApp({ auth, db, breach: { isBreached: async () => false }, limits: lim })
  await new Promise((resolve) => {
    server = app.listen(0, resolve)
  })
  base = `http://127.0.0.1:${server.address().port}`
})

afterAll(() => new Promise((resolve) => server.close(resolve)))

beforeEach(() => {
  rows = []
  counter = 0
  limits = createAuthLimits()
})

// Calls the app as `token`'s user (or as a guest with no token).
async function call(token, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Cookie: `cf_session=${encodeSession(token, 'refresh')}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, data: await res.json().catch(() => null) }
}

// A calculation exactly as the browser builds it (src/lib/savedCalculations.js).
const PRICES = { goldUsdPerGram: 134.34, silverUsdPerGram: 1.96, fetchedAt: '2026-11-01T06:00:12.000Z' }
function makeCalc(overrides = {}) {
  const inputs = {
    cashCents: 300000,
    savingsCents: 0,
    gold: { grams: '51', valueCents: null },
    silver: { grams: '', valueCents: null },
    gems: [{ purpose: 'personal', valueCents: 0 }],
    securities: [{ purpose: 'longTerm', countInFull: false, valueCents: 0 }],
    crypto: [{ purpose: 'longTerm', valueCents: 0 }],
    realEstateForSale: [{ valueCents: 0 }],
    rentals: [{ rentCollectedUnspentCents: 0, expensesPaidCents: 0 }],
    businesses: [{ cashCents: 0, inventoryCents: 0, receivablesCents: 0, liabilitiesCents: 0 }],
    retirement: [{ method: 'whenAccessible', vestedBalanceCents: 0, penaltyTaxCents: 0 }],
    debts: { dueNowCents: 0, installments12mCents: 0 },
    nisab: 'silver',
    heldOneLunarYear: true,
    zakatDate: '2026-11-08',
    ...overrides.inputs,
  }
  const pricesUsed = { ...PRICES, ...overrides.pricesUsed }
  const result = calculateZakat(inputs, pricesUsed)
  return {
    savedAt: '2026-11-02T10:00:00.000Z',
    inputs,
    nisabChoice: inputs.nisab,
    pricesUsed,
    result: { ...result, ...overrides.result },
    ...overrides.top,
  }
}

const save = (token, ...calcs) => call(token, 'POST', '/api/calculations', { calculations: calcs })

describe('save to my account (S4.2)', () => {
  it('guests are refused and nothing is stored', async () => {
    expect((await save(null, makeCalc())).status).toBe(401)
    expect((await call(null, 'GET', '/api/calculations')).status).toBe(401)
    expect(rows).toHaveLength(0)
  })

  it('stores every field and lists it back', async () => {
    const calc = makeCalc()
    const res = await save('token-a', calc)
    expect(res.status).toBe(201)
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.user_id).toBe(USER_A.id)
    expect(row.saved_at).toBe(calc.savedAt)
    expect(row.zakat_date).toBe('2026-11-08')
    expect(row.nisab_choice).toBe('silver')
    expect(row.prices_used).toEqual(PRICES)
    expect(row.inputs.cashCents).toBe(300000)
    expect(row.inputs.gold.grams).toBe(51) // typed text stored as a number
    // B.6 example: net 985134, nisab 120023, zakat 24628, due.
    expect(row.result.netCents).toBe(985134)
    expect(row.result.nisab.valueCents).toBe(120023)
    expect(row.result.zakatDueCents).toBe(24628)
    expect(row.result.status).toBe('due')

    const list = await call('token-a', 'GET', '/api/calculations')
    expect(list.status).toBe(200)
    expect(list.data.calculations).toHaveLength(1)
    const back = list.data.calculations[0]
    expect(back).toMatchObject({ savedAt: calc.savedAt, nisabChoice: 'silver', pricesUsed: PRICES })
    expect(back.zakatDate.gregorian).toBe('2026-11-08')
    expect(back.result.zakatDueCents).toBe(24628)
    expect(JSON.stringify(list.data)).not.toContain('user_id')
  })

  it('stores the new debt boxes and unpaid Zakat, with an older save still accepted', async () => {
    const newShape = makeCalc({
      inputs: {
        gems: undefined,
        debts: { dueNowCents: 0, creditCardCents: 20000, mortgageNextPrincipalCents: 0, personalLoansCents: 0, owedToFamilyCents: 0, unpaidTaxesBillsCents: 0, otherLiabilitiesCents: 0 },
        unpaidZakat: [{ amountCents: 300000 }],
      },
    })
    expect((await save('token-a', newShape)).status).toBe(201)
    expect(rows[0].inputs.debts.creditCardCents).toBe(20000)
    expect(rows[0].inputs.unpaidZakat).toEqual([{ amountCents: 300000 }])
    expect(rows[0].result.zakatDueCents).toBe(newShape.result.zakatDueCents)
    expect(rows[0].result.unpaidPriorZakatCents).toBe(300000)
    // Below nisab this year, but last year's Zakat is still owed.
    const onlyPrior = makeCalc({ inputs: { cashCents: 0, gold: { grams: '', valueCents: null }, unpaidZakat: [{ amountCents: 300000 }] } })
    expect(onlyPrior.result.status).toBe('unpaidPriorOnly')
    expect((await save('token-a', onlyPrior)).status).toBe(201)
    // makeCalc's default is the older shape (gems, installments box).
    expect((await save('token-a', makeCalc())).status).toBe(201)
  })

  it('ignores a user id sent in the body', async () => {
    await save('token-a', makeCalc({ top: { user_id: USER_B.id, userId: USER_B.id } }))
    expect(rows[0].user_id).toBe(USER_A.id)
  })

  it('drops unknown fields instead of storing them', async () => {
    await save('token-a', makeCalc({ inputs: { email: 'leak@x.com', note: 'x'.repeat(500) }, top: { extra: 'nope' } }))
    expect(JSON.stringify(rows[0])).not.toMatch(/leak@x\.com|nope|xxxxx/)
  })
})

describe('server checks what it stores', () => {
  it('refuses a result that does not match the engine', async () => {
    const res = await save('token-a', makeCalc({ result: { zakatDueCents: 1 } }))
    expect(res.status).toBe(400)
    expect(res.data.field).toBe('result.zakatDueCents')
    expect(rows).toHaveLength(0)
  })

  it('refuses bad inputs, naming the field', async () => {
    const cases = [
      [{ inputs: { cashCents: -5 } }, 'cashCents'],
      [{ inputs: { cashCents: 12.5 } }, 'cashCents'],
      [{ inputs: { cashCents: '300000' } }, 'cashCents'],
      [{ inputs: { gems: [{ purpose: 'hack', valueCents: 0 }] } }, 'gems[0].purpose'],
      [{ inputs: { gems: Array.from({ length: 26 }, () => ({ purpose: 'personal', valueCents: 0 })) } }, 'gems'],
      [{ inputs: { nisab: 'platinum' } }, 'nisab'],
      [{ inputs: { debts: { creditCardCents: -1 } } }, 'debts.creditCardCents'],
      [{ inputs: { unpaidZakat: [{ amountCents: 'lots' }] } }, 'unpaidZakat[0].amountCents'],
      [{ inputs: { unpaidZakat: Array.from({ length: 26 }, () => ({ amountCents: 0 })) } }, 'unpaidZakat'],
      [{ inputs: { heldOneLunarYear: 'yes' } }, 'heldOneLunarYear'],
      [{ inputs: { zakatDate: '2026-13-45' } }, 'zakatDate'],
      [{ inputs: { securities: [{ purpose: 'longTerm', valueCents: 0, zakatableSharePct: 150 }] } }, 'securities[0].zakatableSharePct'],
      [{ pricesUsed: { goldUsdPerGram: 5000 } }, 'pricesUsed.goldUsdPerGram'],
      [{ pricesUsed: { silverUsdPerGram: 0 } }, 'pricesUsed.silverUsdPerGram'],
      [{ pricesUsed: { fetchedAt: '2099-01-01T00:00:00Z' } }, 'pricesUsed.fetchedAt'],
      [{ top: { savedAt: 'yesterday' } }, 'savedAt'],
      [{ top: { nisabChoice: 'gold' } }, 'nisabChoice'],
    ]
    for (const [overrides, field] of cases) {
      const res = await save('token-a', makeCalc(overrides))
      expect(res.status, field).toBe(400)
      expect(res.data.field).toBe(field)
    }
    expect(rows).toHaveLength(0)
  })

  it('refuses a calculation with no result (nisab or year not answered)', async () => {
    const calc = makeCalc()
    calc.inputs.heldOneLunarYear = null
    calc.result = calculateZakat(calc.inputs, PRICES)
    expect((await save('token-a', calc)).status).toBe(400)
  })

  it('saves all or nothing, and limits the batch size', async () => {
    const res = await save('token-a', makeCalc(), makeCalc({ inputs: { cashCents: -1 } }))
    expect(res.status).toBe(400)
    expect(res.data.index).toBe(1)
    expect(rows).toHaveLength(0)
    const tooMany = Array.from({ length: MAX_PER_REQUEST + 1 }, () => makeCalc())
    expect((await save('token-a', ...tooMany)).status).toBe(400)
    expect((await call('token-a', 'POST', '/api/calculations', { calculations: [] })).status).toBe(400)
    expect((await call('token-a', 'POST', '/api/calculations', makeCalc())).status).toBe(400)
  })

  it('caps how many one account can keep', async () => {
    for (let i = 0; i < MAX_SAVED_PER_USER; i++) {
      rows.push({ id: `x${i}`, user_id: USER_A.id, saved_at: '2026-11-01T00:00:00Z' })
    }
    const res = await save('token-a', makeCalc())
    expect(res.status).toBe(409)
    expect(res.data.error).toBe('too_many_saved')
  })

  it('rate limits saving per user', async () => {
    let last
    for (let i = 0; i < 41; i++) last = await save('token-a', makeCalc())
    expect(last.status).toBe(429)
    // Another user is not affected.
    expect((await save('token-b', makeCalc())).status).toBe(201)
  })
})

describe('guest-save transfer (S3.5)', () => {
  it('adds a batch with the original dates, entries and results', async () => {
    const one = makeCalc({ top: { savedAt: '2026-11-01T09:00:00.000Z' } })
    const two = makeCalc({ inputs: { nisab: 'gold' }, top: { savedAt: '2026-11-03T09:00:00.000Z' } })
    const res = await save('token-a', one, two)
    expect(res.status).toBe(201)
    expect(rows).toHaveLength(2)
    const list = (await call('token-a', 'GET', '/api/calculations')).data.calculations
    expect(list.map((c) => c.savedAt)).toEqual(['2026-11-03T09:00:00.000Z', '2026-11-01T09:00:00.000Z'])
    // B.6: the same wealth is below the gold nisab.
    expect(list[0].result.status).toBe('belowNisab')
    expect(list[0].result.zakatDueCents).toBe(0)
    expect(list[1].result.zakatDueCents).toBe(24628)
  })
})

describe('two users (NFR5)', () => {
  it("each user lists and deletes only their own saves", async () => {
    await save('token-a', makeCalc())
    await save('token-b', makeCalc())
    const idA = rows.find((r) => r.user_id === USER_A.id).id
    const idB = rows.find((r) => r.user_id === USER_B.id).id

    const listA = (await call('token-a', 'GET', '/api/calculations')).data.calculations
    expect(listA.map((c) => c.id)).toEqual([idA])

    // A cannot delete B's row, and gets the same answer as for a missing row.
    const cross = await call('token-a', 'DELETE', `/api/calculations/${idB}`)
    expect(cross.status).toBe(404)
    expect(rows.some((r) => r.id === idB)).toBe(true)

    expect((await call('token-a', 'DELETE', `/api/calculations/${idA}`)).status).toBe(200)
    expect(rows.some((r) => r.id === idA)).toBe(false)
    expect((await call('token-a', 'DELETE', `/api/calculations/${idA}`)).status).toBe(404)
    expect((await call('token-a', 'DELETE', '/api/calculations/not-a-uuid')).status).toBe(400)
  })

  it('a guest cannot delete anything', async () => {
    await save('token-a', makeCalc())
    expect((await call(null, 'DELETE', `/api/calculations/${rows[0].id}`)).status).toBe(401)
    expect(rows).toHaveLength(1)
  })
})
