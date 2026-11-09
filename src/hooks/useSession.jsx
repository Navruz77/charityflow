import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api.js'

// Who is signed in, shared by every page. Asks GET /api/auth/session once
// on load; pages call refresh() after signing in or out. Only the email and
// an admin flag reach the browser, never a token.
const SessionContext = createContext({ loading: true, signedIn: false, refresh: async () => {} })

export function SessionProvider({ children }) {
  const [session, setSession] = useState({ loading: true, signedIn: false })

  const refresh = useCallback(async () => {
    const res = await api('GET', '/api/auth/session')
    if (res.ok) {
      setSession({ loading: false, signedIn: !!res.data.signedIn, email: res.data.email, isAdmin: !!res.data.isAdmin })
    } else {
      // Server unreachable: behave as a guest. The calculator still works.
      setSession({ loading: false, signedIn: false, unreachable: res.status === 0 })
    }
  }, [])

  useEffect(() => {
    refresh()
    // Opened offline, then reconnected: find out who is signed in (S5.2).
    window.addEventListener('online', refresh)
    return () => window.removeEventListener('online', refresh)
  }, [refresh])

  return <SessionContext.Provider value={{ ...session, refresh }}>{children}</SessionContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useSession() {
  return useContext(SessionContext)
}
