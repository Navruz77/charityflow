import { useHashRoute } from './hooks/useHashRoute.js'
import { findRoute } from './routes.js'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import { FirstVisitNote, OfflineBanner } from './components/Connection.jsx'

export default function App() {
  const [route] = useHashRoute()
  const { component: Page } = findRoute(route)

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
