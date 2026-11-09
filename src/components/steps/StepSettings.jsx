import { useState } from 'react'
import StepShell from '../StepShell.jsx'
import { helperText } from '../../content/helperText.js'
import { toGregorianDisplay, toHijriDisplay } from '../../lib/hijri.js'
import { DATE_MAX, DATE_MIN, isValidIsoDate } from '../../lib/inputRules.js'
import FieldError from '../FieldError.jsx'

// Nisab and the one-lunar-year question have no default — Zakat cannot be
// calculated without an explicit answer to both (PROJECT.md S1.9).
export default function StepSettings({ step, total, form, setForm, errors = [], onBack, onNext }) {
  const [touched, setTouched] = useState(false)
  const nisabMissing = form.nisab !== 'gold' && form.nisab !== 'silver'
  const hawlMissing = typeof form.heldOneLunarYear !== 'boolean'
  const dateBad = form.zakatDate !== '' && !isValidIsoDate(form.zakatDate)

  const handleNext = () => {
    if (nisabMissing || hawlMissing || dateBad) {
      setTouched(true)
      return
    }
    onNext()
  }

  return (
    <StepShell step={step} total={total} title="Settings" onBack={onBack} onNext={handleNext} nextLabel="Review">
      <fieldset>
        <legend>Nisab and timing</legend>
        <div className="field">
          <label htmlFor="nisab">Nisab threshold</label>
          <p className="helper">{helperText.nisab}</p>
          <select
            id="nisab"
            value={form.nisab}
            aria-invalid={touched && nisabMissing}
            onChange={(e) => setForm({ ...form, nisab: e.target.value })}
          >
            <option value="">Choose one…</option>
            <option value="silver">Silver (612.36g)</option>
            <option value="gold">Gold (87.48g)</option>
          </select>
          {touched && nisabMissing && <p className="field-error">Choose a nisab threshold to continue.</p>}
          <p className="helper">{helperText.nisabRegionNote}</p>
        </div>

        <div className="field">
          <label htmlFor="heldOneLunarYear">Have you held this wealth for one full lunar year?</label>
          <p className="helper">{helperText.heldOneLunarYear}</p>
          <select
            id="heldOneLunarYear"
            value={form.heldOneLunarYear === null ? '' : String(form.heldOneLunarYear)}
            aria-invalid={touched && hawlMissing}
            onChange={(e) => setForm({ ...form, heldOneLunarYear: e.target.value === '' ? null : e.target.value === 'true' })}
          >
            <option value="">Choose one…</option>
            <option value="true">Yes, a full lunar year or more</option>
            <option value="false">No, not yet</option>
          </select>
          {touched && hawlMissing && <p className="field-error">Answer this question to continue.</p>}
        </div>

        <div className="field">
          <label htmlFor="zakatDate">Zakat date (optional)</label>
          <p className="helper">{helperText.zakatDate}</p>
          <input
            id="zakatDate"
            type="date"
            min={DATE_MIN}
            max={DATE_MAX}
            aria-invalid={dateBad}
            value={form.zakatDate}
            onChange={(e) => setForm({ ...form, zakatDate: e.target.value })}
          />
          {dateBad && touched && <p className="field-error">Enter a real date between 1900 and 2200.</p>}
          <FieldError errors={errors} field="zakatDate" />
          <p className="helper">
            {form.zakatDate ? 'Gregorian' : 'Today, Gregorian'}: {toGregorianDisplay(form.zakatDate)} — Hijri:{' '}
            {toHijriDisplay(form.zakatDate) ?? 'not available in this browser'}
          </p>
        </div>
      </fieldset>
    </StepShell>
  )
}
