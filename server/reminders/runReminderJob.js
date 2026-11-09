// Runs the reminder job once (B.7 steps 1 to 6). Called by
// POST /api/jobs/reminders, which the hourly GitHub Actions workflow hits.
// `db`, `auth` and `mailer` are passed in so tests use fakes.
import { decideReminders } from './decideReminders.js'
import { reminderText } from '../../src/content/reminderText.js'

// `dryRun`: only report what would happen at `now` (the "as-of" mode) —
// nothing is written and nothing is sent.
export async function runReminderJob({ now, db, auth, mailer, dryRun = false, appUrl }) {
  const users = await db.listReminderUsers()
  const { due, skipped } = decideReminders({ now, users })

  if (dryRun) {
    // The workflow's logs are public (the repo is public), so users are
    // shown only as "user 1", "user 2"... never by id or email.
    const label = new Map()
    const anon = (id) => {
      if (!label.has(id)) label.set(id, `user ${label.size + 1}`)
      return label.get(id)
    }
    return {
      dryRun: true,
      asOf: now.toISOString(),
      users: users.length,
      due: due.map((d) => ({ user: anon(d.userId), type: d.type, channel: d.channel, localDate: d.localDate })),
      skipped: skipped.length,
    }
  }

  const counts = { users: users.length, due: due.length, inApp: 0, emailSent: 0, alreadySent: 0, emailFailed: 0 }
  const emails = new Map() // userId -> email, looked up once per run

  for (const row of due) {
    // The unique key (user, type, channel, local date) makes a second
    // insert do nothing, so a second run in the same day sends nothing (NFR8).
    const inserted = await db.insertReminderSent(row)
    if (!inserted) {
      counts.alreadySent += 1
      continue
    }
    if (row.channel === 'inApp') {
      counts.inApp += 1
      continue
    }

    // Email: sent only because this run inserted the row.
    let sent = false
    try {
      if (!emails.has(row.userId)) emails.set(row.userId, await auth.getUserEmail(row.userId))
      const to = emails.get(row.userId)
      if (to) sent = (await mailer.send(reminderEmail(row.type, to, appUrl))).ok
    } catch (err) {
      console.error('reminder email failed:', err.message)
    }
    if (sent) {
      counts.emailSent += 1
    } else {
      // M6 unknown 3: give the day back so the next hourly run tries again.
      counts.emailFailed += 1
      await db.deleteReminderSent(row).catch((err) => console.error('could not undo reminder row:', err.message))
    }
  }
  return counts
}

// A.24. Plain text only, no financial figures (B.7).
export function reminderEmail(type, to, appUrl = 'https://charityflow.onrender.com') {
  const t = reminderText[type]
  return {
    to,
    subject: t.subject,
    text: `${t.body}\n\nOpen CharityFlow: ${appUrl}/#/calculator\n\nYou get this email because you turned on this reminder. Change or turn off reminders any time: ${appUrl}/#/reminders`,
  }
}
