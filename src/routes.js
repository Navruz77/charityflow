// Single place that lists every hash route. Adding a milestone's screen
// means adding one line here — nothing else should hardcode a route path.
import HomePage from './pages/HomePage.jsx'
import CalculatorPage from './pages/CalculatorPage.jsx'
import StatusPage from './pages/StatusPage.jsx'

export const routes = [
  { path: '/', label: 'Home', component: HomePage },
  { path: '/calculator', label: 'Calculator', component: CalculatorPage },
  { path: '/status', label: 'Status', component: StatusPage },
]

export function findRoute(path) {
  return routes.find((r) => r.path === path) ?? routes[0]
}
