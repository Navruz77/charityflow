import { centsToDisplay } from '../lib/money.js'
import { getReasonText } from '../content/reasonText.js'

// The result's numbers and per-category lines. Used by the result screen and
// by each saved calculation (S4.1, S4.2), so a saved one shows exactly what
// the person saw when they saved it.
export function NumbersCard({ result, headingLevel = 3 }) {
  const H = `h${headingLevel}`
  const debts = (result.debtsSubtracted?.dueNowCents ?? 0) + (result.debtsSubtracted?.installments12mCents ?? 0)
  return (
    <div className="card">
      <H>Your numbers</H>
      <div className="reason-line">
        <span>Total counted wealth</span>
        <span>{centsToDisplay(result.totalZakatableCents)}</span>
      </div>
      <div className="reason-line">
        <span>Debts subtracted</span>
        <span>{centsToDisplay(debts)}</span>
      </div>
      <div className="reason-line">
        <span>Net zakatable wealth</span>
        <span>{centsToDisplay(result.netCents)}</span>
      </div>
      <div className="reason-line">
        <span>Nisab value ({result.nisab?.choice})</span>
        <span>{centsToDisplay(result.nisab?.valueCents)}</span>
      </div>
    </div>
  )
}

export function LinesCard({ result, headingLevel = 3 }) {
  const H = `h${headingLevel}`
  const countedLines = result.lines.filter((l) => l.treatment !== 'excluded')
  return (
    <div className="card">
      <H>How each category was treated</H>
      {countedLines.map((line, i) => (
        <div className="reason-line" key={`${line.category}-${i}`}>
          <span>{getReasonText(line.reasonKey)}</span>
          <span>{centsToDisplay(line.valueCents)}</span>
        </div>
      ))}
    </div>
  )
}
