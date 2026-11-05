import { getErrorMessage } from '../content/errorText.js'

// Renders the error message for one field, if any. Always plain text.
export default function FieldError({ errors, field }) {
  const err = errors.find((e) => e.field === field)
  if (!err) return null
  return <p className="field-error">{getErrorMessage(err.field, err.code)}</p>
}
