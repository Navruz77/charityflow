import StepShell from '../StepShell.jsx'
import MoneyField from '../MoneyField.jsx'
import NumberField from '../NumberField.jsx'
import { MAX_ITEMS_PER_LIST, cleanPercentText } from '../../lib/inputRules.js'
import { helperText } from '../../content/helperText.js'
import { emptyBusiness } from '../../hooks/useZakatForm.js'

export default function StepBusinesses({ step, total, form, setForm, errors, onBack, onNext }) {
  const update = (i, patch) => {
    const businesses = form.businesses.map((b, idx) => (idx === i ? { ...b, ...patch } : b))
    setForm({ ...form, businesses })
  }
  const remove = (i) => setForm({ ...form, businesses: form.businesses.filter((_, idx) => idx !== i) })
  const add = () => setForm({ ...form, businesses: [...form.businesses, emptyBusiness()] })

  return (
    <StepShell step={step} total={total} title="Businesses" onBack={onBack} onNext={onNext}>
      {form.businesses.map((b, i) => (
        <fieldset key={i} className="repeatable-item">
          <legend>Business {i + 1}</legend>
          <NumberField
            id={`ownership-${i}`}
            name={`businesses[${i}].ownershipPct`}
            label="Your ownership %"
            helper={helperText.ownershipPct}
            value={b.ownershipPct}
            clean={cleanPercentText}
            errors={errors}
            onChange={(v) => update(i, { ownershipPct: v })}
          />
          <MoneyField
            name={`businesses[${i}].cashCents`}
            label="Business cash"
            helper={helperText.businessCashCents}
            value={b.cashCents}
            errors={errors}
            onChange={(v) => update(i, { cashCents: v })}
          />
          <MoneyField
            name={`businesses[${i}].inventoryCents`}
            label="Inventory"
            helper={helperText.businessInventoryCents}
            value={b.inventoryCents}
            errors={errors}
            onChange={(v) => update(i, { inventoryCents: v })}
          />
          <MoneyField
            name={`businesses[${i}].receivablesCents`}
            label="Receivables"
            helper={helperText.businessReceivablesCents}
            value={b.receivablesCents}
            errors={errors}
            onChange={(v) => update(i, { receivablesCents: v })}
          />
          <MoneyField
            name={`businesses[${i}].liabilitiesCents`}
            label="Short-term liabilities"
            helper={helperText.businessLiabilitiesCents}
            value={b.liabilitiesCents}
            errors={errors}
            onChange={(v) => update(i, { liabilitiesCents: v })}
          />
          {form.businesses.length > 1 && (
            <button type="button" className="btn btn-secondary" onClick={() => remove(i)}>
              Remove
            </button>
          )}
        </fieldset>
      ))}
      {form.businesses.length < MAX_ITEMS_PER_LIST ? (
        <button type="button" className="btn btn-secondary" onClick={add}>
          Add another business
        </button>
      ) : (
        <p className="helper">You can add up to {MAX_ITEMS_PER_LIST}.</p>
      )}
    </StepShell>
  )
}
