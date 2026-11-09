import { useState } from 'react'
import { useSession } from '../hooks/useSession.jsx'
import { loadGuestSaves, rememberTransferDeclined, transferDeclined, transferGuestSaves } from '../lib/savedCalculations.js'
import { FormMessage, WakeNote } from './AuthFields.jsx'

// S3.5 / A.20: after signing in, someone with guest saves on this device is
// asked whether to add them to the account. Nothing is sent unless they
// press yes. "No" is remembered only until this tab closes.
// `onDone` lets the Saved page reload both lists afterwards.
export default function TransferPrompt({ onDone }) {
  const session = useSession()
  const [count, setCount] = useState(() => loadGuestSaves().length)
  const [declined, setDeclined] = useState(transferDeclined)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  const [error, setError] = useState(null)

  if (!session.signedIn) return null
  if (note) return <FormMessage>{note}</FormMessage>
  if (count === 0 || declined) return null

  async function accept() {
    setBusy(true)
    setError(null)
    const res = await transferGuestSaves()
    setBusy(false)
    setCount(loadGuestSaves().length)
    onDone?.()
    if (res.remaining === 0) {
      setNote(`${res.added} calculation${res.added === 1 ? ' was' : 's were'} added to your account.`)
      return
    }
    const why = res.offline ? 'This needs a connection.' : res.message || 'Something went wrong.'
    setError(`${res.added} added, ${res.remaining} still only on this device. ${why}`)
  }

  function decline() {
    rememberTransferDeclined()
    setDeclined(true)
  }

  return (
    <section className="card form-stack" aria-labelledby="transfer-title">
      <h2 id="transfer-title">Add them to your account?</h2>
      <p>
        This device has {count} calculation{count === 1 ? '' : 's'} you saved as a guest. Add{' '}
        {count === 1 ? 'it' : 'them'} to your account to keep {count === 1 ? 'it' : 'them'} on every
        device? {count === 1 ? 'It keeps its' : 'They keep their'} original entries, prices and
        results, and {count === 1 ? 'is' : 'are'} then removed from this device.
      </p>
      <FormMessage kind="error">{error}</FormMessage>
      <div className="btn-row">
        <button type="button" className="btn btn-primary" onClick={accept} disabled={busy}>
          {busy ? 'Adding…' : 'Yes, add them'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={decline} disabled={busy}>
          No, keep them here
        </button>
      </div>
      <WakeNote busy={busy} />
    </section>
  )
}
