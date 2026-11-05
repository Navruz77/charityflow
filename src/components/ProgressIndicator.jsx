export default function ProgressIndicator({ step, total, label }) {
  const pct = Math.round((step / total) * 100)
  return (
    <div className="progress" role="group" aria-label="Progress">
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Step ${step} of ${total}: ${label}`}
      >
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="progress-label">
        Step {step} of {total} — {label}
      </p>
    </div>
  )
}
