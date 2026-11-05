// Plain-language explanations for each engine reasonKey. Kept separate
// from the engine so wording can change without touching the math.
export const reasonText = {
  'cash.full': 'Cash on hand and in checking accounts is counted in full.',
  'savings.full': 'Savings account balances are counted in full.',
  'gold.full': 'Gold is counted at its current market value.',
  'silver.full': 'Silver is counted at its current market value.',
  'gems.resale': 'Gems held for resale are counted in full.',
  'gems.personal': 'Gems kept for personal use are not zakatable.',
  'securities.trade': 'Stocks and funds held for active trading are counted in full.',
  'securities.countInFull': 'This holding was counted in full, as you chose.',
  'securities.longTerm': 'Long-term holdings are counted at their zakatable share, not their full value.',
  'crypto.trade': 'Crypto held for trading is counted in full.',
  'crypto.longTerm': 'Crypto held long-term is not zakatable.',
  'realEstate.forSale': 'Real estate listed for sale is counted at its value.',
  'rentals.net': 'Rental income left over after expenses is counted.',
  'business.share': 'Your ownership share of the business\'s zakatable assets is counted.',
  'retirement.whenAccessible': 'This retirement balance is not accessible yet, so Zakat is deferred until it is.',
  'retirement.annual': 'The zakatable share of your vested retirement balance is counted, minus any early withdrawal penalty or tax.',
}

export function getReasonText(reasonKey) {
  return reasonText[reasonKey] ?? 'This amount was counted toward your Zakat.'
}
