import { useEffect, useState } from 'react'
import {
  PASSWORD_MIN,
  passwordProblems,
  passwordProblemText,
  passwordStrength,
  strengthLabels,
} from '../lib/passwordRules.js'

// Shared pieces for the account forms (A.16 to A.19).

export function EmailField({ value, onChange, id = 'email' }) {
  return (
    <div className="field">
      <label htmlFor={id}>Email</label>
      <input
        id={id}
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

// `isNew` switches the browser's password manager between "suggest a new
// password" and "fill my saved password", and shows the rules and a
// strength meter while typing. `email` lets the rules spot a password made
// from the email name. The server checks the same rules (plus known
// breaches), so this is a guide, not the gatekeeper.
export function PasswordField({ value, onChange, isNew = false, email = '', id = 'password', label = 'Password' }) {
  const [shown, setShown] = useState(false)
  const helperId = `${id}-helper`
  const problems = isNew && value ? passwordProblems(value, email) : []
  const strength = isNew ? passwordStrength(value, email) : 0
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isNew && (
        <p className="helper" id={helperId}>
          At least {PASSWORD_MIN} characters. Several unrelated words together make a strong,
          easy-to-remember password.
        </p>
      )}
      <input
        id={id}
        type={shown ? 'text' : 'password'}
        autoComplete={isNew ? 'new-password' : 'current-password'}
        required
        minLength={isNew ? PASSWORD_MIN : undefined}
        maxLength={72}
        aria-describedby={isNew ? `${helperId} ${id}-strength` : undefined}
        aria-invalid={problems.length > 0 ? true : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {isNew && value && (
        <div id={`${id}-strength`} aria-live="polite">
          <div className="strength-meter" aria-hidden="true">
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className={n <= strength ? `on s${strength}` : ''} />
            ))}
          </div>
          <p className="helper">
            Strength: <strong>{strengthLabels[strength]}</strong>
          </p>
          {problems.map((p) => (
            <p key={p} className="field-error">
              {passwordProblemText[p]}
            </p>
          ))}
        </div>
      )}
      <label className="checkbox-field">
        <input type="checkbox" checked={shown} onChange={(e) => setShown(e.target.checked)} />
        Show password
      </label>
    </div>
  )
}

// A success or error message. Screen readers announce it when it appears.
export function FormMessage({ kind = 'info', children }) {
  if (!children) return null
  return (
    <div className={`notice ${kind === 'error' ? 'notice-error' : ''}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}

// While a request is running for more than a few seconds, explain that the
// free server may be waking up (it sleeps after 15 idle minutes).
export function WakeNote({ busy }) {
  // Mounting a fresh SlowNote per request restarts its 4-second timer.
  return busy ? <SlowNote /> : null
}

function SlowNote() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 4000)
    return () => clearTimeout(timer)
  }, [])
  if (!slow) return null
  return (
    <p className="muted" role="status">
      Waking up the server. This can take up to a minute.
    </p>
  )
}
