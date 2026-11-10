import { createContext, useContext, useEffect, useRef } from 'react'
import ProgressIndicator from './ProgressIndicator.jsx'

// Once someone has reached the review screen, CalculatorPage provides a
// function here so every step can jump straight back to the review instead
// of clicking Next through all the remaining steps. null = not reached yet.
export const ReviewShortcut = createContext(null)

// Wraps one step: heading (focused on mount for keyboard/screen-reader
// users), progress, the step's fields, and back/next controls.
export default function StepShell({ step, total, title, onBack, onNext, nextLabel = 'Next', children }) {
  const headingRef = useRef(null)
  const goToReview = useContext(ReviewShortcut)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div className="card">
      <ProgressIndicator step={step} total={total} label={title} />
      <h2 tabIndex={-1} ref={headingRef} style={{ marginTop: 'var(--space-4)' }}>
        {title}
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onNext()
        }}
      >
        {children}
        <div className="btn-row" style={{ marginTop: 'var(--space-5)' }}>
          {onBack ? (
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              Back
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="btn btn-primary">
            {nextLabel}
          </button>
        </div>
        {goToReview && (
          // Changes are already kept as they are typed, so this just jumps.
          <div className="btn-row" style={{ marginTop: 'var(--space-3)' }}>
            <button type="button" className="btn btn-secondary" onClick={goToReview}>
              Back to review
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
