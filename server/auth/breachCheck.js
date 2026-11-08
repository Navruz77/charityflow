// Checks a password against Have I Been Pwned's list of passwords leaked in
// real data breaches (free, no key needed). Uses "k-anonymity": we send only
// the first 5 characters of the password's SHA-1 fingerprint and compare the
// rest ourselves, so neither the password nor its full fingerprint ever
// leaves our server. "Add-Padding" hides even how many matches came back.
import { createHash } from 'node:crypto'

const TIMEOUT_MS = 3000

// Returns true (breached), false (not found), or null (could not check).
// On null the caller allows the password: the other rules still apply, and a
// slow outside service should not stop people from signing up.
export async function isBreached(password) {
  const hash = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase()
  const prefix = hash.slice(0, 5)
  const suffix = hash.slice(5)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'CharityFlow-server' },
      signal: controller.signal,
    })
    if (!res.ok) return null
    const body = await res.text()
    for (const line of body.split('\n')) {
      const [lineSuffix, count] = line.trim().split(':')
      // Padding lines have a count of 0 and are not real matches.
      if (lineSuffix === suffix) return Number(count) > 0
    }
    return false
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export const breachChecker = { isBreached }
