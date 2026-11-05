import { useHashRoute } from './hooks/useHashRoute.js'
import { findRoute } from './routes.js'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'

export default function App() {
  const [route] = useHashRoute()
  const { component: Page } = findRoute(route)

  return (
    <>
      <Header route={route} />
      <main className="app-shell">
        <Page />
      </main>
      <Footer />
    </>
  )
}
