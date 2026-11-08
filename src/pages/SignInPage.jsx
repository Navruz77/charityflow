import { useState } from 'react'
import { api, browserTimeZone } from '../lib/api.js'
import { useSession } from '../hooks/useSession.jsx'
import { EmailField, FormMessage, PasswordField, WakeNote } from '../components/AuthFields.jsx'

// A.17 Sign in (S3.3). A failed sign-in never says whether the email or the
// password was wrong; the server sends one message for both.
export default function SignInPage() {
  const { refresh } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notConfirmed, setNotConfirmed] = useState(false)
  const [note, setNote] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNote(null)
    setNotConfirmed(false)
    const res = await api('POST', '/api/auth/login', { email, password, timeZone: browserTimeZone() })
    setBusy(false)
    if (res.ok) {
      await refresh()
      window.location.hash = '/account'
      return
    }
    setNotConfirmed(res.data.error === 'email_not_confirmed')
    setError(res.data.message || 'Sign-in failed. Please try again.')
  }

  async function resend() {
    setBusy(true)
    const res = await api('POST', '/api/auth/resend', { email })
    setBusy(false)
    setNote(res.ok ? 'Confirmation link sent. Check your inbox and spam folder.' : res.data.message)
  }

  return (
    <form className="card form-stack" onSubmit={onSubmit}>
      <h2>Sign in</h2>
      <EmailField value={email} onChange={setEmail} />
      <PasswordField value={password} onChange={setPassword} />
      <FormMessage kind="error">{error}</FormMessage>
      {notConfirmed && (
        <button type="button" className="btn btn-secondary" onClick={resend} disabled={busy}>
          Send the confirmation link again
        </button>
      )}
      <FormMessage>{note}</FormMessage>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <WakeNote busy={busy} />
      <p className="muted">
        <a href="#/reset">Forgot your password?</a>
      </p>
      <p className="muted">
        New here? <a href="#/register">Create an account</a>
      </p>
    </form>
  )
}
