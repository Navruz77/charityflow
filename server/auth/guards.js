// Helpers the account routes share: answering "too many tries", and the
// full password check (rules + known-breach lookup).
import { passwordProblems, passwordProblemText } from '../../src/lib/passwordRules.js'

// Sends 429 with a Retry-After header and a wait time people can read.
export function tooMany(res, retryAfterSec = 60) {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60))
  res.setHeader('Retry-After', String(retryAfterSec))
  return res.status(429).json({
    error: 'rate_limited',
    message: `Too many attempts. Please wait ${minutes} minute${minutes === 1 ? '' : 's'} and try again.`,
  })
}

// Counts one try against each limit; returns the first refusal or null.
export function firstRefusal(checks) {
  for (const [limiter, key] of checks) {
    const result = limiter.hit(key)
    if (!result.allowed) return result
  }
  return null
}

// Returns a message explaining why the password is not allowed, or null.
export async function passwordRefusal(password, email, breach) {
  const problems = passwordProblems(password, email)
  if (problems.length > 0) return passwordProblemText[problems[0]]
  const breached = await breach.isBreached(password)
  if (breached === null) console.error('breach check unavailable; password allowed on the other rules')
  if (breached) return passwordProblemText.breached
  return null
}
