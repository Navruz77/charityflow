import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { centsToDisplay, dollarsTextToCents } from '../lib/money.js'
import { cleanMoneyText, GIFT_DATE_MIN, isValidIsoDate, MAX_PLANNER_CENTS, NAME_MAX, NOTE_MAX, RECIPIENT_MAX } from '../lib/inputRules.js'
import { toGregorianDisplay } from '../lib/hijri.js'
import { useSession } from '../hooks/useSession.jsx'
import { goalProgress, periodLabel, todayIn } from '../planner/progress.js'
import { FormMessage } from '../components/AuthFields.jsx'
import { NeedsConnection } from '../components/Connection.jsx'

// A.25 to A.27: Sadaqah planner (S8.1 to S8.3). Goals and gifts live on
// our server; progress and streaks are worked out here with the pure rules
// in src/planner/, using the user's stored time zone.
export default function PlannerPage() {
  const session = useSession()
  if (session.loading) return <p className="muted">Loading…</p>
  if (session.unreachable) return <NeedsConnection what="The giving planner" onRetry={session.refresh} />
  if (!session.signedIn) {
    return (
      <div className="card form-stack">
        <h2>Giving planner</h2>
        <p>Set sadaqah goals, log your gifts and see your progress. This needs a free account, so it can be kept safely for you.</p>
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
  return <Planner />
}

// Integer cents -> "12.50" for an input box (no floating point).
const centsToInput = (c) => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`

// A dollar box's text -> cents from $0.01 to the planner maximum, or null.
function positiveCents(text) {
  const c = dollarsTextToCents(text)
  return c !== null && c > 0 && c <= MAX_PLANNER_CENTS ? c : null
}
const AMOUNT_HINT = 'Enter an amount from $0.01 to $10,000,000,000.00, like 50 or 50.00.'

const errorText = (res, fallback) => (res.status === 0 ? 'This needs a connection. Your entries are still here.' : res.data?.message || fallback)

function Planner() {
  const [data, setData] = useState({ loading: true })

  const fetchAll = useCallback(async () => {
    const [goals, gifts, profile] = await Promise.all([api('GET', '/api/goals'), api('GET', '/api/gifts'), api('GET', '/api/profile')])
    if ([goals, gifts, profile].some((r) => r.status === 0)) return setData({ offline: true })
    if (![goals, gifts, profile].every((r) => r.ok)) return setData({ error: 'Could not load your planner. Please try again.' })
    setData({ goals: goals.data.goals, gifts: gifts.data.gifts, timeZone: profile.data.timeZone || 'UTC' })
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const retry = () => {
    setData({ loading: true })
    fetchAll()
  }

  if (data.loading) return <p className="muted">Loading…</p>
  if (data.offline) return <NeedsConnection what="The giving planner" onRetry={retry} />
  if (data.error) return <FormMessage kind="error">{data.error}</FormMessage>

  const today = todayIn(data.timeZone)
  const goals = data.goals.map((g) => ({ ...g, createdOn: todayIn(data.timeZone, new Date(g.createdAt)) }))
  const goalName = new Map(goals.map((g) => [g.id, g.name]))

  // Local updates after each saved change, so progress recalculates at once.
  const setGoals = (fn) => setData((d) => ({ ...d, goals: fn(d.goals) }))
  const setGifts = (fn) => setData((d) => ({ ...d, gifts: fn(d.gifts) }))
  const removeGoalLocally = (goal) => {
    setGoals((list) => list.filter((g) => g.id !== goal.id))
    // Same as the server: its gifts keep its name and stop counting.
    setGifts((list) => list.map((g) => (g.goalId === goal.id ? { ...g, goalId: null, goalLabel: goal.name } : g)))
  }

  return (
    <>
      <h1>Giving planner</h1>

      <section aria-labelledby="goals-title" className="form-stack">
        <h2 id="goals-title">My goals</h2>
        {goals.length === 0 && <p className="card muted">No goals yet. Add one below.</p>}
        {goals.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            progress={goalProgress(g, data.gifts, today)}
            onSaved={(saved) => setGoals((list) => list.map((x) => (x.id === saved.id ? saved : x)))}
            onRemoved={() => removeGoalLocally(g)}
          />
        ))}
        <GoalForm onSaved={(saved) => setGoals((list) => [...list, saved])} />
      </section>

      <GiftForm
        goals={goals}
        today={today}
        onSaved={(saved) => setGifts((list) => [saved, ...list])}
        title="Log a gift"
      />

      <section aria-labelledby="gifts-title" className="card form-stack">
        <h2 id="gifts-title">My gifts</h2>
        {data.gifts.length === 0 && <p className="muted">No gifts logged yet.</p>}
        {[...data.gifts]
          .sort((a, b) => b.givenOn.localeCompare(a.givenOn))
          .map((g) => (
            <GiftRow
              key={g.id}
              gift={g}
              goals={goals}
              today={today}
              goalName={goalName}
              onSaved={(saved) => setGifts((list) => list.map((x) => (x.id === saved.id ? saved : x)))}
              onDeleted={() => setGifts((list) => list.filter((x) => x.id !== g.id))}
            />
          ))}
      </section>
    </>
  )
}

// One goal with this period's progress and its streak (S8.3, A.27).
function GoalCard({ goal, progress, onSaved, onRemoved }) {
  const [mode, setMode] = useState('view') // view | edit | confirmRemove
  const [error, setError] = useState(null)
  const unit = goal.period === 'yearly' ? 'year' : 'month'
  const pct = Math.min(100, Math.floor((progress.givenCents * 100) / goal.amountCents))

  async function remove() {
    const res = await api('DELETE', `/api/goals/${encodeURIComponent(goal.id)}`)
    if (!res.ok && res.status !== 404) return setError(errorText(res, 'Could not remove the goal.'))
    onRemoved()
  }

  if (mode === 'edit') {
    return (
      <GoalForm
        goal={goal}
        onSaved={(saved) => {
          onSaved(saved)
          setMode('view')
        }}
        onCancel={() => setMode('view')}
      />
    )
  }

  return (
    <article className="card form-stack goal-card" aria-labelledby={`goal-${goal.id}`}>
      <h3 id={`goal-${goal.id}`}>{goal.name}</h3>
      <p className="muted">
        {centsToDisplay(goal.amountCents)} each {unit} · {periodLabel(progress.periodKey)}
      </p>
      <div className="progress-track" role="img" aria-label={`${pct}% of this ${unit}'s goal`}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="reason-line">
        <span>Given this {unit}</span>
        <span>{centsToDisplay(progress.givenCents)}</span>
      </div>
      <div className="reason-line">
        <span>Remaining</span>
        <span>{progress.met ? 'Goal met' : centsToDisplay(progress.remainingCents)}</span>
      </div>
      <div className="reason-line">
        <span>Streak</span>
        <span>
          {progress.streak > 0
            ? `${progress.streak} ${unit}${progress.streak === 1 ? '' : 's'} in a row`
            : `None yet (counts each completed ${unit})`}
        </span>
      </div>
      <FormMessage kind="error">{error}</FormMessage>
      {mode === 'confirmRemove' ? (
        <div className="form-stack">
          <p>Remove this goal? Gifts you logged toward it stay, labelled “{goal.name}”, and stop counting toward any goal.</p>
          <div className="btn-row">
            <button type="button" className="btn btn-danger" onClick={remove}>
              Yes, remove it
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setMode('view')}>
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <div className="btn-row">
          <button type="button" className="btn btn-secondary" onClick={() => setMode('edit')}>
            Change
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setMode('confirmRemove')}>
            Remove
          </button>
        </div>
      )}
    </article>
  )
}

