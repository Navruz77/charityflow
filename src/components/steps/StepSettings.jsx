import { useState } from 'react'
import StepShell from '../StepShell.jsx'
import { helperText } from '../../content/helperText.js'
import { toGregorianDisplay, toHijriDisplay } from '../../lib/hijri.js'

// Nisab and the one-lunar-year question have no default — Zakat cannot be
// calculated without an explicit answer to both (PROJECT.md S1.9).
export default function StepSettings({ step, total, form, setForm, onBack, onNext }) {
  const [touched, setTouched] = useState(false)
  const nisabMissing = form.nisab !== 'gold' && form.nisab !== 'silver'
  const hawlMissing = typeof form.heldOneLunarYear !== 'boolean'

  const handleNext = () => {
    if (nisabMissing || hawlMissing) {
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
            value={form.zakatDate}
            onChange={(e) => setForm({ ...form, zakatDate: e.target.value })}
          />
          <p className="helper">
            {form.zakatDate ? 'Gregorian' : 'Today, Gregorian'}: {toGregorianDisplay(form.zakatDate)} — Hijri:{' '}
            {toHijriDisplay(form.zakatDate) ?? 'not available in this browser'}
          </p>
        </div>
      </fieldset>
    </StepShell>
  )
}
