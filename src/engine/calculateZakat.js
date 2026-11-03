// CharityFlow Zakat engine (Hanafi). Pure function: no network, no screens.
// Money is integer cents. Prices are dollars per gram (up to 4 decimals).

export const GOLD_NISAB_GRAMS = 87.48
export const SILVER_NISAB_GRAMS = 612.36
export const ZAKAT_RATE_DIVISOR = 40 // 2.5% = 1/40
export const DEFAULT_SECURITIES_SHARE_PCT = 30
export const DEFAULT_RETIREMENT_SHARE_PCT = 100

const pct = (cents, p) => Math.round((cents * p) / 100)

// Reads a money/number field. Blank = 0. Negative or non-numeric adds an
// error naming the field and counts as 0 so other entries still work.
function makeReader(errors) {
  return (path, v, { allowZero = true } = {}) => {
    if (v === undefined || v === null || v === '') return 0
    const n = typeof v === 'string' ? Number(v.trim()) : v
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
      errors.push({ field: path, message: `${path} must be a number that is 0 or more` })
      return 0
    }
    return n
  }
}

export function calculateZakat(inputs = {}, prices = {}) {
  const errors = []
  const read = makeReader(errors)
  const cents = (path, v) => Math.round(read(path, v))
  const lines = []
  const add = (category, valueCents, treatment, reasonKey) =>
    lines.push({ category, valueCents, treatment, reasonKey })

  // Prices in ten-thousandths of a dollar so 4 decimals stay exact.
  const goldPrice = Number(prices.goldPerGram)
  const silverPrice = Number(prices.silverPerGram)
  if (!(goldPrice > 0) || !(silverPrice > 0)) {
    errors.push({ field: 'prices', message: 'Gold and silver prices are required' })
  }
  const toTT = (p) => Math.round(p * 10000)
  const nisabChoice = inputs.nisab === 'gold' ? 'gold' : 'silver'
  const nisabGrams = nisabChoice === 'gold' ? GOLD_NISAB_GRAMS : SILVER_NISAB_GRAMS
  const pricePerGram = nisabChoice === 'gold' ? goldPrice : silverPrice
  const nisabValueCents = pricePerGram > 0 ? Math.round((nisabGrams * toTT(pricePerGram)) / 100) : 0

  // Cash and savings: counted in full.
  const cash = cents('cashCents', inputs.cashCents)
  const savings = cents('savingsCents', inputs.savingsCents)
  add('cash', cash, 'full', 'cash.full')
  add('savings', savings, 'full', 'savings.full')

  // Gold and silver: counted at their market value.
  for (const metal of ['gold', 'silver']) {
    const m = inputs[metal] || {}
    read(`${metal}.grams`, m.grams)
    add(metal, cents(`${metal}.valueCents`, m.valueCents), 'full', `${metal}.full`)
  }

  // Gems: only counted if held for resale.
  ;(inputs.gems || []).forEach((g, i) => {
    const v = cents(`gems[${i}].valueCents`, g.valueCents)
    if (g.purpose === 'resale') add('gems', v, 'full', 'gems.resale')
    else add('gems', v, 'excluded', 'gems.personal')
  })

  // Securities: trading = full; long-term = zakatable share (default 30%).
  ;(inputs.securities || []).forEach((s, i) => {
    const v = cents(`securities[${i}].valueCents`, s.valueCents)
    if (s.purpose === 'trade') return add('securities', v, 'full', 'securities.trade')
    if (s.countInFull) return add('securities', v, 'full', 'securities.countInFull')
    const share = s.zakatableSharePct === undefined || s.zakatableSharePct === ''
      ? DEFAULT_SECURITIES_SHARE_PCT
      : read(`securities[${i}].zakatableSharePct`, s.zakatableSharePct)
    add('securities', pct(v, Math.min(share, 100)), 'partial', 'securities.longTerm')
  })

  // Crypto: counted if trading/resale; long-term holdings are not counted.
  ;(inputs.crypto || []).forEach((c, i) => {
    const v = cents(`crypto[${i}].valueCents`, c.valueCents)
    if (c.purpose === 'longTerm') add('crypto', v, 'excluded', 'crypto.longTerm')
    else add('crypto', v, 'full', 'crypto.trade')
  })

  add('realEstateForSale', cents('realEstateForSale', inputs.realEstateForSale), 'full', 'realEstate.forSale')

  // Rentals: rent collected and unspent, less expenses paid, never below 0.
  ;(inputs.rentals || []).forEach((r, i) => {
    const rent = cents(`rentals[${i}].rentCollectedUnspentCents`, r.rentCollectedUnspentCents)
    const exp = cents(`rentals[${i}].expensesPaidCents`, r.expensesPaidCents)
    add('rentals', Math.max(0, rent - exp), 'net', 'rentals.net')
  })

  // Businesses: ownership share of (cash + inventory + receivables - liabilities).
  ;(inputs.businesses || []).forEach((b, i) => {
    const p = `businesses[${i}]`
    const own = Math.min(read(`${p}.ownershipPct`, b.ownershipPct), 100)
    const net =
      cents(`${p}.cashCents`, b.cashCents) +
      cents(`${p}.inventoryCents`, b.inventoryCents) +
      cents(`${p}.receivablesCents`, b.receivablesCents) -
      cents(`${p}.liabilitiesCents`, b.liabilitiesCents)
    add('businesses', pct(Math.max(0, net), own), 'share', 'business.share')
  })

  // Retirement: "annual" counts the vested balance (zakatable share, less
  // penalty/tax); "whenAccessible" defers Zakat until the money is accessible.
  ;(inputs.retirement || []).forEach((r, i) => {
    const p = `retirement[${i}]`
    const v = cents(`${p}.vestedBalanceCents`, r.vestedBalanceCents)
    if (r.method === 'whenAccessible') return add('retirement', v, 'excluded', 'retirement.whenAccessible')
    const share = r.zakatableSharePct === undefined || r.zakatableSharePct === ''
      ? DEFAULT_RETIREMENT_SHARE_PCT
      : read(`${p}.zakatableSharePct`, r.zakatableSharePct)
    const penalty = cents(`${p}.penaltyTaxCents`, r.penaltyTaxCents)
    add('retirement', Math.max(0, pct(v, Math.min(share, 100)) - penalty), 'partial', 'retirement.annual')
  })

  const totalZakatableCents = lines
    .filter((l) => l.treatment !== 'excluded')
    .reduce((sum, l) => sum + l.valueCents, 0)

  const debts = inputs.debts || {}
  const debtsSubtracted =
    cents('debts.dueNowCents', debts.dueNowCents) +
    cents('debts.installments12mCents', debts.installments12mCents)

  const netCents = Math.max(0, totalZakatableCents - debtsSubtracted)

  let status
  if (netCents < nisabValueCents) status = 'belowNisab' // exactly at nisab is due
  else if (!inputs.heldOneLunarYear) status = 'notYetDue'
  else status = 'due'
  const zakatDueCents = status === 'due' ? Math.round(netCents / ZAKAT_RATE_DIVISOR) : 0

  return {
    ok: errors.length === 0,
    errors,
    lines,
    totalZakatableCents,
    netCents,
    debtsSubtracted,
    nisab: { choice: nisabChoice, grams: nisabGrams, pricePerGram, valueCents: nisabValueCents },
    status,
    zakatDueCents,
    zakatDate: inputs.zakatDate ?? null,
    pricesUsed: { goldPerGram: goldPrice, silverPerGram: silverPrice },
  }
}
