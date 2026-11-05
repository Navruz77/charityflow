const DEFINITIONS = [
  {
    term: 'Zakat',
    text: 'A yearly obligation to give 2.5% of wealth held above a minimum threshold (nisab) for a full lunar year, to those in need.',
  },
  {
    term: 'Nisab',
    text: 'The minimum amount of wealth you must have before Zakat is due, measured by the value of gold or silver.',
  },
  {
    term: 'Hawl',
    text: 'The one full lunar year (about 354 days) your wealth must stay above the nisab before Zakat is due on it.',
  },
  {
    term: 'Sadaqah',
    text: 'Voluntary charity given at any time, on top of Zakat, with no fixed amount.',
  },
]

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
        <h2>A few terms, explained</h2>
        {DEFINITIONS.map((d) => (
          <details key={d.term} className="definition">
            <summary>{d.term}</summary>
            <p>{d.text}</p>
          </details>
        ))}
      </div>
    </>
  )
}
