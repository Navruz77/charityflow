import StepShell from '../StepShell.jsx'
import MoneyField from '../MoneyField.jsx'
import { helperText } from '../../content/helperText.js'

export default function StepGoldSilver({ step, total, form, setForm, errors, onBack, onNext }) {
  return (
    <StepShell step={step} total={total} title="Gold and silver" onBack={onBack} onNext={onNext}>
      <fieldset>
        <legend>Gold</legend>
        <div className="field">
          <label htmlFor="goldGrams">Grams of gold (optional)</label>
          <p className="helper">{helperText.goldGrams}</p>
          <input
            id="goldGrams"
            type="text"
            inputMode="decimal"
            value={form.gold.grams}
            onChange={(e) => setForm({ ...form, gold: { ...form.gold, grams: e.target.value } })}
          />
        </div>
        <MoneyField
          name="gold.valueCents"
          label="Value of gold today"
          value={form.gold.valueCents}
          errors={errors}
          onChange={(v) => setForm({ ...form, gold: { ...form.gold, valueCents: v } })}
        />
      </fieldset>
      <fieldset>
        <legend>Silver</legend>
        <div className="field">
          <label htmlFor="silverGrams">Grams of silver (optional)</label>
          <p className="helper">{helperText.silverGrams}</p>
          <input
            id="silverGrams"
            type="text"
            inputMode="decimal"
            value={form.silver.grams}
            onChange={(e) => setForm({ ...form, silver: { ...form.silver, grams: e.target.value } })}
          />
        </div>
        <MoneyField
          name="silver.valueCents"
          label="Value of silver today"
          value={form.silver.valueCents}
          errors={errors}
          onChange={(v) => setForm({ ...form, silver: { ...form.silver, valueCents: v } })}
        />
      </fieldset>
    </StepShell>
  )
}
