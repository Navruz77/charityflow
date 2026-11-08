import { useSession } from '../hooks/useSession.jsx'

// Reminders (M6) and the giving planner (M7) need an account. Until those
// milestones land, these pages show the S3.1 rule: a guest who opens an
// account feature is told why and offered registration.
function AccountFeature({ title, why }) {
  const session = useSession()
  if (session.loading) return <p className="muted">Loading…</p>

  if (!session.signedIn) {
    return (
      <div className="card form-stack">
        <h2>{title}</h2>
        <p>{why} This needs a free account, so it can be kept safely for you.</p>
        <p className="muted">An account only asks for an email address and a password.</p>
        <div className="btn-row">
          <a className="btn btn-primary" href="#/register">
            Create an account
          </a>
          <a className="btn btn-secondary" href="#/signin">
            Sign in
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="card form-stack">
      <h2>{title}</h2>
      <p>This part of CharityFlow is coming soon.</p>
    </div>
  )
}

export function RemindersPage() {
  return <AccountFeature title="Reminders" why="Reminders arrive by email or in the app on your own local day." />
}

export function PlannerPage() {
  return <AccountFeature title="Giving planner" why="The planner keeps your sadaqah goals and gifts." />
}
