// CharityFlow Zakat engine (Hanafi). Pure function: no network, no screens.
// Money is integer cents. Prices are USD per gram (up to 4 decimals).

export const GOLD_NISAB_GRAMS = 87.48
export const SILVER_NISAB_GRAMS = 612.36
export const ZAKAT_RATE_DIVISOR = 40 // 2.5% = 1/40
export const DEFAULT_SECURITIES_SHARE_PCT = 30
export const DEFAULT_RETIREMENT_SHARE_PCT = 100
export const DEFAULT_BUSINESS_OWNERSHIP_PCT = 100

// Every kind of debt the engine subtracts, in screen order.
// `installments12mCents` is kept only for older saved calculations.
export const DEBT_FIELDS = [
  'dueNowCents',
  'creditCardCents',
  'mortgageNextPrincipalCents',
  'personalLoansCents',
  'owedToFamilyCents',
  'unpaidTaxesBillsCents',
  'otherLiabilitiesCents',
  'installments12mCents',
]

const pct = (cents, p) => Math.round((cents * p) / 100)

// Reads a money/number field. Blank = 0. Non-numeric text names the field
// with code 'notANumber'; a negative number names it with code 'negative'.
// Either way it counts as 0 so other entries still work.
function makeReader(errors) {
  return (path, v) => {
    if (v === undefined || v === null || v === '') return 0
    const n = typeof v === 'string' ? Number(v.trim()) : v
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      errors.push({ field: path, code: 'notANumber' })
      return 0
    }
    if (n < 0) {
      errors.push({ field: path, code: 'negative' })
      return 0
    }
    return n
  }
}

// Same validation as makeReader, but returns null for blank/missing instead
// of 0 — lets a caller tell "not entered" apart from "entered as zero",
// which matters for gold/silver (blank value means "price the grams instead").
function makeOptionalReader(errors) {
  return (path, v) => {
    if (v === undefined || v === null || v === '') return null
    const n = typeof v === 'string' ? Number(v.trim()) : v
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      errors.push({ field: path, code: 'notANumber' })
      return null
    }
    if (n < 0) {
      errors.push({ field: path, code: 'negative' })
      return null
    }
    return n
  }
}

