import { useState } from 'react'
import { api, browserTimeZone } from '../lib/api.js'
import { EmailField, FormMessage, PasswordField, WakeNote } from '../components/AuthFields.jsx'

// A.16 Create account (S3.2). Only an email and a password, nothing else.
export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [emailTaken, setEmailTaken] = useState(false)
  const [sentTo, setSentTo] = useState(null) // set once the account is created
  const [resendNote, setResendNote] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setEmailTaken(false)
    const res = await api('POST', '/api/auth/register', { email, password, timeZone: browserTimeZone() })
    setBusy(false)
    if (res.ok) {
      if (res.data.needsConfirmation === false) {
        window.location.hash = '/account'
        return
      }
      setSentTo(email.trim())
      setPassword('')
      return
    }
    setEmailTaken(res.data.error === 'email_taken')
    setError(res.data.message || 'Could not create the account. Please try again.')
  }

  async function resend() {
    setBusy(true)
    const res = await api('POST', '/api/auth/resend', { email: sentTo })
    setBusy(false)
    setResendNote(res.ok ? 'Sent again. It can take a few minutes to arrive.' : res.data.message)
  }

  if (sentTo) {
    return (
      <div className="card form-stack">
        <h2>Check your email</h2>
        <p>
          We sent a confirmation link to <strong>{sentTo}</strong>. Open it to finish creating your account.
        </p>
        <p className="muted">Can't find it? Look in your spam or junk folder. The link works on any device.</p>
        <FormMessage>{resendNote}</FormMessage>
        <div className="btn-row">
          <button type="button" className="btn btn-secondary" onClick={resend} disabled={busy}>
            {busy ? 'Sending…' : 'Send the link again'}
          </button>
          <a className="btn btn-primary" href="#/signin">
            Go to sign in
          </a>
        </div>
        <WakeNote busy={busy} />
      </div>
    )
  }

  return (
    <form className="card form-stack" onSubmit={onSubmit}>
      <h2>Create an account</h2>
      <p className="muted">
        An account lets you save calculations, get reminders and plan your giving. You can use the
        calculator without one.
      </p>
      <EmailField value={email} onChange={setEmail} />
      <PasswordField value={password} onChange={setPassword} isNew />
      <FormMessage kind="error">
        {error}
        {emailTaken && (
          <>
            {' '}
            <a href="#/signin">Sign in</a>
          </>
        )}
      </FormMessage>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Creating account…' : 'Create account'}
      </button>
      <WakeNote busy={busy} />
      <p className="muted">
        Already have an account? <a href="#/signin">Sign in</a>
      </p>
    </form>
  )
}
