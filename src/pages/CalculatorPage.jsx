import { lazy, Suspense, useState } from 'react'
import { useZakatForm } from '../hooks/useZakatForm.js'
import { usePrices } from '../hooks/usePrices.js'
import { dollarsTextToCents } from '../lib/money.js'
import { getErrorMessage } from '../content/errorText.js'
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

export default function CalculatorPage() {
  const { form, setForm, resetForm, calculate } = useZakatForm()
  const { prices, error: priceError, loading: pricesLoading } = usePrices()
  const [customGoldPrice, setCustomGoldPrice] = useState('')
  const [customSilverPrice, setCustomSilverPrice] = useState('')
  const [stepIndex, setStepIndex] = useState(0)
  const [errors, setErrors] = useState([])
  const [result, setResult] = useState(null)
  const [pricesUsed, setPricesUsed] = useState(null)

  const goToStep = (i) => setStepIndex(i)
  const next = () => setStepIndex((i) => Math.min(i + 1, STEPS.length))
  const back = () => setStepIndex((i) => Math.max(i - 1, 0))

  const effectivePrices = () => {
    if (prices) return prices
    const gold = dollarsTextToCents(customGoldPrice)
    const silver = dollarsTextToCents(customSilverPrice)
    if (gold === null || silver === null || gold === 0 || silver === 0) return null
    return {
      goldUsdPerGram: gold / 100,
      silverUsdPerGram: silver / 100,
      fetchedAt: null,
      source: 'entered by you',
    }
  }

  const handleCalculate = () => {
    const pricesToUse = effectivePrices()
    if (!pricesToUse) {
      setErrors([{ field: 'prices', code: 'missingPrice' }])
      return
    }
    const r = calculate(pricesToUse)
    if (!r.ok) {
      setErrors(r.errors)
      return
    }
    setErrors([])
    setPricesUsed(pricesToUse)
    setResult(r)
  }

  const handleStartOver = () => {
    resetForm()
    setResult(null)
    setErrors([])
    setStepIndex(0)
  }

  if (result) {
    return (
      <Suspense fallback={<div className="card">Loading results…</div>}>
        <ResultsPage result={result} pricesUsed={pricesUsed} onStartOver={handleStartOver} />
      </Suspense>
    )
  }

  if (stepIndex === STEPS.length) {
    return (
      <>
        {pricesLoading && <p className="muted">Loading today's gold and silver prices…</p>}
        {priceError && !prices && (
          <div className="card">
            <p className="field-error">Could not load today's prices: {priceError}</p>
            <p className="helper">You can still continue by typing today's prices yourself.</p>
            <div className="field">
              <label htmlFor="customGold">Gold price per gram ($)</label>
              <input id="customGold" type="text" inputMode="decimal" value={customGoldPrice} onChange={(e) => setCustomGoldPrice(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="customSilver">Silver price per gram ($)</label>
              <input id="customSilver" type="text" inputMode="decimal" value={customSilverPrice} onChange={(e) => setCustomSilverPrice(e.target.value)} />
            </div>
          </div>
        )}
        <StepSummary
          step={TOTAL_STEPS}
          total={TOTAL_STEPS}
          form={form}
          goToStep={goToStep}
          onCalculate={handleCalculate}
          calcError={(() => {
            const e = errors.find((err) => err.field === 'prices' || err.field === 'prices.goldUsdPerGram' || err.field === 'prices.silverUsdPerGram')
            return e ? getErrorMessage('Prices', e.code) : undefined
          })()}
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
