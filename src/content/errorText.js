// Plain-language text for each engine/validation error code, kept
// separate from the engine and the form logic.
const errorText = {
  notANumber: 'must be a number.',
  negative: 'must be 0 or more.',
  missingPrice: 'is missing. Enter today\'s price to continue.',
}

export function getErrorMessage(field, code) {
  return `${field} ${errorText[code] ?? 'is invalid.'}`
}
