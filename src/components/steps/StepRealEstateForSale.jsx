import StepShell from '../StepShell.jsx'
import MoneyField from '../MoneyField.jsx'
import { MAX_ITEMS_PER_LIST } from '../../lib/inputRules.js'
import { emptyRealEstate } from '../../hooks/useZakatForm.js'

export default function StepRealEstateForSale({ step, total, form, setForm, errors, onBack, onNext }) {
  const update = (i, patch) => {
    const realEstateForSale = form.realEstateForSale.map((p, idx) => (idx === i ? { ...p, ...patch } : p))
    setForm({ ...form, realEstateForSale })
  }
  const remove = (i) => setForm({ ...form, realEstateForSale: form.realEstateForSale.filter((_, idx) => idx !== i) })
  const add = () => setForm({ ...form, realEstateForSale: [...form.realEstateForSale, emptyRealEstate()] })

  return (
    <StepShell step={step} total={total} title="Real estate for sale" onBack={onBack} onNext={onNext}>
      {form.realEstateForSale.map((p, i) => (
        <fieldset key={i} className="repeatable-item">
          <legend>Property {i + 1}</legend>
          <MoneyField
            name={`realEstateForSale[${i}].valueCents`}
            label="Current value of property listed for sale"
            value={p.valueCents}
            errors={errors}
            onChange={(v) => update(i, { valueCents: v })}
          />
          {form.realEstateForSale.length > 1 && (
            <button type="button" className="btn btn-secondary" onClick={() => remove(i)}>
              Remove
            </button>
          )}
        </fieldset>
      ))}
      {form.realEstateForSale.length < MAX_ITEMS_PER_LIST ? (
        <button type="button" className="btn btn-secondary" onClick={add}>
          Add another property
        </button>
      ) : (
        <p className="helper">You can add up to {MAX_ITEMS_PER_LIST}.</p>
      )}
    </StepShell>
  )
}
