import { useCallback, useEffect, useState } from 'react'
import { api, browserTimeZone } from '../lib/api.js'
import { useSession } from '../hooks/useSession.jsx'
import { REMINDER_TYPES, reminderText } from '../content/reminderText.js'
import { HIJRI_MONTH_NAMES, hijriOfIsoDate } from '../lib/hijriParts.js'
import { toGregorianDisplay, toHijriDisplay } from '../lib/hijri.js'
import { FormMessage, WakeNote } from '../components/AuthFields.jsx'
import { NeedsConnection } from '../components/Connection.jsx'
import { notifyRemindersChanged } from '../hooks/useReminderCount.js'

// A.22 reminder settings and A.23 in-app reminders (S6.1, S6.3 to S6.5).
// Guests are offered an account (S3.1).
export default function RemindersPage() {
  const session = useSession()
  if (session.loading) return <p className="muted">Loading…</p>
  if (session.unreachable) return <NeedsConnection what="Reminders" onRetry={session.refresh} />
  if (!session.signedIn) {
    return (
      <div className="card form-stack">
        <h2>Reminders</h2>
        <p>
          Reminders arrive by email or in the app on your own local day. This needs a free account, so
          it can be kept safely for you.
        </p>
        <p className="muted">An account only asks for an email address and a password.</p>
        <div className="btn-row">
          <a className="btn btn-primary" href="#/register">
            Create an account
          </a>
          <a className="btn btn-secondary" href="#/signin">
            Sign in
          </a>
        </div>
      </div>
    )
  }
  return <SignedInReminders />
}

function SignedInReminders() {
  const [data, setData] = useState({ loading: true })

  const fetchAll = useCallback(async () => {
    const [prefs, profile, list] = await Promise.all([
      api('GET', '/api/reminder-prefs'),
      api('GET', '/api/profile'),
      api('GET', '/api/reminders'),
    ])
    if (prefs.status === 0 || profile.status === 0 || list.status === 0) return setData({ offline: true })
    if (!prefs.ok || !profile.ok || !list.ok) return setData({ error: 'Could not load your reminders. Please try again.' })
    setData({ prefs: prefs.data.prefs, zakatDate: profile.data.zakatDate, reminders: list.data.reminders })
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const retry = () => {
    setData({ loading: true })
    fetchAll()
  }

  if (data.loading) return <p className="muted">Loading…</p>
  if (data.offline) return <NeedsConnection what="Reminders" onRetry={retry} />
  if (data.error) return <FormMessage kind="error">{data.error}</FormMessage>

  return (
    <>
      <h1>Reminders</h1>
      <InAppReminders initial={data.reminders} />
      <ZakatDateCard initial={data.zakatDate} onChange={(zakatDate) => setData((d) => ({ ...d, zakatDate }))} />
      <ReminderSettings initial={data.prefs} hasZakatDate={!!data.zakatDate} />
    </>
  )
}

// A.23: reminders delivered in the app, newest first.
function InAppReminders({ initial }) {
  const [list, setList] = useState(initial)
  const [error, setError] = useState(null)
  const unread = list.filter((r) => !r.read).length

  async function markRead(body, match) {
    setError(null)
    const res = await api('POST', '/api/reminders/read', body)
    if (!res.ok) return setError(res.status === 0 ? 'This needs a connection.' : res.data.message || 'Could not update.')
    setList((l) => l.map((r) => (match(r) ? { ...r, read: true } : r)))
    notifyRemindersChanged()
  }

  return (
    <section className="card form-stack" aria-labelledby="inapp-title">
      <h2 id="inapp-title">
        Your reminders{unread > 0 ? ` (${unread} new)` : ''}
      </h2>
      {list.length === 0 && <p className="muted">No reminders in the last 30 days.</p>}
      {list.map((r) => (
        <article key={`${r.type}-${r.localDate}`} className={`reminder-item${r.read ? '' : ' unread'}`}>
          <h3>{r.title}</h3>
          <p>{r.text}</p>
          <p className="muted">
            {toGregorianDisplay(r.localDate)}
            {r.read ? ' · read' : ''}
          </p>
          {!r.read && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => markRead({ type: r.type, localDate: r.localDate }, (x) => x.type === r.type && x.localDate === r.localDate)}
            >
              Mark as read
            </button>
          )}
        </article>
      ))}
      {unread > 1 && (
        <button type="button" className="btn btn-secondary" onClick={() => markRead({ all: true }, () => true)}>
          Mark all as read
        </button>
      )}
      <FormMessage kind="error">{error}</FormMessage>
    </section>
  )
}

