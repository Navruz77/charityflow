import StepShell from '../StepShell.jsx'
import MoneyField from '../MoneyField.jsx'
import { helperText } from '../../content/helperText.js'
import { emptyCrypto } from '../../hooks/useZakatForm.js'

export default function StepCrypto({ step, total, form, setForm, errors, onBack, onNext }) {
  const update = (i, patch) => {
    const crypto = form.crypto.map((c, idx) => (idx === i ? { ...c, ...patch } : c))
    setForm({ ...form, crypto })
  }
  const remove = (i) => setForm({ ...form, crypto: form.crypto.filter((_, idx) => idx !== i) })
  const add = () => setForm({ ...form, crypto: [...form.crypto, emptyCrypto()] })

  return (
    <StepShell step={step} total={total} title="Crypto" onBack={onBack} onNext={onNext}>
      {form.crypto.map((c, i) => (
        <fieldset key={i} className="repeatable-item">
          <legend>Crypto holding {i + 1}</legend>
          <MoneyField
            name={`crypto[${i}].valueCents`}
            label="Current value"
            value={c.valueCents}
            errors={errors}
            onChange={(v) => update(i, { valueCents: v })}
          />
          <div className="field">
            <label htmlFor={`cryptoPurpose-${i}`}>How do you hold this?</label>
            <p className="helper">{helperText.cryptoPurpose}</p>
            <select id={`cryptoPurpose-${i}`} value={c.purpose} onChange={(e) => update(i, { purpose: e.target.value })}>
              <option value="longTerm">Long-term</option>
              <option value="trade">Active trading</option>
            </select>
          </div>
          {form.crypto.length > 1 && (
            <button type="button" className="btn btn-secondary" onClick={() => remove(i)}>
              Remove
            </button>
          )}
        </fieldset>
      ))}
      <button type="button" className="btn btn-secondary" onClick={add}>
        Add another holding
      </button>
    </StepShell>
  )
}
