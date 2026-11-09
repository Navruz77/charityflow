import { lazy, Suspense, useEffect, useState } from 'react'
import { isValidFormState, useZakatForm } from '../hooks/useZakatForm.js'
import { clearDraft, loadDraft, saveDraft } from '../lib/formDraft.js'
import { usePrices } from '../hooks/usePrices.js'
import { NO_CONNECTION_NO_PRICES } from '../lib/prices.js'
import StepCashSavings from '../components/steps/StepCashSavings.jsx'
import StepGoldSilver from '../components/steps/StepGoldSilver.jsx'
import StepGems from '../components/steps/StepGems.jsx'
import StepStocksFunds from '../components/steps/StepStocksFunds.jsx'
import StepCrypto from '../components/steps/StepCrypto.jsx'
import StepRealEstateForSale from '../components/steps/StepRealEstateForSale.jsx'
import StepRentals from '../components/steps/StepRentals.jsx'
import StepBusinesses from '../components/steps/StepBusinesses.jsx'
import StepRetirement from '../components/steps/StepRetirement.jsx'
import StepDebts from '../components/steps/StepDebts.jsx'
import StepSettings from '../components/steps/StepSettings.jsx'
import StepSummary from '../components/steps/StepSummary.jsx'

const ResultsPage = lazy(() => import('./ResultsPage.jsx'))

const STEPS = [
  StepCashSavings,
  StepGoldSilver,
  StepGems,
  StepStocksFunds,
  StepCrypto,
  StepRealEstateForSale,
  StepRentals,
  StepBusinesses,
  StepRetirement,
  StepDebts,
  StepSettings,
]
const TOTAL_STEPS = STEPS.length + 1 // + the summary step

// Reads the draft once per page load (M5: survive an autoUpdate reload).
function useRestoredDraft() {
  const [draft] = useState(() => loadDraft(isValidFormState, STEPS.length))
  return draft
}

export default function CalculatorPage() {
  const draft = useRestoredDraft()
  const { form, setForm, resetForm, calculate } = useZakatForm(draft?.form)
  const { prices, error: priceError, loading: pricesLoading, stale } = usePrices()
  const [stepIndex, setStepIndex] = useState(draft?.stepIndex ?? 0)
  const [errors, setErrors] = useState([])
  // A result that was on screen before a reload is worked out again from
  // the same entries and the same prices, so it comes back unchanged.
  const [shown, setShown] = useState(() => (draft?.showResult ? rerun(calculate, draft.pricesUsed) : null))

  // Keep the draft up to date after every change.
  useEffect(() => {
    saveDraft({ form, stepIndex, pricesUsed: shown?.pricesUsed ?? null, showResult: shown !== null })
  }, [form, stepIndex, shown])

  const goToStep = (i) => setStepIndex(i)
  const next = () => setStepIndex((i) => Math.min(i + 1, STEPS.length))
  const back = () => setStepIndex((i) => Math.max(i - 1, 0))

  const handleCalculate = () => {
    if (!prices) return // the summary screen hides the button until prices exist
    const r = calculate(prices)
    if (!r.ok) {
      setErrors(r.errors)
      return
    }
    setErrors([])
    const { inputs, ...result } = r
    setShown({ result, inputs, pricesUsed: prices })
  }

  const handleStartOver = () => {
    resetForm()
    clearDraft()
    setShown(null)
    setErrors([])
    setStepIndex(0)
  }

  // Back to the entries (e.g. to try the other nisab, S1.9) without losing them.
  const handleEdit = () => {
    setShown(null)
    setStepIndex(STEPS.length)
  }

  const result = shown?.result
  const pricesUsed = shown?.pricesUsed
  if (result) {
    return (
      <Suspense fallback={<div className="card">Loading results…</div>}>
        <ResultsPage
          result={result}
          inputs={shown.inputs}
          pricesUsed={pricesUsed}
          onStartOver={handleStartOver}
          onEdit={handleEdit}
        />
      </Suspense>
    )
  }

  if (stepIndex === STEPS.length) {
    return (
      <>
        {pricesLoading && <p className="muted">Loading today's gold and silver prices…</p>}
        {!pricesLoading && !prices && (
          // S12.4: no price has ever been retrieved — no result is possible.
          <div className="card">
            <p className="field-error">
              CharityFlow cannot work out the nisab or any weight-based value right now:{' '}
              {priceError ?? 'no price is available.'}
            </p>
            {priceError !== NO_CONNECTION_NO_PRICES && <p className="helper">Please try again in a few minutes.</p>}
            <p className="helper">Your entries are kept on this screen.</p>
          </div>
        )}
        {!pricesLoading && prices && stale && (
          // S12.3: prices are over 24 hours old — warn, but still allow calculating.
          <div className="card">
            <p className="field-error">
              Today's gold and silver prices could not be refreshed, so this result will use
              prices from {new Date(prices.fetchedAt).toLocaleString()}.
            </p>
          </div>
        )}
        <StepSummary
          step={TOTAL_STEPS}
          total={TOTAL_STEPS}
          form={form}
          goToStep={goToStep}
          onCalculate={prices ? handleCalculate : undefined}
          calcError={errors.find((e) => e.field === 'prices')?.message}
        />
      </>
    )
  }

  const StepComponent = STEPS[stepIndex]
  return (
    <StepComponent
      step={stepIndex + 1}
      total={TOTAL_STEPS}
      form={form}
      setForm={setForm}
      errors={errors}
      onBack={stepIndex > 0 ? back : undefined}
      onNext={next}
    />
  )
}

// Runs the engine again for a restored result; null if it no longer works.
function rerun(calculate, pricesUsed) {
  const r = calculate(pricesUsed)
  if (!r.ok) return null
  const { inputs, ...result } = r
  return { result, inputs, pricesUsed }
}
