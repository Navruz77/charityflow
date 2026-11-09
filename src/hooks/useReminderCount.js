import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

// How many in-app reminders are unread, for the header link (A.23).
// Asks again when the Reminders page marks some read, and on reconnect.
const CHANGED = 'cf:reminders-changed'

export function notifyRemindersChanged() {
  window.dispatchEvent(new Event(CHANGED))
}

export function useReminderCount(signedIn) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!signedIn) return undefined
    let cancelled = false
    const load = async () => {
      const res = await api('GET', '/api/reminders')
      if (!cancelled && res.ok) setCount(Number(res.data.unread) || 0)
    }
    load()
    window.addEventListener(CHANGED, load)
    window.addEventListener('online', load)
    return () => {
      cancelled = true
      window.removeEventListener(CHANGED, load)
      window.removeEventListener('online', load)
    }
  }, [signedIn])

  return signedIn ? count : 0
}
