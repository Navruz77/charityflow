import { useEffect } from 'react'
import { useHashRoute } from './hooks/useHashRoute.js'
import { findRoute } from './routes.js'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import { FirstVisitNote, OfflineBanner } from './components/Connection.jsx'
import { requestPrices } from './lib/prices.js'

export default function App() {
  const [route] = useHashRoute()
  const { component: Page } = findRoute(route)

  // Store today's prices on every online visit, whatever page it opens on,
  // so the calculator works offline later (S5.1). Failures are ignored
  // here; the calculator shows its own message.
  useEffect(() => {
    const get = () => requestPrices().catch(() => {})
    get()
    window.addEventListener('online', get)
    return () => window.removeEventListener('online', get)
  }, [])

  return (
    <>
      <Header route={route} />
      <OfflineBanner />
      <main className="app-shell">
        <FirstVisitNote />
        <Page />
      </main>
      <Footer />
    </>
  )
}
