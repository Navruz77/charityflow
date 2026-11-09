import { useSession } from '../hooks/useSession.jsx'
import { useReminderCount } from '../hooks/useReminderCount.js'

// App header: logo/name and primary nav. The last link is "Sign in" for
// guests and "Account" once signed in.
export default function Header({ route }) {
  const session = useSession()
  const unread = useReminderCount(session.signedIn)
  const current = (path) => (route === path ? 'page' : undefined)

  return (
    <header className="app-header">
      <a className="brand" href="#/">
        CharityFlow
      </a>
      <nav aria-label="Main">
        <a href="#/calculator" aria-current={current('/calculator')}>
          Calculator
        </a>
        <a href="#/saved" aria-current={current('/saved')}>
          Saved
        </a>
        {session.signedIn && (
          <a
            href="#/reminders"
            aria-current={current('/reminders')}
            aria-label={unread > 0 ? `Reminders, ${unread} new` : undefined}
          >
            Reminders{unread > 0 && <span className="badge">{unread}</span>}
          </a>
        )}
        {session.signedIn && (
          <a href="#/planner" aria-current={current('/planner')}>
            Planner
          </a>
        )}
        {session.signedIn ? (
          <a href="#/account" aria-current={current('/account')}>
            Account
          </a>
        ) : (
          <a href="#/signin" aria-current={current('/signin')}>
            Sign in
          </a>
        )}
      </nav>
    </header>
  )
}
