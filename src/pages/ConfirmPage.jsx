import { useState } from 'react'
import { api, browserTimeZone } from '../lib/api.js'
import { hashParams } from '../hooks/useHashRoute.js'
import { useSession } from '../hooks/useSession.jsx'
import { FormMessage, PasswordField, WakeNote } from '../components/AuthFields.jsx'

// Where the links in our emails land: #/confirm?token_hash=...&type=email
// (new account) or type=recovery (password reset, A.18 step 2).
// The user taps a button before anything happens. Some email services open
// every link to scan it; a button press stops a scanner using up the link.
export default function ConfirmPage() {
  const { refresh, email } = useSession()
  const [params] = useState(hashParams)
  const tokenHash = params.get('token_hash')
  const type = params.get('type')
  const isReset = type === 'recovery'

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [step, setStep] = useState('start') // start -> newPassword -> done
  const [password, setPassword] = useState('')

  if (!tokenHash || !['email', 'recovery'].includes(type)) {
    return (
      <div className="card form-stack">
        <h2>This link is not complete</h2>
        <p>Open the link from the email again, or ask for a new one.</p>
        <p className="muted">
          <a href="#/signin">Sign in</a> · <a href="#/reset">Reset password</a>
        </p>
      </div>
    )
  }

  async function confirm() {
    setBusy(true)
    setError(null)
    const res = await api('POST', '/api/auth/confirm', { tokenHash, type, timeZone: browserTimeZone() })
    setBusy(false)
    if (!res.ok) {
      setError(res.data.message || 'This link did not work. Please ask for a new one.')
      return
    }
    await refresh()
    setStep(isReset ? 'newPassword' : 'done')
  }

  async function saveNewPassword(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await api('POST', '/api/auth/new-password', { password })
    setBusy(false)
    if (res.ok) {
      setPassword('')
      setStep('done')
    } else {
      setError(res.data.message || 'Could not change the password. Please try again.')
    }
  }

  if (step === 'done') {
    return (
      <div className="card form-stack">
        <h2>{isReset ? 'Password changed' : 'Email confirmed'}</h2>
        <p>
          {isReset
            ? 'Your new password is set. Any other device that was signed in has been signed out.'
            : 'Your account is ready and you are signed in.'}
        </p>
        <a className="btn btn-primary" href="#/account">
          Go to my account
        </a>
      </div>
    )
  }

  if (step === 'newPassword') {
    return (
      <form className="card form-stack" onSubmit={saveNewPassword}>
        <h2>Choose a new password</h2>
        <PasswordField value={password} onChange={setPassword} isNew email={email} label="New password" />
        <FormMessage kind="error">{error}</FormMessage>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save new password'}
        </button>
        <WakeNote busy={busy} />
      </form>
    )
  }

  return (
    <div className="card form-stack">
      <h2>{isReset ? 'Reset your password' : 'Confirm your email'}</h2>
      <p>{isReset ? 'Tap below to choose a new password.' : 'Tap below to finish creating your account.'}</p>
      <FormMessage kind="error">{error}</FormMessage>
      <button type="button" className="btn btn-primary" onClick={confirm} disabled={busy}>
        {busy ? 'Checking…' : isReset ? 'Continue' : 'Confirm my email'}
      </button>
      <WakeNote busy={busy} />
      {error && (
        <p className="muted">
          <a href="#/signin">Sign in</a> · <a href="#/reset">Reset password</a>
        </p>
      )}
    </div>
  )
}
