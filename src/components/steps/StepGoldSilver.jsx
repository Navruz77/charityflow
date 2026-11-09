import StepShell from '../StepShell.jsx'
import MoneyField from '../MoneyField.jsx'
import NumberField from '../NumberField.jsx'
import { cleanGramsText } from '../../lib/inputRules.js'
import { helperText } from '../../content/helperText.js'

export default function StepGoldSilver({ step, total, form, setForm, errors, onBack, onNext }) {
  return (
    <StepShell step={step} total={total} title="Gold and silver" onBack={onBack} onNext={onNext}>
      <fieldset>
        <legend>Gold</legend>
        <NumberField
          id="goldGrams"
          name="gold.grams"
          label="Grams of gold (optional)"
          helper={helperText.goldGrams}
          value={form.gold.grams}
          clean={cleanGramsText}
          errors={errors}
          onChange={(v) => setForm({ ...form, gold: { ...form.gold, grams: v } })}
        />
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
        <NumberField
          id="silverGrams"
          name="silver.grams"
          label="Grams of silver (optional)"
          helper={helperText.silverGrams}
          value={form.silver.grams}
          clean={cleanGramsText}
          errors={errors}
          onChange={(v) => setForm({ ...form, silver: { ...form.silver, grams: v } })}
        />
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