export function calculateZakat(inputs = {}, prices = {}) {
  const errors = []
  const read = makeReader(errors)
  const readOptional = makeOptionalReader(errors)
  const cents = (path, v) => Math.round(read(path, v))
  const lines = []
  const add = (category, valueCents, treatment, reasonKey) =>
    lines.push({ category, valueCents, treatment, reasonKey })

  const goldPrice = Number(prices.goldUsdPerGram)
  const silverPrice = Number(prices.silverUsdPerGram)
  if (!(goldPrice > 0)) errors.push({ field: 'prices.goldUsdPerGram', code: 'missingPrice' })
  if (!(silverPrice > 0)) errors.push({ field: 'prices.silverUsdPerGram', code: 'missingPrice' })

  // Prices in ten-thousandths of a dollar so 4 decimals stay exact.
  const toTT = (p) => Math.round(p * 10000)

  // Cash and savings: counted in full.
  add('cash', cents('cashCents', inputs.cashCents), 'full', 'cash.full')
  add('savings', cents('savingsCents', inputs.savingsCents), 'full', 'savings.full')

  // Gold and silver: enter a value directly, or grams for the engine to price.
  for (const metal of ['gold', 'silver']) {
    const m = inputs[metal] || {}
    const grams = read(`${metal}.grams`, m.grams)
    const enteredValueCents = readOptional(`${metal}.valueCents`, m.valueCents)
    const price = metal === 'gold' ? goldPrice : silverPrice
    const valueCents =
      enteredValueCents !== null
        ? Math.round(enteredValueCents)
        : price > 0
          ? Math.round((grams * toTT(price)) / 100)
          : 0
    add(metal, valueCents, 'full', `${metal}.full`)
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
    const share =
      s.zakatableSharePct === undefined || s.zakatableSharePct === null || s.zakatableSharePct === ''
        ? DEFAULT_SECURITIES_SHARE_PCT
        : read(`securities[${i}].zakatableSharePct`, s.zakatableSharePct)
    add('securities', pct(v, Math.min(share, 100)), 'reduced', 'securities.longTerm')
  })

  // Crypto: counted if trading/resale; long-term holdings are not counted.
  ;(inputs.crypto || []).forEach((c, i) => {
    const v = cents(`crypto[${i}].valueCents`, c.valueCents)
    if (c.purpose === 'longTerm') add('crypto', v, 'excluded', 'crypto.longTerm')
    else add('crypto', v, 'full', 'crypto.trade')
  })

  // Real estate for sale: a list of properties currently listed for sale.
  ;(inputs.realEstateForSale || []).forEach((p, i) => {
    add('realEstateForSale', cents(`realEstateForSale[${i}].valueCents`, p.valueCents), 'full', 'realEstate.forSale')
  })

  // Rentals: rent collected and unspent, less expenses paid, never below 0.
  ;(inputs.rentals || []).forEach((r, i) => {
    const rent = cents(`rentals[${i}].rentCollectedUnspentCents`, r.rentCollectedUnspentCents)
    const exp = cents(`rentals[${i}].expensesPaidCents`, r.expensesPaidCents)
    add('rentals', Math.max(0, rent - exp), 'full', 'rentals.net')
  })

  // Businesses: ownership share of (cash + inventory + receivables - liabilities).
  ;(inputs.businesses || []).forEach((b, i) => {
    const p = `businesses[${i}]`
    const own =
      b.ownershipPct === undefined || b.ownershipPct === null || b.ownershipPct === ''
        ? DEFAULT_BUSINESS_OWNERSHIP_PCT
        : Math.min(read(`${p}.ownershipPct`, b.ownershipPct), 100)
    const net =
      cents(`${p}.cashCents`, b.cashCents) +
      cents(`${p}.inventoryCents`, b.inventoryCents) +
      cents(`${p}.receivablesCents`, b.receivablesCents) -
      cents(`${p}.liabilitiesCents`, b.liabilitiesCents)
    add('businesses', pct(Math.max(0, net), own), 'reduced', 'business.share')
  })

  // Retirement: "annual" counts the vested balance (zakatable share, less
  // penalty/tax); "whenAccessible" defers Zakat until the money is accessible.
  ;(inputs.retirement || []).forEach((r, i) => {
    const p = `retirement[${i}]`
    const v = cents(`${p}.vestedBalanceCents`, r.vestedBalanceCents)
    if (r.method === 'whenAccessible') return add('retirement', v, 'excluded', 'retirement.whenAccessible')
    const share =
      r.zakatableSharePct === undefined || r.zakatableSharePct === null || r.zakatableSharePct === ''
        ? DEFAULT_RETIREMENT_SHARE_PCT
        : read(`${p}.zakatableSharePct`, r.zakatableSharePct)
    const penalty = cents(`${p}.penaltyTaxCents`, r.penaltyTaxCents)
    add('retirement', Math.max(0, pct(v, Math.min(share, 100)) - penalty), 'reduced', 'retirement.annual')
  })

  const totalZakatableCents = lines
    .filter((l) => l.treatment !== 'excluded')
    .reduce((sum, l) => sum + l.valueCents, 0)

  // Debts: every amount entered is subtracted in full. `installments12mCents`
  // is no longer on the screens but is still read, so calculations saved
  // before it was removed give the same answer.
  const debts = inputs.debts || {}
  const debtsSubtracted = {}
  for (const key of DEBT_FIELDS) {
    debtsSubtracted[key] = cents(`debts.${key}`, debts[key])
  }
  const totalDebtsCents = Object.values(debtsSubtracted).reduce((sum, c) => sum + c, 0)
  const netCents = Math.max(0, totalZakatableCents - totalDebtsCents)

  // Zakat left unpaid from previous years is still owed. It is added on top
  // of this year's amount (one entry per year), whatever this year's status.
  const unpaidPriorZakatCents = (inputs.unpaidZakat || []).reduce(
    (sum, y, i) => sum + cents(`unpaidZakat[${i}].amountCents`, y.amountCents),
    0,
  )

  // Nisab and hawl must be explicitly chosen. Missing either gives no
  // result instead of silently defaulting.
  const nisabChoice = inputs.nisab === 'gold' || inputs.nisab === 'silver' ? inputs.nisab : null
  const hawlKnown = typeof inputs.heldOneLunarYear === 'boolean'

  let status
  let thisYearZakatCents = 0
  let nisabInfo = { choice: null, grams: null, pricePerGram: null, valueCents: null }

  if (!nisabChoice) {
    status = 'needsNisab'
  } else {
    const nisabGrams = nisabChoice === 'gold' ? GOLD_NISAB_GRAMS : SILVER_NISAB_GRAMS
    const pricePerGram = nisabChoice === 'gold' ? goldPrice : silverPrice
    const nisabValueCents = pricePerGram > 0 ? Math.round((nisabGrams * toTT(pricePerGram)) / 100) : 0
    nisabInfo = { choice: nisabChoice, grams: nisabGrams, pricePerGram, valueCents: nisabValueCents }

    if (netCents < nisabValueCents) {
      status = 'belowNisab' // exactly at nisab is due
    } else if (!hawlKnown) {
      status = 'needsHawl'
    } else if (!inputs.heldOneLunarYear) {
      status = 'notYetDue'
    } else {
      status = 'due'
      thisYearZakatCents = Math.round(netCents / ZAKAT_RATE_DIVISOR)
    }
  }

  // Past years' unpaid Zakat is due even when nothing is due this year.
  // It only shows once nisab and the one-year question are answered.
  const answered = status === 'due' || status === 'belowNisab' || status === 'notYetDue'
  const unpaidCounted = answered ? unpaidPriorZakatCents : 0
  if (status !== 'due' && unpaidCounted > 0) status = 'unpaidPriorOnly'
  const zakatDueCents = thisYearZakatCents + unpaidCounted

  return {
    ok: errors.length === 0,
    errors,
    lines,
    totalZakatableCents,
    netCents,
    debtsSubtracted,
    nisab: nisabInfo,
    status,
    thisYearZakatCents,
    unpaidPriorZakatCents: unpaidCounted,
    zakatDueCents, // this year + unpaid from previous years
    zakatDate: inputs.zakatDate ?? null,
    pricesUsed: { goldUsdPerGram: goldPrice, silverUsdPerGram: silverPrice },
  }
}
