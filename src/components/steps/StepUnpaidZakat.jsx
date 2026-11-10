import StepShell from '../StepShell.jsx'
import MoneyField from '../MoneyField.jsx'
import { helperText } from '../../content/helperText.js'
import { MAX_ITEMS_PER_LIST } from '../../lib/inputRules.js'
import { emptyUnpaidYear } from '../../hooks/useZakatForm.js'

// Zakat from earlier years that was never paid. One entry per year; the
// amounts are added on top of this year's Zakat.
export default function StepUnpaidZakat({ step, total, form, setForm, errors, onBack, onNext }) {
  const update = (i, patch) => {
    const unpaidZakat = form.unpaidZakat.map((y, idx) => (idx === i ? { ...y, ...patch } : y))
    setForm({ ...form, unpaidZakat })
  }
  const remove = (i) => setForm({ ...form, unpaidZakat: form.unpaidZakat.filter((_, idx) => idx !== i) })
  const add = () => setForm({ ...form, unpaidZakat: [...form.unpaidZakat, emptyUnpaidYear()] })

  return (
    <StepShell step={step} total={total} title="Unpaid Zakat from previous years" onBack={onBack} onNext={onNext}>
      <p className="helper">{helperText.unpaidZakatIntro}</p>
      {form.unpaidZakat.map((y, i) => (
        <fieldset key={i} className="repeatable-item">
          <legend>Unpaid year {i + 1}</legend>
          <MoneyField
            name={`unpaidZakat[${i}].amountCents`}
            label="Zakat you still owe for that year"
            helper={helperText.unpaidZakatAmount}
            value={y.amountCents}
            errors={errors}
            onChange={(v) => update(i, { amountCents: v })}
          />
          {form.unpaidZakat.length > 1 && (
            <button type="button" className="btn btn-secondary" onClick={() => remove(i)}>
              Remove
            </button>
          )}
        </fieldset>
      ))}
      {form.unpaidZakat.length < MAX_ITEMS_PER_LIST ? (
        <button type="button" className="btn btn-secondary" onClick={add}>
          Add another year
        </button>
      ) : (
        <p className="helper">You can add up to {MAX_ITEMS_PER_LIST}.</p>
      )}
    </StepShell>
  )
}
