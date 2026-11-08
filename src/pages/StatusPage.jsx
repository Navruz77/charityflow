import { useEffect, useState } from 'react'
import { usePrices } from '../hooks/usePrices.js'
import { useSession } from '../hooks/useSession.jsx'
import { api } from '../lib/api.js'

// Admins also see how many users and saved calculations exist (NFR9).
// Counts only; no user's data is shown here.
function AdminCounts() {
  const [stats, setStats] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    api('GET', '/api/admin/stats').then((res) => {
      if (res.ok) setStats(res.data)
      else setFailed(true)
    })
  }, [])
  return (
    <div className="card">
      <h2>Usage (admins only)</h2>
      {failed && <p className="field-error">Could not load the counts.</p>}
      {!failed && !stats && <p className="muted">Loading…</p>}
      {stats && (
        <>
          <div className="reason-line">
            <span>Users</span>
            <span>{stats.users}</span>
          </div>
          <div className="reason-line">
            <span>Saved calculations</span>
            <span>{stats.calculations}</span>
          </div>
        </>
      )}
    </div>
  )
}

// Appendix A.12: last successful retrieval, the last attempt and its
// outcome, which source was used, and the required credit link.
export default function StatusPage() {
  const { prices, error, loading } = usePrices()
  const session = useSession()

  return (
    <>
      <div className="card">
        <h2>Price status</h2>
        {loading && <p className="muted">Checking…</p>}
        {!loading && !prices && <p className="field-error">{error ?? 'No price has ever been retrieved.'}</p>}
        {!loading && prices && (
          <>
            <div className="reason-line">
              <span>Last successful retrieval</span>
              <span>{new Date(prices.fetchedAt).toLocaleString()}</span>
            </div>
            <div className="reason-line">
              <span>Last attempt</span>
              <span>{prices.lastAttemptAt ? new Date(prices.lastAttemptAt).toLocaleString() : 'unknown'}</span>
            </div>
            <div className="reason-line">
              <span>Last attempt result</span>
              <span>{prices.lastAttemptOk ? 'Succeeded' : `Failed${prices.lastAttemptNote ? ` — ${prices.lastAttemptNote}` : ''}`}</span>
            </div>
            <div className="reason-line">
              <span>Source</span>
              <span>{prices.source ?? 'unknown'}</span>
            </div>
          </>
        )}
        <p className="muted" style={{ marginTop: 'var(--space-4)' }}>
          <a href="https://metalcharts.org" target="_blank" rel="noreferrer">
            Prices via metalcharts.org
          </a>
        </p>
      </div>
      {session.isAdmin && <AdminCounts />}
    </>
  )
}
