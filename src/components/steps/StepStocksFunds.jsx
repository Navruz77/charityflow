import StepShell from '../StepShell.jsx'
import MoneyField from '../MoneyField.jsx'
import NumberField from '../NumberField.jsx'
import { MAX_ITEMS_PER_LIST, cleanPercentText } from '../../lib/inputRules.js'
import { helperText } from '../../content/helperText.js'
import { emptySecurity } from '../../hooks/useZakatForm.js'

export default function StepStocksFunds({ step, total, form, setForm, errors, onBack, onNext }) {
  const update = (i, patch) => {
    const securities = form.securities.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    setForm({ ...form, securities })
  }
  const remove = (i) => setForm({ ...form, securities: form.securities.filter((_, idx) => idx !== i) })
  const add = () => setForm({ ...form, securities: [...form.securities, emptySecurity()] })

  return (
    <StepShell step={step} total={total} title="Stocks and funds" onBack={onBack} onNext={onNext}>
      {form.securities.map((s, i) => (
        <fieldset key={i} className="repeatable-item">
          <legend>Holding {i + 1}</legend>
          <MoneyField
            name={`securities[${i}].valueCents`}
            label="Current value"
            value={s.valueCents}
            errors={errors}
            onChange={(v) => update(i, { valueCents: v })}
          />
          <div className="field">
            <label htmlFor={`secPurpose-${i}`}>How do you hold this?</label>
            <p className="helper">{helperText.securityPurpose}</p>
            <select id={`secPurpose-${i}`} value={s.purpose} onChange={(e) => update(i, { purpose: e.target.value })}>
              <option value="longTerm">Long-term</option>
              <option value="trade">Active trading</option>
            </select>
          </div>
          {s.purpose !== 'trade' && (
            <>
              <div className="field checkbox-field">
                <input
                  id={`secCountInFull-${i}`}
                  type="checkbox"
                  checked={s.countInFull}
                  onChange={(e) => update(i, { countInFull: e.target.checked })}
                />
                <label htmlFor={`secCountInFull-${i}`}>Count the full value</label>
              </div>
              <p className="helper">{helperText.securityCountInFull}</p>
              {!s.countInFull && (
                <NumberField
                  id={`secShare-${i}`}
                  name={`securities[${i}].zakatableSharePct`}
                  label="Zakatable share % (optional, default 30%)"
                  helper={helperText.securitySharePct}
                  value={s.zakatableSharePct}
                  clean={cleanPercentText}
                  errors={errors}
                  onChange={(v) => update(i, { zakatableSharePct: v })}
                />
              )}
            </>
          )}
          {form.securities.length > 1 && (
            <button type="button" className="btn btn-secondary" onClick={() => remove(i)}>
              Remove
            </button>
          )}
        </fieldset>
      ))}
      {form.securities.length < MAX_ITEMS_PER_LIST ? (
        <button type="button" className="btn btn-secondary" onClick={add}>
          Add another holding
        </button>
      ) : (
        <p className="helper">You can add up to {MAX_ITEMS_PER_LIST}.</p>
      )}
    </StepShell>
  )
}
