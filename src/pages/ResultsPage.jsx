import { centsToDisplay } from '../lib/money.js'
import Definitions from '../components/Definitions.jsx'
import SaveCalculation from '../components/SaveCalculation.jsx'
import { LinesCard, NumbersCard } from '../components/ResultBreakdown.jsx'
import { priceAge, statusCopy } from '../lib/resultText.js'

export default function ResultsPage({ result, inputs, pricesUsed, onStartOver, onEdit }) {
  const status = statusCopy(result.status)
  const age = priceAge(pricesUsed?.fetchedAt)

  return (
    <>
      <div className={`result-status ${status.className}`}>
        <h2>{status.title}</h2>
        <div className="result-amount">{centsToDisplay(result.zakatDueCents)}</div>
      </div>

      <NumbersCard result={result} />
      <LinesCard result={result} />

      {/* S12.2 and S5.1: when the prices were retrieved, and how old they are. */}
      <p className="muted" style={{ textAlign: 'center' }}>
        Prices as of {pricesUsed?.fetchedAt ? new Date(pricesUsed.fetchedAt).toLocaleString() : 'unknown'}
        {age ? ` (${age})` : ''} —{' '}
        <a href="https://metalcharts.org" target="_blank" rel="noreferrer">
          Metal prices by MetalCharts
        </a>
      </p>

      <SaveCalculation inputs={inputs} result={result} pricesUsed={pricesUsed} />

      <Definitions />

      <div className="btn-row" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn btn-secondary" onClick={onEdit}>
          Change my entries
        </button>
        <button type="button" className="btn btn-secondary" onClick={onStartOver}>
          Start over
        </button>
      </div>
    </>
  )
}
