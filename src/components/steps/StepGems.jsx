import StepShell from '../StepShell.jsx'
import MoneyField from '../MoneyField.jsx'
import { MAX_ITEMS_PER_LIST } from '../../lib/inputRules.js'
import { helperText } from '../../content/helperText.js'
import { emptyGem } from '../../hooks/useZakatForm.js'

export default function StepGems({ step, total, form, setForm, errors, onBack, onNext }) {
  const update = (i, patch) => {
    const gems = form.gems.map((g, idx) => (idx === i ? { ...g, ...patch } : g))
    setForm({ ...form, gems })
  }
  const remove = (i) => setForm({ ...form, gems: form.gems.filter((_, idx) => idx !== i) })
  const add = () => setForm({ ...form, gems: [...form.gems, emptyGem()] })

  return (
    <StepShell step={step} total={total} title="Gems" onBack={onBack} onNext={onNext}>
      {form.gems.map((g, i) => (
        <fieldset key={i} className="repeatable-item">
          <legend>Gem {i + 1}</legend>
          <MoneyField
            name={`gems[${i}].valueCents`}
            label="Value"
            value={g.valueCents}
            errors={errors}
            onChange={(v) => update(i, { valueCents: v })}
          />
          <div className="field">
            <label htmlFor={`gemPurpose-${i}`}>How do you hold this gem?</label>
            <p className="helper">{helperText.gemPurpose}</p>
            <select id={`gemPurpose-${i}`} value={g.purpose} onChange={(e) => update(i, { purpose: e.target.value })}>
              <option value="personal">Personal use</option>
              <option value="resale">Held for resale</option>
            </select>
          </div>
          {form.gems.length > 1 && (
            <button type="button" className="btn btn-secondary" onClick={() => remove(i)}>
              Remove
            </button>
          )}
        </fieldset>
      ))}
      {form.gems.length < MAX_ITEMS_PER_LIST ? (
        <button type="button" className="btn btn-secondary" onClick={add}>
          Add another gem
        </button>
      ) : (
        <p className="helper">You can add up to {MAX_ITEMS_PER_LIST}.</p>
      )}
    </StepShell>
  )
}