// Add a goal, or change one (S8.1, A.25).
function GoalForm({ goal, onSaved, onCancel }) {
  const editing = !!goal
  const idp = editing ? `goal-${goal.id}` : 'new-goal'
  const [name, setName] = useState(goal?.name ?? '')
  const [amount, setAmount] = useState(goal ? centsToInput(goal.amountCents) : '')
  const [period, setPeriod] = useState(goal?.period ?? 'monthly')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    const amountCents = positiveCents(amount)
    if (!name.trim()) return setError('Give the goal a name.')
    if (amountCents === null) return setError(AMOUNT_HINT)
    setBusy(true)
    const body = { name, amountCents, period }
    const res = editing ? await api('PUT', `/api/goals/${encodeURIComponent(goal.id)}`, body) : await api('POST', '/api/goals', body)
    setBusy(false)
    if (!res.ok) return setError(errorText(res, 'Could not save the goal.'))
    onSaved(res.data.goal)
    if (!editing) {
      setName('')
      setAmount('')
      setPeriod('monthly')
    }
  }

  return (
    <form className="card form-stack" onSubmit={submit}>
      <h3>{editing ? 'Change goal' : 'Add a goal'}</h3>
      <div className="field">
        <label htmlFor={`${idp}-name`}>Name</label>
        <input id={`${idp}-name`} type="text" maxLength={NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={`${idp}-amount`}>Amount (US dollars)</label>
        <input id={`${idp}-amount`} type="text" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} onChange={(e) => setAmount(cleanMoneyText(e.target.value))} />
      </div>
      <div className="field">
        <label htmlFor={`${idp}-period`}>Every</label>
        <select id={`${idp}-period`} value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="monthly">Month</option>
          <option value="yearly">Year</option>
        </select>
      </div>
      <FormMessage kind="error">{error}</FormMessage>
      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Add goal'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

// Log a gift, or edit one (S8.2, A.26).
function GiftForm({ gift, goals, today, onSaved, onCancel, title }) {
  const editing = !!gift
  const idp = editing ? `gift-${gift.id}` : 'new-gift'
  const [amount, setAmount] = useState(gift ? centsToInput(gift.amountCents) : '')
  const [givenOn, setGivenOn] = useState(gift?.givenOn ?? today)
  const [recipient, setRecipient] = useState(gift?.recipient ?? '')
  const [note, setNote] = useState(gift?.note ?? '')
  const [goalId, setGoalId] = useState(gift?.goalId ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setSaved(null)
    const amountCents = positiveCents(amount)
    if (amountCents === null) return setError(AMOUNT_HINT)
    if (!isValidIsoDate(givenOn, { min: GIFT_DATE_MIN })) return setError('Enter a real date from 2000 onward.')
    if (givenOn > today) return setError('The date cannot be in the future.')
    setBusy(true)
    const body = { amountCents, givenOn, recipient, note, goalId: goalId || null }
    const res = editing ? await api('PUT', `/api/gifts/${encodeURIComponent(gift.id)}`, body) : await api('POST', '/api/gifts', body)
    setBusy(false)
    if (!res.ok) return setError(errorText(res, 'Could not save the gift.'))
    onSaved(res.data.gift)
    if (!editing) {
      setAmount('')
      setRecipient('')
      setNote('')
      setSaved(`Logged ${centsToDisplay(amountCents)}.`)
    }
  }

  return (
    <form className="card form-stack" onSubmit={submit}>
      <h2 className={editing ? 'h3-size' : undefined}>{title ?? 'Edit gift'}</h2>
      <div className="field">
        <label htmlFor={`${idp}-amount`}>Amount (US dollars)</label>
        <input id={`${idp}-amount`} type="text" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} onChange={(e) => setAmount(cleanMoneyText(e.target.value))} />
      </div>
      <div className="field">
        <label htmlFor={`${idp}-date`}>Date</label>
        <input id={`${idp}-date`} type="date" min={GIFT_DATE_MIN} max={today} value={givenOn} onChange={(e) => setGivenOn(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={`${idp}-goal`}>Goal (optional)</label>
        <select id={`${idp}-goal`} value={goalId} onChange={(e) => setGoalId(e.target.value)}>
          <option value="">No goal</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        {editing && !gift.goalId && gift.goalLabel && !goalId && (
          <p className="helper">Was for the removed goal “{gift.goalLabel}”.</p>
        )}
      </div>
      <div className="field">
        <label htmlFor={`${idp}-recipient`}>Recipient (optional)</label>
        <input id={`${idp}-recipient`} type="text" maxLength={RECIPIENT_MAX} value={recipient} onChange={(e) => setRecipient(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={`${idp}-note`}>Note (optional)</label>
        <textarea id={`${idp}-note`} maxLength={NOTE_MAX} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <FormMessage kind="error">{error}</FormMessage>
      <FormMessage>{saved}</FormMessage>
      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Log gift'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

function GiftRow({ gift, goals, today, goalName, onSaved, onDeleted }) {
  const [mode, setMode] = useState('view') // view | edit | confirmDelete
  const [error, setError] = useState(null)

  async function remove() {
    const res = await api('DELETE', `/api/gifts/${encodeURIComponent(gift.id)}`)
    if (!res.ok && res.status !== 404) return setError(errorText(res, 'Could not delete the gift.'))
    onDeleted()
  }

  if (mode === 'edit') {
    return (
      <GiftForm
        gift={gift}
        goals={goals}
        today={today}
        onSaved={(saved) => {
          onSaved(saved)
          setMode('view')
        }}
        onCancel={() => setMode('view')}
      />
    )
  }

  const goalText = gift.goalId
    ? goalName.get(gift.goalId) ?? 'A goal'
    : gift.goalLabel
      ? `${gift.goalLabel} (removed goal, not counted)`
      : 'No goal'

  return (
    <article className="gift-row">
      <div className="reason-line">
        <strong>{centsToDisplay(gift.amountCents)}</strong>
        <span>{toGregorianDisplay(gift.givenOn)}</span>
      </div>
      <p className="muted">
        {goalText}
        {gift.recipient ? ` · To: ${gift.recipient}` : ''}
      </p>
      {gift.note && <p className="break-anywhere">{gift.note}</p>}
      <FormMessage kind="error">{error}</FormMessage>
      {mode === 'confirmDelete' ? (
        <div className="btn-row">
          <button type="button" className="btn btn-danger" onClick={remove}>
            Yes, delete it
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setMode('view')}>
            Keep it
          </button>
        </div>
      ) : (
        <div className="btn-row">
          <button type="button" className="btn btn-secondary" onClick={() => setMode('edit')}>
            Edit
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setMode('confirmDelete')}>
            Delete
          </button>
        </div>
      )}
    </article>
  )
}
