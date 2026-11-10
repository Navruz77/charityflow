import StepShell from '../StepShell.jsx'
import MoneyField from '../MoneyField.jsx'
import { helperText } from '../../content/helperText.js'

// Each box is one kind of debt. All of them are subtracted in full.
const DEBT_BOXES = [
  ['dueNowCents', 'Debts due now'],
  ['creditCardCents', 'Credit card balances'],
  ['mortgageNextPrincipalCents', 'Mortgage (next principal payment)'],
  ['personalLoansCents', 'Personal loans due this year'],
  ['owedToFamilyCents', 'Money owed to family or friends'],
  ['unpaidTaxesBillsCents', 'Unpaid taxes & bills'],
  ['otherLiabilitiesCents', 'Other liabilities'],
]

export default function StepDebts({ step, total, form, setForm, errors, onBack, onNext }) {
  return (
    <StepShell step={step} total={total} title="Debts" onBack={onBack} onNext={onNext}>
      <fieldset>
        <legend>What you owe</legend>
        <p className="helper">{helperText.debtsIntro}</p>
        {DEBT_BOXES.map(([key, label]) => (
          <MoneyField
            key={key}
            name={`debts.${key}`}
            label={label}
            helper={helperText[`debts.${key}`]}
            value={form.debts[key]}
            errors={errors}
            onChange={(v) => setForm({ ...form, debts: { ...form.debts, [key]: v } })}
          />
        ))}
      </fieldset>
    </StepShell>
  )
}
