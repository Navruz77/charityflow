import ProgressIndicator from '../ProgressIndicator.jsx'
import { describeField, getErrorMessage } from '../../content/errorText.js'
import { centsToDisplay, dollarsTextToCents } from '../../lib/money.js'

// Shows every entered value before calculating, with an "Edit" link back
// to the step that owns it. Blank fields are shown as $0 so nothing looks
// mysteriously missing.
function Row({ label, value, onEdit }) {
  return (
    <div className="reason-line">
      <span>{label}</span>
      <span>
        {value || '(blank)'}{' '}
        <button type="button" className="btn btn-secondary" style={{ padding: '2px 10px', minHeight: 'auto' }} onClick={onEdit}>
          Edit
        </button>
      </span>
    </div>
  )
}

export default function StepSummary({ step, total, form, goToStep, onCalculate, errors = [] }) {
  const dollar = (v) => (v ? `$${v}` : '')
  // Adds up several typed amounts for one row. Blank if all are blank;
  // an entry that isn't a valid amount is listed in the errors instead.
  const sumOf = (texts) => {
    if (texts.every((t) => !t)) return ''
    const sum = texts.reduce((acc, t) => acc + (dollarsTextToCents(t) ?? 0), 0)
    return centsToDisplay(sum)
  }

  return (
    <div className="card">
      <ProgressIndicator step={step} total={total} label="Review" />
      <h2 style={{ marginTop: 'var(--space-4)' }}>Review your answers</h2>
      <p className="muted">Check everything below, then calculate your Zakat.</p>

      <Row label="Cash" value={dollar(form.cashCents)} onEdit={() => goToStep(0)} />
      <Row label="Savings" value={dollar(form.savingsCents)} onEdit={() => goToStep(0)} />
      <Row label="Gold value" value={dollar(form.gold.valueCents)} onEdit={() => goToStep(1)} />
      <Row label="Silver value" value={dollar(form.silver.valueCents)} onEdit={() => goToStep(1)} />
      <Row label={`Stocks and funds (${form.securities.length})`} value="" onEdit={() => goToStep(2)} />
      <Row label={`Crypto (${form.crypto.length})`} value="" onEdit={() => goToStep(3)} />
      <Row label={`Real estate for sale (${form.realEstateForSale.length})`} value="" onEdit={() => goToStep(4)} />
      <Row label={`Rentals (${form.rentals.length})`} value="" onEdit={() => goToStep(5)} />
      <Row label={`Businesses (${form.businesses.length})`} value="" onEdit={() => goToStep(6)} />
      <Row label={`Retirement accounts (${form.retirement.length})`} value="" onEdit={() => goToStep(7)} />
      <Row label="Debts (total)" value={sumOf(Object.values(form.debts))} onEdit={() => goToStep(8)} />
      <Row
        label={`Unpaid Zakat from previous years (${form.unpaidZakat.length})`}
        value={sumOf(form.unpaidZakat.map((y) => y.amountCents))}
        onEdit={() => goToStep(9)}
      />
      <Row label="Nisab" value={form.nisab} onEdit={() => goToStep(10)} />

      {errors.length > 0 && (
        <div className="notice notice-error" role="alert">
          <p>
            <strong>
              {errors.length === 1 ? 'One entry needs' : `${errors.length} entries need`} fixing before calculating:
            </strong>
          </p>
          <ul className="error-list">
            {errors.map((e) => {
              const { step: at, label } = describeField(e.field)
              return (
                <li key={e.field}>
                  {label}: {getErrorMessage(e.field, e.code)}{' '}
                  {at !== null && (
                    <button type="button" className="btn btn-secondary btn-small" onClick={() => goToStep(at)}>
                      Fix
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="btn-row" style={{ marginTop: 'var(--space-5)' }}>
        <button type="button" className="btn btn-secondary" onClick={() => goToStep(10)}>
          Back
        </button>
        <button type="button" className="btn btn-primary" onClick={onCalculate} disabled={!onCalculate}>
          Calculate my Zakat
        </button>
      </div>
    </div>
  )
}
