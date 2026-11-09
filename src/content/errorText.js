// Plain-language error text for the calculator, kept separate from the
// engine and the form logic. Messages never show internal field names.

// Which kind of value a field holds, from its engine path.
function kind(field) {
  if (field.endsWith('Pct')) return 'percent'
  if (field.endsWith('.grams')) return 'grams'
  if (field === 'zakatDate') return 'date'
  if (field.startsWith('prices.')) return 'price'
  return 'money'
}

const MESSAGES = {
  money: 'Enter an amount in dollars, like 1,250.00.',
  percent: 'Enter a percentage from 0 to 100.',
  grams: 'Enter grams as a number, like 51 or 12.5.',
  date: 'Enter a real date between 1900 and 2200.',
  price: "Today's gold and silver prices are missing. Please try again in a few minutes.",
}

export function getErrorMessage(field, code) {
  if (code === 'negative') return 'Enter 0 or more.'
  return MESSAGES[kind(field)]
}

// Field path -> the calculator step that holds it (index), and a readable
// name, for the list of problems on the review screen.
const LISTS = {
  gems: [2, 'Gem'],
  securities: [3, 'Holding'],
  crypto: [4, 'Crypto holding'],
  realEstateForSale: [5, 'Property'],
  rentals: [6, 'Rental'],
  businesses: [7, 'Business'],
  retirement: [8, 'Retirement account'],
}
const PARTS = {
  valueCents: 'value',
  zakatableSharePct: 'zakatable share',
  rentCollectedUnspentCents: 'rent collected',
  expensesPaidCents: 'expenses paid',
  ownershipPct: 'ownership %',
  cashCents: 'cash',
  inventoryCents: 'inventory',
  receivablesCents: 'receivables',
  liabilitiesCents: 'liabilities',
  vestedBalanceCents: 'vested balance',
  penaltyTaxCents: 'penalty or tax',
}
const SINGLE = {
  cashCents: [0, 'Cash'],
  savingsCents: [0, 'Savings'],
  'gold.grams': [1, 'Grams of gold'],
  'gold.valueCents': [1, 'Value of gold'],
  'silver.grams': [1, 'Grams of silver'],
  'silver.valueCents': [1, 'Value of silver'],
  'debts.dueNowCents': [9, 'Debts due now'],
  'debts.installments12mCents': [9, 'Installments in the next 12 months'],
  zakatDate: [10, 'Zakat date'],
}

// { step, label } for a field path; step is null for prices.
export function describeField(field) {
  if (SINGLE[field]) return { step: SINGLE[field][0], label: SINGLE[field][1] }
  const m = /^(\w+)\[(\d+)\]\.(\w+)$/.exec(field)
  if (m && LISTS[m[1]]) {
    return { step: LISTS[m[1]][0], label: `${LISTS[m[1]][1]} ${Number(m[2]) + 1}: ${PARTS[m[3]] ?? 'entry'}` }
  }
  if (field.startsWith('prices.')) return { step: null, label: 'Gold and silver prices' }
  return { step: null, label: 'An entry' }
}
