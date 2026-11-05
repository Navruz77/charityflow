import ProgressIndicator from '../ProgressIndicator.jsx'

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

export default function StepSummary({ step, total, form, goToStep, onCalculate, calcError }) {
  const dollar = (v) => (v ? `$${v}` : '')

  return (
    <div className="card">
      <ProgressIndicator step={step} total={total} label="Review" />
      <h2 style={{ marginTop: 'var(--space-4)' }}>Review your answers</h2>
      <p className="muted">Check everything below, then calculate your Zakat.</p>

      <Row label="Cash" value={dollar(form.cashCents)} onEdit={() => goToStep(0)} />
      <Row label="Savings" value={dollar(form.savingsCents)} onEdit={() => goToStep(0)} />
      <Row label="Gold value" value={dollar(form.gold.valueCents)} onEdit={() => goToStep(1)} />
      <Row label="Silver value" value={dollar(form.silver.valueCents)} onEdit={() => goToStep(1)} />
      <Row label={`Gems (${form.gems.length})`} value="" onEdit={() => goToStep(2)} />
      <Row label={`Stocks and funds (${form.securities.length})`} value="" onEdit={() => goToStep(3)} />
      <Row label={`Crypto (${form.crypto.length})`} value="" onEdit={() => goToStep(4)} />
      <Row label={`Real estate for sale (${form.realEstateForSale.length})`} value="" onEdit={() => goToStep(5)} />
      <Row label={`Rentals (${form.rentals.length})`} value="" onEdit={() => goToStep(6)} />
      <Row label={`Businesses (${form.businesses.length})`} value="" onEdit={() => goToStep(7)} />
      <Row label={`Retirement accounts (${form.retirement.length})`} value="" onEdit={() => goToStep(8)} />
      <Row label="Debts due now" value={dollar(form.debts.dueNowCents)} onEdit={() => goToStep(9)} />
      <Row label="Nisab" value={form.nisab} onEdit={() => goToStep(10)} />

      {calcError && <p className="field-error">{calcError}</p>}

      <div className="btn-row" style={{ marginTop: 'var(--space-5)' }}>
        <button type="button" className="btn btn-secondary" onClick={() => goToStep(10)}>
          Back
        </button>
        <button type="button" className="btn btn-primary" onClick={onCalculate}>
          Calculate my Zakat
        </button>
      </div>
    </div>
  )
}
