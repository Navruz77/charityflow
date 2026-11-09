import { useState } from 'react'
import { useSession } from '../hooks/useSession.jsx'
import { useOnline } from '../hooks/useOnline.js'
import { addGuestSave, buildSavedCalculation, MAX_GUEST_SAVES, saveToAccount } from '../lib/savedCalculations.js'
import { FormMessage, WakeNote } from './AuthFields.jsx'

const NEEDS_CONNECTION =
  'Saving to your account needs a connection. Your calculation stays on this screen; tap Save again when you are back online.'

// The save buttons under a result.
// Guests: "Save on this device" (S4.1). Signed in: "Save to my account" (S4.2).
// Saving never clears the result, so nothing is lost if it fails.
export default function SaveCalculation({ inputs, result, pricesUsed }) {
  const session = useSession()
  const online = useOnline()
  const [busy, setBusy] = useState(false)
  const [savedTo, setSavedTo] = useState(null) // 'device' | 'account'
  const [error, setError] = useState(null)

  const record = () => buildSavedCalculation({ inputs, result, pricesUsed })

  function saveHere() {
    setError(null)
    const res = addGuestSave(record())
    if (res.ok) return setSavedTo('device')
    setError(
      res.reason === 'full'
        ? `This device already holds ${MAX_GUEST_SAVES} saved calculations. Delete some on the Saved page first.`
        : 'This browser would not let CharityFlow save here (private browsing or storage full).',
    )
  }

  async function saveToMyAccount() {
    setError(null)
    if (!online) return setError(NEEDS_CONNECTION)
    setBusy(true)
    const res = await saveToAccount(record())
    setBusy(false)
    if (res.ok) return setSavedTo('account')
    if (res.offline) return setError(NEEDS_CONNECTION)
    if (res.status === 401) {
      await session.refresh() // the sign-in ended; show the guest option instead
      return setError('Your sign-in has ended. Sign in again to save to your account, or save on this device.')
    }
    setError(res.message || 'Could not save. Please try again.')
  }

  if (savedTo) {
    return (
      <div className="card form-stack">
        <FormMessage>
          {savedTo === 'account' ? 'Saved to your account.' : 'Saved on this device only. It is not sent anywhere.'}
        </FormMessage>
        <a className="btn btn-secondary" href="#/saved">
          See saved calculations
        </a>
      </div>
    )
  }

  if (session.loading) return null

  if (session.signedIn) {
    return (
      <div className="card form-stack">
        <h3>Keep this calculation</h3>
        <FormMessage kind="error">{error}</FormMessage>
        <button type="button" className="btn btn-primary" onClick={saveToMyAccount} disabled={busy}>
          {busy ? 'Saving…' : 'Save to my account'}
        </button>
        <WakeNote busy={busy} />
      </div>
    )
  }

  return (
    <div className="card form-stack">
      <h3>Keep this calculation</h3>
      <p className="muted">
        It is kept only in this browser on this device. It is not sent to CharityFlow or anyone
        else.
      </p>
      <FormMessage kind="error">{error}</FormMessage>
      <button type="button" className="btn btn-primary" onClick={saveHere}>
        Save on this device
      </button>
      {session.unreachable ? (
        <p className="muted">Have an account? Saving to it needs a connection.</p>
      ) : (
        <p className="muted">
          <a href="#/signin">Sign in</a> or <a href="#/register">create an account</a> to keep it
          across devices.
        </p>
      )}
    </div>
  )
}
