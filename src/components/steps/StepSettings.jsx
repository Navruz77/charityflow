import StepShell from '../StepShell.jsx'
import { helperText } from '../../content/helperText.js'

export default function StepSettings({ step, total, form, setForm, onBack, onNext }) {
  return (
    <StepShell step={step} total={total} title="Settings" onBack={onBack} onNext={onNext} nextLabel="Review">
      <fieldset>
        <legend>Nisab and timing</legend>
        <div className="field">
          <label htmlFor="nisab">Nisab threshold</label>
          <p className="helper">{helperText.nisab}</p>
          <select id="nisab" value={form.nisab} onChange={(e) => setForm({ ...form, nisab: e.target.value })}>
            <option value="silver">Silver (612.36g)</option>
            <option value="gold">Gold (87.48g)</option>
          </select>
        </div>
        <div className="field checkbox-field">
          <input
            id="heldOneLunarYear"
            type="checkbox"
            checked={form.heldOneLunarYear}
            onChange={(e) => setForm({ ...form, heldOneLunarYear: e.target.checked })}
          />
          <label htmlFor="heldOneLunarYear">I have held this wealth for one full lunar year</label>
        </div>
        <p className="helper">{helperText.heldOneLunarYear}</p>
        <div className="field">
          <label htmlFor="zakatDate">Zakat date (optional)</label>
          <p className="helper">{helperText.zakatDate}</p>
          <input
            id="zakatDate"
            type="date"
            value={form.zakatDate}
            onChange={(e) => setForm({ ...form, zakatDate: e.target.value })}
          />
        </div>
      </fieldset>
    </StepShell>
  )
}