// S6.1: set, change or remove the Zakat date. No countdown is shown.
function ZakatDateCard({ initial, onChange }) {
  const [saved, setSaved] = useState(initial)
  const [value, setValue] = useState(initial ?? '')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  const [error, setError] = useState(null)
  const hijri = hijriOfIsoDate(saved)

  async function save(zakatDate) {
    setBusy(true)
    setNote(null)
    setError(null)
    const res = await api('PUT', '/api/profile', { zakatDate, timeZone: browserTimeZone() })
    setBusy(false)
    if (!res.ok) return setError(res.status === 0 ? 'Saving needs a connection.' : res.data.message || 'Could not save.')
    setSaved(zakatDate)
    setValue(zakatDate ?? '')
    onChange(zakatDate)
    setNote(zakatDate ? 'Zakat date saved.' : 'Zakat date removed.')
  }

  return (
    <form
      className="card form-stack"
      onSubmit={(e) => {
        e.preventDefault()
        if (value) save(value)
      }}
    >
      <h2>My Zakat date</h2>
      {saved ? (
        <p>
          {toGregorianDisplay(saved)} ({toHijriDisplay(saved) ?? 'Hijri date not available'}). It comes round
          each year on its Hijri date, so your Zakat-month reminders arrive during{' '}
          <strong>{hijri ? HIJRI_MONTH_NAMES[hijri.month - 1] : 'that Hijri month'}</strong>.
        </p>
      ) : (
        <p className="muted">Not set. The calculator will fill it in for you once it is saved here.</p>
      )}
      <div className="field">
        <label htmlFor="account-zakat-date">{saved ? 'Change the date' : 'Zakat date'}</label>
        <input id="account-zakat-date" type="date" value={value} onChange={(e) => setValue(e.target.value)} />
        {value && <p className="helper">Hijri: {toHijriDisplay(value) ?? 'not available in this browser'}</p>}
      </div>
      <FormMessage kind="error">{error}</FormMessage>
      <FormMessage>{note}</FormMessage>
      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={busy || !value || value === saved}>
          Save date
        </button>
        {saved && (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => save(null)}>
            Remove date
          </button>
        )}
      </div>
      <WakeNote busy={busy} />
    </form>
  )
}

// S6.5: four types, all off until turned on; in-app and email chosen separately.
function ReminderSettings({ initial, hasZakatDate }) {
  const [prefs, setPrefs] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  const [error, setError] = useState(null)

  const update = (type, change) => {
    setNote(null)
    setPrefs((list) =>
      list.map((p) => {
        if (p.type !== type) return p
        const next = { ...p, ...change }
        // Turning one on with no channel picks "in the app" to start with.
        if (change.enabled && !next.inApp && !next.email) next.inApp = true
        return next
      }),
    )
  }

  async function save(e) {
    e.preventDefault()
    setError(null)
    setNote(null)
    if (prefs.some((p) => p.enabled && !p.inApp && !p.email)) {
      return setError('Each reminder that is on needs "In the app", "By email" or both.')
    }
    setBusy(true)
    // M6 unknown 4: the browser's time zone is stored with every save.
    const res = await api('PUT', '/api/reminder-prefs', { prefs, timeZone: browserTimeZone() })
    setBusy(false)
    if (!res.ok) return setError(res.status === 0 ? 'Saving needs a connection. Your choices are still on screen.' : res.data.message || 'Could not save.')
    setNote(`Saved. Reminders follow your time zone (${browserTimeZone()}) and arrive after 9:00 in the morning.`)
  }

  return (
    <form className="card form-stack" onSubmit={save}>
      <h2>Reminder settings</h2>
      <p className="muted">Every reminder is off until you turn it on.</p>
      {REMINDER_TYPES.map((type) => {
        const p = prefs.find((x) => x.type === type)
        const t = reminderText[type]
        return (
          <fieldset key={type} className="reminder-pref">
            <legend>{t.label}</legend>
            <p className="helper">{t.when}</p>
            <label className="checkbox-field">
              <input type="checkbox" checked={p.enabled} onChange={(e) => update(type, { enabled: e.target.checked })} />
              Remind me
            </label>
            <div className="reminder-channels">
              <label className="checkbox-field">
                <input type="checkbox" checked={p.inApp} disabled={!p.enabled} onChange={(e) => update(type, { inApp: e.target.checked })} />
                In the app
              </label>
              <label className="checkbox-field">
                <input type="checkbox" checked={p.email} disabled={!p.enabled} onChange={(e) => update(type, { email: e.target.checked })} />
                By email
              </label>
            </div>
            {type === 'zakatMonth' && p.enabled && !hasZakatDate && (
              <p className="field-error">Set your Zakat date above, or this reminder has no month to follow.</p>
            )}
          </fieldset>
        )
      })}
      <FormMessage kind="error">{error}</FormMessage>
      <FormMessage>{note}</FormMessage>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Saving…' : 'Save reminder settings'}
      </button>
      <WakeNote busy={busy} />
    </form>
  )
}
