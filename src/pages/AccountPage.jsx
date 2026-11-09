import { useState } from 'react'
import { api } from '../lib/api.js'
import { useSession } from '../hooks/useSession.jsx'
import { FormMessage, PasswordField, WakeNote } from '../components/AuthFields.jsx'
import { NeedsConnection } from '../components/Connection.jsx'
import TransferPrompt from '../components/TransferPrompt.jsx'
import { forgetTransferAnswer } from '../lib/savedCalculations.js'

const CONFIRM_WORD = 'DELETE' // must match the server (server/routes/account.js)

// A.19 Account: who is signed in, sign out, delete the account (S3.3, S3.6).
export default function AccountPage() {
  const session = useSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [signOutError, setSignOutError] = useState(null)
  const [typed, setTyped] = useState('')
  const [password, setPassword] = useState('')
  const [deleted, setDeleted] = useState(false)

  async function signOut() {
    setBusy(true)
    const res = await api('POST', '/api/auth/logout')
    if (res.status === 0) {
      setBusy(false)
      setSignOutError('Signing out needs a connection. You are still signed in.')
      return
    }
    forgetTransferAnswer()
    await session.refresh()
    setBusy(false)
    window.location.hash = '/'
  }

  async function deleteAccount(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await api('DELETE', '/api/account', { confirm: typed, password })
    setBusy(false)
    if (!res.ok) {
      setPassword('')
      setError(res.data.message || 'Could not delete the account. Nothing was removed.')
      return
    }
    setDeleted(true)
    await session.refresh()
  }

  if (deleted) {
    return (
      <div className="card form-stack">
        <h2>Account deleted</h2>
        <p>Your account and everything saved in it have been permanently removed.</p>
        <a className="btn btn-primary" href="#/">
          Back to home
        </a>
      </div>
    )
  }

  if (session.loading) return <p className="muted">Loading…</p>

  if (session.unreachable) return <NeedsConnection what="Your account" onRetry={session.refresh} />

  if (!session.signedIn) {
    return (
      <div className="card form-stack">
        <h2>My account</h2>
        <p>You are not signed in.</p>
        <div className="btn-row">
          <a className="btn btn-primary" href="#/signin">
            Sign in
          </a>
          <a className="btn btn-secondary" href="#/register">
            Create an account
          </a>
        </div>
      </div>
    )
  }

  return (
    <>
      <TransferPrompt />
      <div className="card form-stack">
        <h2>My account</h2>
        <div className="reason-line">
          <span>Signed in as</span>
          <span className="break-anywhere">{session.email}</span>
        </div>
        <a className="btn btn-secondary" href="#/saved">
          My saved calculations
        </a>
        <FormMessage kind="error">{signOutError}</FormMessage>
        <button type="button" className="btn btn-secondary" onClick={signOut} disabled={busy}>
          Sign out
        </button>
      </div>

      <form className="card form-stack" onSubmit={deleteAccount}>
        <h2>Delete my account</h2>
        <p>
          This permanently removes your email, saved calculations, reminders, giving log and
          settings. It cannot be undone.
        </p>
        <div className="field">
          <label htmlFor="delete-confirm">Type {CONFIRM_WORD} to confirm</label>
          <input
            id="delete-confirm"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={20}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
        <PasswordField value={password} onChange={setPassword} id="delete-password" label="Your password" />
        <FormMessage kind="error">{error}</FormMessage>
        <button type="submit" className="btn btn-danger" disabled={busy || typed !== CONFIRM_WORD || !password}>
          {busy ? 'Deleting…' : 'Delete my account forever'}
        </button>
        <WakeNote busy={busy} />
      </form>
    </>
  )
}
