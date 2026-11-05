import StepShell from '../StepShell.jsx'
import MoneyField from '../MoneyField.jsx'
import { helperText } from '../../content/helperText.js'

export default function StepDebts({ step, total, form, setForm, errors, onBack, onNext }) {
  return (
    <StepShell step={step} total={total} title="Debts" onBack={onBack} onNext={onNext}>
      <fieldset>
        <legend>What you owe</legend>
        <MoneyField
          name="debts.dueNowCents"
          label="Debts due now"
          helper={helperText.debtsDueNowCents}
          value={form.debts.dueNowCents}
          errors={errors}
          onChange={(v) => setForm({ ...form, debts: { ...form.debts, dueNowCents: v } })}
        />
        <MoneyField
          name="debts.installments12mCents"
          label="Next 12 months of installment payments"
          helper={helperText.debtsInstallments12mCents}
          value={form.debts.installments12mCents}
          errors={errors}
          onChange={(v) => setForm({ ...form, debts: { ...form.debts, installments12mCents: v } })}
        />
      </fieldset>
    </StepShell>
  )
}
