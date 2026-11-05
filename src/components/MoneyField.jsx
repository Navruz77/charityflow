import FieldError from './FieldError.jsx'
import { helperText } from '../content/helperText.js'

// A labeled dollar-amount text input, with helper text and field-level
// error display. `name` must match the engine's field-path for this value.
export default function MoneyField({ name, label, value, onChange, errors, helper }) {
  const hasError = errors.some((e) => e.field === name)
  const inputId = `field-${name}`
  const helperLine = helper ?? helperText[name]
  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      {helperLine && <p className="helper">{helperLine}</p>}
      <input
        id={inputId}
        type="text"
        inputMode="decimal"
        placeholder="0.00"
        value={value}
        aria-invalid={hasError}
        aria-describedby={`${inputId}-helper`}
        onChange={(e) => onChange(e.target.value)}
      />
      <FieldError errors={errors} field={name} />
    </div>
  )
}
