import StepShell from '../StepShell.jsx'
import MoneyField from '../MoneyField.jsx'
import NumberField from '../NumberField.jsx'
import { MAX_ITEMS_PER_LIST, cleanPercentText } from '../../lib/inputRules.js'
import { helperText } from '../../content/helperText.js'
import { emptyRetirement } from '../../hooks/useZakatForm.js'

export default function StepRetirement({ step, total, form, setForm, errors, onBack, onNext }) {
  const update = (i, patch) => {
    const retirement = form.retirement.map((r, idx) => (idx === i ? { ...r, ...patch } : r))
    setForm({ ...form, retirement })
  }
  const remove = (i) => setForm({ ...form, retirement: form.retirement.filter((_, idx) => idx !== i) })
  const add = () => setForm({ ...form, retirement: [...form.retirement, emptyRetirement()] })

  return (
    <StepShell step={step} total={total} title="Retirement accounts" onBack={onBack} onNext={onNext}>
      {form.retirement.map((r, i) => (
        <fieldset key={i} className="repeatable-item">
          <legend>Retirement account {i + 1}</legend>
          <MoneyField
            name={`retirement[${i}].vestedBalanceCents`}
            label="Vested balance"
            helper={helperText.vestedBalanceCents}
            value={r.vestedBalanceCents}
            errors={errors}
            onChange={(v) => update(i, { vestedBalanceCents: v })}
          />
          <div className="field">
            <label htmlFor={`retMethod-${i}`}>When is Zakat due on this account?</label>
            <p className="helper">{helperText.retirementMethod}</p>
            <select id={`retMethod-${i}`} value={r.method} onChange={(e) => update(i, { method: e.target.value })}>
              <option value="whenAccessible">When accessible</option>
              <option value="annual">Annually, on a share now</option>
            </select>
          </div>
          {r.method === 'annual' && (
            <>
              <NumberField
                id={`retShare-${i}`}
                name={`retirement[${i}].zakatableSharePct`}
                label="Zakatable share % (optional, default 100%)"
                helper={helperText.retirementSharePct}
                value={r.zakatableSharePct}
                clean={cleanPercentText}
                errors={errors}
                onChange={(v) => update(i, { zakatableSharePct: v })}
              />
              <MoneyField
                name={`retirement[${i}].penaltyTaxCents`}
                label="Early withdrawal penalty or tax"
                helper={helperText.penaltyTaxCents}
                value={r.penaltyTaxCents}
                errors={errors}
                onChange={(v) => update(i, { penaltyTaxCents: v })}
              />
            </>
          )}
          {form.retirement.length > 1 && (
            <button type="button" className="btn btn-secondary" onClick={() => remove(i)}>
              Remove
            </button>
          )}
        </fieldset>
      ))}
      {form.retirement.length < MAX_ITEMS_PER_LIST ? (
        <button type="button" className="btn btn-secondary" onClick={add}>
          Add another account
        </button>
      ) : (
        <p className="helper">You can add up to {MAX_ITEMS_PER_LIST}.</p>
      )}
    </StepShell>
  )
}
