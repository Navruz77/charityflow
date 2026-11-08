import { useState } from 'react'
import { api } from '../lib/api.js'
import { EmailField, FormMessage, WakeNote } from '../components/AuthFields.jsx'

// A.18 Reset password, step 1 (S3.4): ask for the email and send a link.
// The answer is the same whether or not the email has an account.
export default function ResetPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await api('POST', '/api/auth/reset', { email })
    setBusy(false)
    if (res.ok) setSent(true)
    else setError(res.data.message || 'Could not send the link. Please try again.')
  }

  if (sent) {
    return (
      <div className="card form-stack">
        <h2>Check your email</h2>
        <p>
          If an account exists for <strong>{email.trim()}</strong>, we sent it a link to set a new
          password.
        </p>
        <p className="muted">Look in your spam or junk folder too. The link works on any device.</p>
        <a className="btn btn-secondary" href="#/signin">
          Back to sign in
        </a>
      </div>
    )
  }

  return (
    <form className="card form-stack" onSubmit={onSubmit}>
      <h2>Reset your password</h2>
      <p className="muted">Enter your account's email and we'll send you a link to set a new password.</p>
      <EmailField value={email} onChange={setEmail} />
      <FormMessage kind="error">{error}</FormMessage>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Sending…' : 'Send reset link'}
      </button>
      <WakeNote busy={busy} />
      <p className="muted">
        <a href="#/signin">Back to sign in</a>
      </p>
    </form>
  )
}
