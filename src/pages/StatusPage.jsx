import { usePrices } from '../hooks/usePrices.js'

// Appendix A.12: last successful retrieval, the last attempt and its
// outcome, which source was used, and the required credit link.
export default function StatusPage() {
  const { prices, error, loading } = usePrices()

  return (
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
  )
}
