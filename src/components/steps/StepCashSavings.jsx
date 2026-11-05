import StepShell from '../StepShell.jsx'
import MoneyField from '../MoneyField.jsx'

export default function StepCashSavings({ step, total, form, setForm, errors, onBack, onNext }) {
  return (
    <StepShell step={step} total={total} title="Cash and savings" onBack={onBack} onNext={onNext}>
      <fieldset>
        <legend>Cash and bank accounts</legend>
        <MoneyField
          name="cashCents"
          label="Cash on hand"
          value={form.cashCents}
          errors={errors}
          onChange={(v) => setForm({ ...form, cashCents: v })}
        />
        <MoneyField
          name="savingsCents"
          label="Savings and checking accounts"
          value={form.savingsCents}
          errors={errors}
          onChange={(v) => setForm({ ...form, savingsCents: v })}
        />
      </fieldset>
    </StepShell>
  )
}
