import { definitions } from '../content/definitions.js'

// A few terms, explained — shown on Home and on the result screen (S2.3).
export default function Definitions() {
  return (
    <div className="card">
      <h2>A few terms, explained</h2>
      {definitions.map((d) => (
        <details key={d.term} className="definition">
          <summary>{d.term}</summary>
          <p>{d.text}</p>
        </details>
      ))}
    </div>
  )
}
