import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { centsToDisplay } from '../lib/money.js'
import { toGregorianDisplay, toHijriDisplay } from '../lib/hijri.js'
import { isValidSavedCalculation, loadGuestSaves, removeGuestSaves } from '../lib/savedCalculations.js'
import { useSession } from '../hooks/useSession.jsx'
import { useOnline } from '../hooks/useOnline.js'
import { LinesCard, NumbersCard } from '../components/ResultBreakdown.jsx'
import { priceAge, statusCopy } from '../lib/resultText.js'
import { NeedsConnection } from '../components/Connection.jsx'
import { FormMessage } from '../components/AuthFields.jsx'
import TransferPrompt from '../components/TransferPrompt.jsx'

// A.11 Saved calculations. "Saved on this device" (S4.1) is read straight
// from localStorage and works offline. "Saved in my account" (S4.2) comes
// from our server and needs a connection (S5.2).
export default function SavedPage() {
  const session = useSession()
  const [deviceSaves, setDeviceSaves] = useState(loadGuestSaves)
  const [accountVersion, setAccountVersion] = useState(0)

  const reload = useCallback(() => {
    setDeviceSaves(loadGuestSaves())
    setAccountVersion((v) => v + 1)
  }, [])

  const deleteHere = (id) => {
    removeGuestSaves([id])
    setDeviceSaves(loadGuestSaves())
  }

  return (
    <>
      <h1>Saved calculations</h1>
      <TransferPrompt onDone={reload} />

      {session.signedIn && <AccountSaves key={accountVersion} />}

      <section aria-labelledby="device-title">
        <h2 id="device-title">Saved on this device</h2>
        <p className="muted">
          Kept only in this browser. Clearing the browser's data removes them, and they are never
          sent anywhere unless you add them to an account.
        </p>
        {deviceSaves.length === 0 ? (
          <p className="card">Nothing saved on this device.</p>
        ) : (
          deviceSaves.map((c) => <SavedItem key={c.id} calc={c} onDelete={() => deleteHere(c.id)} />)
        )}
      </section>

      {!session.loading && !session.signedIn && (
        <p className="muted">
          <a href="#/register">Create a free account</a> to keep calculations on every device.
        </p>
      )}
    </>
  )
}

function AccountSaves() {
  const online = useOnline()
  const [state, setState] = useState({ loading: true })

  // Fetches the list; state changes only after the answer arrives.
  const fetchList = useCallback(async () => {
    const res = await api('GET', '/api/calculations')
    // Skip any row that doesn't have the full saved shape, rather than break the page.
    if (res.ok) setState({ list: (res.data.calculations ?? []).filter(isValidSavedCalculation) })
    else setState({ offline: res.status === 0, error: res.data?.message || 'Could not load your saved calculations.' })
  }, [])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const retry = () => {
    setState({ loading: true })
    fetchList()
  }

  async function deleteOne(id) {
    const res = await api('DELETE', `/api/calculations/${encodeURIComponent(id)}`)
    if (res.ok || res.status === 404) {
      setState((s) => ({ list: (s.list ?? []).filter((c) => c.id !== id) }))
      return null
    }
    return res.status === 0 ? 'Deleting needs a connection.' : res.data?.message || 'Could not delete. Please try again.'
  }

  let body
  if (state.loading) body = <p className="muted">Loading…</p>
  else if (state.offline || (!online && !state.list)) body = <NeedsConnection what="Your account's saved list" onRetry={retry} />
  else if (state.error) body = <FormMessage kind="error">{state.error}</FormMessage>
  else if (state.list.length === 0) body = <p className="card">Nothing saved in your account yet.</p>
  else body = state.list.map((c) => <SavedItem key={c.id} calc={c} onDelete={() => deleteOne(c.id)} />)

  return (
    <section aria-labelledby="account-title">
      <h2 id="account-title">Saved in my account</h2>
      {body}
    </section>
  )
}

// One saved calculation: the headline, then the full breakdown on request.
// `onDelete` may return an error message (or a promise of one).
function SavedItem({ calc, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const { result, pricesUsed } = calc
  const status = statusCopy(result.status)
  const gregorian = calc.zakatDate?.gregorian
  const hijri = calc.zakatDate?.hijri ?? (gregorian ? toHijriDisplay(gregorian) : null)
  const age = priceAge(pricesUsed.fetchedAt)
  const titleId = `saved-${calc.id}`

  async function reallyDelete() {
    setBusy(true)
    const message = await onDelete()
    setBusy(false)
    if (message) setError(message)
  }

  return (
    <article className="card saved-item" aria-labelledby={titleId}>
      <h3 id={titleId}>
        {status.title}: {centsToDisplay(result.zakatDueCents)}
      </h3>
      <div className="reason-line">
        <span>Saved</span>
        <span>{new Date(calc.savedAt).toLocaleString()}</span>
      </div>
      <div className="reason-line">
        <span>Zakat date</span>
        <span>{gregorian ? `${toGregorianDisplay(gregorian)}${hijri ? ` (${hijri})` : ''}` : 'Not set'}</span>
      </div>
      <div className="reason-line">
        <span>Nisab</span>
        <span>
          {calc.nisabChoice === 'gold' ? 'Gold' : 'Silver'}, {centsToDisplay(result.nisab?.valueCents)}
        </span>
      </div>
      <div className="reason-line">
        <span>Prices used</span>
        <span>
          {new Date(pricesUsed.fetchedAt).toLocaleString()}
          {age ? ` (${age} now)` : ''}
        </span>
      </div>

      <details className="saved-details">
        <summary>Show the full breakdown</summary>
        <NumbersCard result={result} headingLevel={4} />
        <LinesCard result={result} headingLevel={4} />
      </details>

      <FormMessage kind="error">{error}</FormMessage>
      {confirming ? (
        <div className="btn-row">
          <button type="button" className="btn btn-danger" onClick={reallyDelete} disabled={busy}>
            {busy ? 'Deleting…' : 'Yes, delete it'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)} disabled={busy}>
            Keep it
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-secondary" onClick={() => setConfirming(true)}>
          Delete
        </button>
      )}
    </article>
  )
}
