import Definitions from '../components/Definitions.jsx'

export default function HomePage() {
  return (
    <>
      <div className="card" style={{ textAlign: 'center' }}>
        <h1>CharityFlow</h1>
        <p>
          A free, guided Zakat calculator. Answer a few short questions about your wealth, see
          exactly how each category is treated, and get a clear result — no account needed.
        </p>
        <div style={{ marginTop: 'var(--space-5)' }}>
          <a className="btn btn-primary" href="#/calculator">
            Start calculating
          </a>
        </div>
      </div>

      <div className="card">
        <h2>With a free account</h2>
        <p className="muted">
          Save calculations, get <a href="#/reminders">reminders</a> and plan your giving with the{' '}
          <a href="#/planner">giving planner</a>. An account only needs an email and a password.
        </p>
      </div>

      <Definitions />
    </>
  )
}
