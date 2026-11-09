import FieldError from './FieldError.jsx'

// A labelled number box (grams or a percentage). `clean` drops any
// character the field doesn't allow as it is typed or pasted (see
// src/lib/inputRules.js), so letters can never get in. `name` is the
// engine's field path, used to show this field's error.
export default function NumberField({ id, name, label, helper, value, onChange, clean, errors = [], placeholder }) {
  const hasError = errors.some((e) => e.field === name)
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {helper && (
        <p className="helper" id={`${id}-helper`}>
          {helper}
        </p>
      )}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        aria-invalid={hasError}
        aria-describedby={helper ? `${id}-helper` : undefined}
        onChange={(e) => onChange(clean(e.target.value, value))}
      />
      <FieldError errors={errors} field={name} />
    </div>
  )
}
