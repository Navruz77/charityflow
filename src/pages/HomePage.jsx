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

      <Definitions />
    </>
  )
}
