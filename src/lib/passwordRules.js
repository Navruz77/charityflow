// Password rules, shared by the server (which enforces them) and the
// sign-up / new-password screens (which show them as you type), so both
// always agree. Pure functions: no network, no storage.
//
// Following NIST SP 800-63B: length and "not a known-bad password" matter;
// forced symbol/uppercase rules do not (they push people to "Password1!").
// The server ALSO checks the password against known data breaches
// (server/auth/breachCheck.js); that part can't run in the browser.

export const PASSWORD_MIN = 8 // S3.2
export const PASSWORD_MAX_BYTES = 72 // Supabase's hashing ignores anything longer

// Whole passwords that are far too common.
const COMMON = new Set([
  '12345678', '123456789', '1234567890', '0123456789', '87654321', '11111111', '00000000',
  '12341234', '11223344', '1q2w3e4r', '1q2w3e4r5t', '1qaz2wsx', 'zaq12wsx', 'qwer1234',
  'asdf1234', 'abcd1234', 'abc12345', 'aa123456', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm1',
  'passw0rd', 'p@ssw0rd', 'p@ssword', 'pa$$word', 'trustno1', 'letmein1', 'iloveyou1',
])

// Words that stay weak even with numbers or symbols stuck on the end
// ("Password2024!", "Bismillah786").
const WEAK_WORDS = new Set([
  'password', 'qwerty', 'letmein', 'welcome', 'iloveyou', 'admin', 'administrator', 'login',
  'sunshine', 'princess', 'football', 'baseball', 'basketball', 'soccer', 'superman', 'batman',
  'starwars', 'whatever', 'dragon', 'monkey', 'master', 'shadow', 'freedom', 'secret',
  'computer', 'internet', 'changeme', 'default', 'charityflow', 'charity', 'zakat', 'sadaqah',
  'bismillah', 'alhamdulillah', 'subhanallah', 'mashallah', 'inshallah', 'allahuakbar',
  'muhammad', 'mohammed', 'islam', 'muslim', 'ramadan', 'makkah', 'madinah',
])

const SEQUENCES = ['abcdefghijklmnopqrstuvwxyz', '01234567890', 'qwertyuiopasdfghjklzxcvbnm']

function byteLength(text) {
  return new TextEncoder().encode(text).length
}

// True for things like "abcdefgh", "87654321", "qwertyui".
function isSequence(lower) {
  return SEQUENCES.some((seq) => seq.includes(lower) || [...seq].reverse().join('').includes(lower))
}

// Returns a list of problem codes; an empty list means the password passes.
export function passwordProblems(password, email = '') {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) return ['tooShort']
  if (byteLength(password) > PASSWORD_MAX_BYTES) return ['tooLong']

  const problems = []
  const lower = password.toLowerCase()
  const stripped = lower.replace(/[^a-z]+$/, '').replace(/^[^a-z]+/, '') // drop leading/trailing digits+symbols

  const name = String(email).toLowerCase().split('@')[0].replace(/[^a-z0-9]/g, '')
  if (name.length >= 3 && lower.replace(/[^a-z0-9]/g, '').includes(name)) problems.push('containsEmail')

  // One character or a short chunk repeated: "aaaaaaaa", "abcabcabc".
  if (/^(.{1,3})\1+$/.test(lower)) problems.push('repeated')
  else if (isSequence(lower)) problems.push('sequence')

  if (COMMON.has(lower) || WEAK_WORDS.has(lower) || WEAK_WORDS.has(stripped)) problems.push('common')

  return problems
}

// Plain-language text for each problem code.
export const passwordProblemText = {
  tooShort: `Use at least ${PASSWORD_MIN} characters.`,
  tooLong: 'That password is too long. Use a shorter one.',
  containsEmail: "Don't use your email name in your password.",
  repeated: "Don't use a repeated character or pattern.",
  sequence: "Don't use a simple sequence like 12345678 or abcdefgh.",
  common: 'That password is too common. Try a few unrelated words together.',
  breached:
    'This password has appeared in a known data breach, so attackers try it first. Please choose a different one.',
}

// 0 to 4, for the strength meter only. The rules above decide what is allowed.
export function passwordStrength(password, email = '') {
  if (!password) return 0
  if (passwordProblems(password, email).length > 0) return 0
  let score = 1
  if (password.length >= 12) score += 1
  if (password.length >= 16) score += 1
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length
  if (kinds >= 3) score += 1
  return Math.min(score, 4)
}

export const strengthLabels = ['Too weak', 'Fair', 'Good', 'Strong', 'Very strong']
