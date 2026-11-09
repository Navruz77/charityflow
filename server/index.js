// CharityFlow server. Serves the built front end (dist/) and the /api
// routes. This is the only part of the app that ever holds secret keys.
import { createApp } from './app.js'
import { authClient } from './supabase/authClient.js'
import { dbClient } from './supabase/dbClient.js'
import { breachChecker } from './auth/breachCheck.js'
import { brevoMailer } from './reminders/brevo.js'

const app = createApp({ auth: authClient, db: dbClient, breach: breachChecker, mailer: brevoMailer })

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`CharityFlow server listening on port ${port}`)
})
