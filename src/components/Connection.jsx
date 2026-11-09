import { useOnline } from '../hooks/useOnline.js'
import { loadGuestData, saveGuestData } from '../lib/storage.js'
import { useState } from 'react'

// A.13: shown on every screen while the browser is offline (S5.2).
export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div className="offline-banner" role="status">
      <strong>You are offline.</strong> The calculator, explanations and saving on this device still
      work. Account features need a connection.
    </div>
  )
}

// A.21: what an account feature shows when it can't reach the server.
// `children` can add a line, e.g. "Your calculation is still on screen."
export function NeedsConnection({ what = 'This', onRetry, children }) {
  return (
    <div className="card form-stack" role="status">
      <h2>Needs a connection</h2>
      <p>{what} needs an internet connection, and CharityFlow can't be reached right now.</p>
      {children}
      <p className="muted">Nothing you entered has been lost. Try again when you are back online.</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

// First-visit note (M5, unknown 2): how to make the app work offline,
// including Safari's 7-day storage limit on iPhone. Dismissing it is the
// only thing remembered (B.3 `cf.v1.firstVisitNoteDismissed`).
const NOTE_KEY = 'cf.v1.firstVisitNoteDismissed'
const isTrue = (v) => v === true

export function FirstVisitNote() {
  const [dismissed, setDismissed] = useState(() => loadGuestData(NOTE_KEY, isTrue) === true)
  if (dismissed) return null
  const dismiss = () => {
    saveGuestData(NOTE_KEY, true, isTrue)
    setDismissed(true)
  }
  return (
    <aside className="first-visit card" aria-label="Using CharityFlow offline">
      <p>
        <strong>Works without internet.</strong> Open CharityFlow once while online and it will keep
        working offline on this device.
      </p>
      <p className="muted">
        On iPhone, tap Share, then “Add to Home Screen”, so Safari keeps it available (Safari clears
        sites you haven't opened for 7 days).
      </p>
      <button type="button" className="btn btn-secondary" onClick={dismiss}>
        Got it
      </button>
    </aside>
  )
}
