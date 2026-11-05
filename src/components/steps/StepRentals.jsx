import StepShell from '../StepShell.jsx'
import MoneyField from '../MoneyField.jsx'
import { emptyRental } from '../../hooks/useZakatForm.js'

export default function StepRentals({ step, total, form, setForm, errors, onBack, onNext }) {
  const update = (i, patch) => {
    const rentals = form.rentals.map((r, idx) => (idx === i ? { ...r, ...patch } : r))
    setForm({ ...form, rentals })
  }
  const remove = (i) => setForm({ ...form, rentals: form.rentals.filter((_, idx) => idx !== i) })
  const add = () => setForm({ ...form, rentals: [...form.rentals, emptyRental()] })

  return (
    <StepShell step={step} total={total} title="Rentals" onBack={onBack} onNext={onNext}>
      {form.rentals.map((r, i) => (
        <fieldset key={i} className="repeatable-item">
          <legend>Rental property {i + 1}</legend>
          <MoneyField
            name={`rentals[${i}].rentCollectedUnspentCents`}
            label="Rent collected and unspent"
            value={r.rentCollectedUnspentCents}
            errors={errors}
            onChange={(v) => update(i, { rentCollectedUnspentCents: v })}
          />
          <MoneyField
            name={`rentals[${i}].expensesPaidCents`}
            label="Expenses paid"
            value={r.expensesPaidCents}
            errors={errors}
            onChange={(v) => update(i, { expensesPaidCents: v })}
          />
          {form.rentals.length > 1 && (
            <button type="button" className="btn btn-secondary" onClick={() => remove(i)}>
              Remove
            </button>
          )}
        </fieldset>
      ))}
      <button type="button" className="btn btn-secondary" onClick={add}>
        Add another property
      </button>
    </StepShell>
  )
}
