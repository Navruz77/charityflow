import { beforeEach, describe, expect, it, vi } from 'vitest'
import { calculateZakat } from '../engine/calculateZakat.js'
import { buildEngineInputs, initialFormState } from '../hooks/useZakatForm.js'
import {
  addGuestSave,
  buildSavedCalculation,
  loadGuestSaves,
  MAX_GUEST_SAVES,
  removeGuestSaves,
  SAVED_KEY,
  transferGuestSaves,
} from './savedCalculations.js'

function fakeStorage() {
  const store = new Map()
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    keys: () => [...store.keys()],
  }
}

const PRICES = { goldUsdPerGram: 134.34, silverUsdPerGram: 1.96, fetchedAt: '2026-11-01T06:00:12Z', source: 'metalcharts' }

// Builds a saved calculation the same way the result screen does.
function makeSaved(cash = '3000') {
  const form = { ...initialFormState(), cashCents: cash, nisab: 'silver', heldOneLunarYear: true, zakatDate: '2026-11-08' }
  const { inputs } = buildEngineInputs(form)
  const result = { ...calculateZakat(inputs, PRICES), errors: [], ok: true }
  return buildSavedCalculation({ inputs, result, pricesUsed: PRICES })
}

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.stubGlobal('window', { localStorage: fakeStorage(), sessionStorage: fakeStorage() })
})

describe('saved calculation record (B.3)', () => {
  it('holds exactly the B.3 fields and nothing else', () => {
    const c = makeSaved()
    expect(Object.keys(c).sort()).toEqual(['id', 'inputs', 'nisabChoice', 'pricesUsed', 'result', 'savedAt', 'zakatDate'])
    expect(Object.keys(c.pricesUsed).sort()).toEqual(['fetchedAt', 'goldUsdPerGram', 'silverUsdPerGram'])
    expect(c.zakatDate.gregorian).toBe('2026-11-08')
    expect(c.nisabChoice).toBe('silver')
    expect(c.result).not.toHaveProperty('errors')
    expect(c.result).not.toHaveProperty('ok')
  })
})

describe('save on this device (S4.1)', () => {
  it('saves newest first under cf.v1.saved and reads them back', () => {
    const first = makeSaved('100')
    const second = makeSaved('200')
    expect(addGuestSave(first).ok).toBe(true)
    expect(addGuestSave(second).ok).toBe(true)
    expect(loadGuestSaves().map((c) => c.id)).toEqual([second.id, first.id])
    expect(window.localStorage.keys()).toEqual([SAVED_KEY])
  })

  it('skips a damaged entry but keeps the others', () => {
    const good = makeSaved()
    window.localStorage.setItem(SAVED_KEY, JSON.stringify({ version: 1, data: [{ id: 'bad' }, good, 'junk'] }))
    expect(loadGuestSaves().map((c) => c.id)).toEqual([good.id])
  })

  it('returns an empty list for damaged storage', () => {
    window.localStorage.setItem(SAVED_KEY, '{not json')
    expect(loadGuestSaves()).toEqual([])
  })

  it('refuses more than the limit', () => {
    for (let i = 0; i < MAX_GUEST_SAVES; i++) addGuestSave(makeSaved())
    expect(addGuestSave(makeSaved())).toEqual({ ok: false, reason: 'full' })
  })

  it('reports a storage failure instead of throwing', () => {
    window.localStorage.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    expect(addGuestSave(makeSaved())).toEqual({ ok: false, reason: 'storage' })
  })

  it('removes by id', () => {
    const a = makeSaved()
    const b = makeSaved()
    addGuestSave(a)
    addGuestSave(b)
    removeGuestSaves([a.id])
    expect(loadGuestSaves().map((c) => c.id)).toEqual([b.id])
  })
})

describe('transfer guest saves (S3.5)', () => {
  it('sends oldest first in batches and removes each accepted batch from the device', async () => {
    const saves = Array.from({ length: 12 }, (_, i) => makeSaved(String(100 + i)))
    for (const s of saves) addGuestSave(s)
    const bodies = []
    vi.stubGlobal('fetch', async (url, opts) => {
      bodies.push(JSON.parse(opts.body))
      return { ok: true, status: 201, json: async () => ({}) }
    })
    const res = await transferGuestSaves()
    expect(res).toEqual({ added: 12, remaining: 0 })
    expect(bodies.map((b) => b.calculations.length)).toEqual([10, 2])
    expect(bodies[0].calculations[0].savedAt).toBe(saves[0].savedAt)
    expect(bodies[0].calculations[0].inputs.cashCents).toBe(10000)
    // Only the server's fields are sent: no local id.
    expect(bodies[0].calculations[0]).not.toHaveProperty('id')
    expect(loadGuestSaves()).toEqual([])
  })

  it('keeps what was not sent when the connection drops', async () => {
    for (let i = 0; i < 12; i++) addGuestSave(makeSaved())
    let calls = 0
    vi.stubGlobal('fetch', async () => {
      calls += 1
      if (calls === 2) throw new TypeError('Failed to fetch')
      return { ok: true, status: 201, json: async () => ({}) }
    })
    const res = await transferGuestSaves()
    expect(res).toMatchObject({ added: 10, remaining: 2, offline: true })
    expect(loadGuestSaves()).toHaveLength(2)
  })
})
