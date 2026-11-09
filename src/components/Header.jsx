import { useSession } from '../hooks/useSession.jsx'

// App header: logo/name and primary nav. The last link is "Sign in" for
// guests and "Account" once signed in.
export default function Header({ route }) {
  const session = useSession()
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
