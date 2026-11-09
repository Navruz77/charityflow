// Single place that lists every hash route. Adding a milestone's screen
// means adding one line here — nothing else should hardcode a route path.
import HomePage from './pages/HomePage.jsx'
import CalculatorPage from './pages/CalculatorPage.jsx'
import StatusPage from './pages/StatusPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import SignInPage from './pages/SignInPage.jsx'
import ResetPage from './pages/ResetPage.jsx'
import ConfirmPage from './pages/ConfirmPage.jsx'
import AccountPage from './pages/AccountPage.jsx'
import SavedPage from './pages/SavedPage.jsx'
import RemindersPage from './pages/RemindersPage.jsx'
import { PlannerPage } from './pages/AccountFeaturePages.jsx'

export const routes = [
  { path: '/', label: 'Home', component: HomePage },
  { path: '/calculator', label: 'Calculator', component: CalculatorPage },
  { path: '/saved', label: 'Saved', component: SavedPage },
  { path: '/status', label: 'Status', component: StatusPage },
  { path: '/register', label: 'Create account', component: RegisterPage },
  { path: '/signin', label: 'Sign in', component: SignInPage },
  { path: '/reset', label: 'Reset password', component: ResetPage },
  { path: '/confirm', label: 'Confirm', component: ConfirmPage },
  { path: '/account', label: 'Account', component: AccountPage },
  { path: '/reminders', label: 'Reminders', component: RemindersPage },
  { path: '/planner', label: 'Giving planner', component: PlannerPage },
]

export function findRoute(path) {
  return routes.find((r) => r.path === path) ?? routes[0]
}
