import { useState } from 'react'
import { api, browserTimeZone } from '../lib/api.js'
import { toGregorianDisplay, toHijriDisplay } from '../lib/hijri.js'
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
  const [offerDate, setOfferDate] = useState(null)
  const [dateNote, setDateNote] = useState(null)

  async function confirmYearlyDate() {
    const res = await api('PUT', '/api/profile', { zakatDate: offerDate, timeZone: browserTimeZone() })
    setOfferDate(null)
    setDateNote(res.ok ? 'Saved as your yearly Zakat date.' : 'Could not save the date. You can set it on the Reminders page.')
  }

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
    if (res.ok) {
      setSavedTo('account')
      // M6: offer this calculation's Zakat date as the yearly one.
      if (inputs.zakatDate) {
        const profile = await api('GET', '/api/profile')
        if (profile.ok && profile.data.zakatDate !== inputs.zakatDate) setOfferDate(inputs.zakatDate)
      }
      return
    }
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
        {offerDate && (
          <div className="form-stack">
            <p>
              Use {toGregorianDisplay(offerDate)} ({toHijriDisplay(offerDate) ?? 'Hijri date not available'}) as your
              yearly Zakat date? Zakat-month reminders follow it.
            </p>
            <div className="btn-row">
              <button type="button" className="btn btn-primary" onClick={confirmYearlyDate}>
                Yes, use this date
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setOfferDate(null)}>
                No, keep my current one
              </button>
            </div>
          </div>
        )}
        <FormMessage>{dateNote}</FormMessage>
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
