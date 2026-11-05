// App header: logo/name and primary nav. "Saved" and "Sign in" are
// disabled placeholders until M4/M5 land.
export default function Header({ route }) {
  return (
    <header className="app-header">
      <a className="brand" href="#/">
        CharityFlow
      </a>
      <nav aria-label="Main">
        <a href="#/calculator" aria-current={route === '/calculator' ? 'page' : undefined}>
          Calculator
        </a>
        <span className="nav-placeholder" aria-disabled="true" title="Coming in a later milestone">
          Saved
        </span>
        <span className="nav-placeholder" aria-disabled="true" title="Coming in a later milestone">
          Sign in
        </span>
      </nav>
    </header>
  )
}
