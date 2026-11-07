import { centsToDisplay } from '../lib/money.js'
import { getReasonText } from '../content/reasonText.js'
import Definitions from '../components/Definitions.jsx'

const STATUS_COPY = {
  due: { className: 'due', title: 'Zakat is due' },
  belowNisab: { className: 'below', title: 'Below nisab — no Zakat due' },
  notYetDue: { className: 'notyet', title: 'Not yet due' },
  needsNisab: { className: 'notyet', title: 'Choose a nisab to see your result' },
  needsHawl: { className: 'notyet', title: 'Answer the one-year question to see your result' },
}

export default function ResultsPage({ result, pricesUsed, onStartOver }) {
  const status = STATUS_COPY[result.status] ?? STATUS_COPY.belowNisab
  const countedLines = result.lines.filter((l) => l.treatment !== 'excluded')

  return (
    <>
      <div className={`result-status ${status.className}`}>
        <h2>{status.title}</h2>
        <div className="result-amount">{centsToDisplay(result.zakatDueCents)}</div>
      </div>

      <div className="card">
        <h3>Your numbers</h3>
        <div className="reason-line">
          <span>Net zakatable wealth</span>
          <span>{centsToDisplay(result.netCents)}</span>
        </div>
        <div className="reason-line">
          <span>Nisab value ({result.nisab.choice})</span>
          <span>{centsToDisplay(result.nisab.valueCents)}</span>
        </div>
      </div>

      <div className="card">
        <h3>How each category was treated</h3>
        {countedLines.map((line, i) => (
          <div className="reason-line" key={`${line.category}-${i}`}>
            <span>{getReasonText(line.reasonKey)}</span>
            <span>{centsToDisplay(line.valueCents)}</span>
          </div>
        ))}
      </div>

      <p className="muted" style={{ textAlign: 'center' }}>
        Prices as of {pricesUsed?.fetchedAt ? new Date(pricesUsed.fetchedAt).toLocaleString() : 'entered by you'} —{' '}
        <a href="https://metalcharts.org" target="_blank" rel="noreferrer">
          Prices via metalcharts.org
        </a>
      </p>

      <Definitions />

      <div style={{ textAlign: 'center' }}>
        <button type="button" className="btn btn-secondary" onClick={onStartOver}>
          Start over
        </button>
      </div>
    </>
  )
}
