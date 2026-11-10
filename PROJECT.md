# CharityFlow: project briefing for Claude Code

Read this at the start of every session. It is the short version of the MVP Project Plan
(CISC 3171, Fall 2026, team CharityFlow, instructor Alec Malstrom). Where this file and the
plan disagree, the plan wins; tell the user about the conflict instead of guessing.

## What we are building
A free website that works out a Muslim's annual Zakat (Hanafi rules), explains every line,
keeps live gold/silver prices for the nisab, works offline, and lets signed-in users save
calculations, get reminders and plan sadaqah (voluntary charity) giving.
Budget is $0. No card on any service. Team of 4 beginners, so keep the code simple and commented.

## Dates
- Build freeze: **Mon Nov 9, 18:00**. Demo Nov 10 to 12. Final plan due **Nov 10** (same day as the demo).
- Build order matters more than anything: the planner (M7) and reminders (M6) go last.
- Always keep: engine tests, the disclaimer (S2.2), price age on every result (S12.2),
  the nisab choice (S1.9), access-rule tests (NFR5).

## Stack (changed after professor feedback; do not swap without asking)
The professor required a real back end: no GitHub Pages, and the browser must never talk
to the database. New design:
- **Front end:** React + Vite, plain JavaScript, Vitest, hash routes (`#/calculator`).
- **Back end:** one Node + Express server in `server/` that serves the built site (`dist/`)
  and an `/api`. It is the only thing that holds keys or talks to Supabase or the price APIs.
- **Hosting:** Render free web service, auto-deploys from `main` (build `npm ci && npm run
  build`, start `node server/index.js`). Sleeps after 15 min idle, about 1 minute to wake, so
  the app shows a "waking up" message. All secrets are Render environment variables.
  The repo stays public; it contains no credentials.
- **Database and sign-in:** Supabase (Postgres + Auth), called only from the server with the
  secret key. Row-level security stays ON as a second layer.
- **Email:** Brevo. Supabase sends sign-up/reset emails through Brevo SMTP; the server sends
  reminder emails through Brevo's web API.
- **Prices:** `GET /api/prices` fetches MetalCharts when a calculation needs a price and caches
  it 8 hours in the `price_cache` table (API Ninjas fallback, then last stored price).
  Never call the live API in tests; use a fake provider.
- **Scheduled work:** GitHub Actions only (a) runs `npm test` on pull requests, (b) calls
  `POST /api/jobs/reminders` hourly with `JOB_TOKEN`, (c) runs `price-health.yml` twice a day
  (calls `GET /api/prices`, fails if the last good fetch is over 24 hours old).
- **Offline:** `vite-plugin-pwa`; the service worker serves the last `/api/prices` response; the
  app also copies the last prices into `localStorage`. Hijri dates: `Intl.DateTimeFormat`
  `islamic-umalqura`. Guest saves: `localStorage`.
- `.github/workflows/deploy.yml` (GitHub Pages deploy) must be replaced by a test-only
  workflow once Render is connected.

## Hard rules
1. Money is integer cents everywhere. Prices are dollars per gram, up to 4 decimals.
2. The engine (`src/engine/`) is pure: no network, no screens, no storage. Never change its
   math without being asked, and run `npm test` after any change.
3. The browser never calls the price API or the database. Only `server/` does, using keys from
   environment variables. The browser talks only to our own `/api`.
4. Guests' entries never leave the device (NFR6). No third-party scripts, no CDNs.
5. Every server route checks the signed-in user and touches only that user's rows. RLS is a
   second layer (NFR5). Sessions are an HttpOnly cookie; no token reaches page scripts.
6. No secrets in code or in the browser bundle. Server keys live in Render env vars; only
   `JOB_TOKEN` is also a GitHub Actions secret. The `.env` file is gitignored.
7. No `dangerouslySetInnerHTML`, `innerHTML` or `eval`. Render user text as plain text.
8. Mobile first (360 px wide, no horizontal scroll), accessible (labels, focus, keyboard, AA contrast).
9. Wrap every `localStorage` read and write in try/catch and validate what is loaded.
10. Run `npm test` and `npm run build` before saying a task is done.

## Accounts that exist (all free, set up by the team)
GitHub repo `Navruz77/charityflow` (public, 4 collaborators). Supabase project
`ocqcehendxpwbbzgvpie` (Data API on, auto-expose new tables OFF, auto-RLS ON). Brevo (SMTP key
in Supabase, sender verified, API key for reminders). MetalCharts free key (200 requests a
month, credit link "Metal prices by MetalCharts" required next to public prices). API Ninjas
free key (backup; last daily settlement; `name=gold` / `name=silver`, `unit=g`).
To create: the Render web service. Render env vars to set: `SUPABASE_URL`,
`SUPABASE_SECRET_KEY`, `METALCHARTS_API_KEY`, `API_NINJAS_KEY`, `BREVO_API_KEY`, `JOB_TOKEN`,
`SESSION_SECRET`, `BREVO_SENDER_EMAIL`. GitHub secret: `JOB_TOKEN` (plus the app URL).

## Milestones (build order)

**M0 Foundations: mostly done.** Repo, accounts, keys, Express server skeleton, Pages workflow
replaced, and Render connection all done. Deferred by the team to later: Outlook/school-email
tests, every teammate merging one PR. Neither blocks M2 or M3.

**M1 Engine: DONE.** The 20-case spreadsheet has been confirmed by Mufti Ahmad with no
corrections needed (see Status below).

**M2 Guest calculator screens.** Stories S1.1 to S1.12, S2.1 to S2.3, S3.1. One screen per
group (cash and metals; investments and crypto; property and business; retirement and debts;
nisab choice; Zakat date; result). Entries kept when going back. "Why this counts" per step.
Result lists each category, debts subtracted, net wealth, nisab, amount due, and explains every
line. Nisab step: gold or silver, no result until chosen, note for US/Canada/EU, recalculates
without re-entry. Date step shows Gregorian and Hijri and asks the lunar-year question.
Disclaimer on every result. Definitions one tap away. Guests give no personal information.
Done when: a stranger finishes on a phone and a laptop, every category above $0 is explained,
the disclaimer is on every result, all 20 cases match through the screens, no horizontal scroll
at 360 px, and the network panel shows no request carrying an entered value.

**M3 Live prices: DONE** — live on Render, verified against real MetalCharts data and a manual
browser walkthrough (see Status). Stories S12.1 to S12.4. `GET /api/prices`: use the `price_cache` row if
under 8 hours old; else call MetalCharts (one request returns both metals), convert to USD per
gram (31.1034768 g per troy oz if per ounce), reject missing/non-numeric/zero/negative values
and anything outside gold 20 to 1,000 or silver 0.2 to 100 USD/g, store with `fetchedAt`;
on failure try API Ninjas, then return the last stored prices and record the failed attempt.
App: nisab from prices; retrieval time on every result; warning over 24 hours but still
calculates; no result and a clear message if no price was ever retrieved; keep last prices in
`localStorage`. `#/status` page: last success, last attempt, source, credit link.
`price-health.yml` runs twice a day and fails when stale. First task: one real request to
confirm field names and units.
Done when: cache test (two calls within 8 hours, one provider request), both failure drills,
and the 25-hour test behave as described.

**M4 Accounts: DONE** — live, access test passed, phone walkthrough passed (see Status). Stories S3.2, S3.3, S3.4, S3.6. Routes under `/api/auth` call Supabase Auth from
the server; HttpOnly session cookie. Email + password (min 8), confirmation, resend. Same message
for wrong email and wrong password. Reset link sets a new password and signs out other devices.
`DELETE /api/account` (explicit confirmation) removes the sign-in record with the secret key and
every row. Create the tables in B.1 with RLS and `on delete cascade`. Store the browser time zone
in `profiles` on account creation. `admins` + `admin_read_user_data` that logs each read. Guests
opening account features are offered registration.
Done when: a two-user test cannot read, change or delete the other user's data through any
`/api` route or through the database rules alone; reset and delete flows pass; one admin read
writes exactly one log row; the network panel shows only requests to our own address.

**M5 Saving and offline: DONE** — live, iPhone airplane-mode test passed (see Status). Stories S4.1, S4.2, S3.5, S5.1 to S5.3. Guest: "Save on this device"
to `localStorage`. Signed in: "Save to my account" posts to the server (`/api/calculations`);
offline shows "needs a connection" and keeps the calculation on screen. After sign-in, offer to
add guest saves (only on yes). `vite-plugin-pwa` precaches the app; prices network-first with
last-response fallback. Offline banner. First-visit note (open online once; on iPhone add to
Home Screen). Keep the in-progress form in `sessionStorage` and restore it after any reload
(autoUpdate may reload the page). Calculation under 1 second.

**M6 Reminders: BUILT** — in-app path verified live locally; email + hourly workflow need the Brevo/JOB_TOKEN settings (see Status). Stories S6.1, S6.3 to S6.5. Zakat date (Gregorian + Hijri month/day), four
reminder types (zakatMonth, ramadan, friday, dhulHijjah), all off by default, in-app and/or
email each. Hourly workflow calls `POST /api/jobs/reminders` with `JOB_TOKEN`; the server decides
each user's local date and Hijri date from the stored time zone, skips before 09:00 local,
inserts a `reminders_sent` row (unique key prevents duplicates), and sends email through Brevo
only if the insert happened. The reminder code accepts a pretend `as-of` date and returns who
would be reminded without sending. Refresh the stored time zone whenever reminder settings are
saved.

**M7 Sadaqah planner: BUILT** — tests, live access test and headless-Chrome run pass; needs deploy + a teammate's phone walkthrough (see Status). Stories S8.1 to S8.3. Goals (monthly or yearly, name, amount), gifts
(amount, date, optional recipient, note, goal), progress and streaks. Pure functions in
`src/planner/` with Vitest tests. Periods are calendar months/years in the user's time zone. A
streak counts only periods from the goal's creation date. Removing a goal keeps its gifts with a
label and stops counting them.

There is no M8 milestone (the professor removed it). Before freeze, still run: story
walkthrough, two-user access test, README that works from a clean checkout.

## Contracts

### Price response (B.2): returned by GET /api/prices, stored in `price_cache`
```json
{ "schemaVersion": 1, "goldUsdPerGram": 134.34, "silverUsdPerGram": 1.96,
  "fetchedAt": "2026-10-29T06:00:12Z", "source": "metalcharts",
  "lastAttemptAt": "2026-10-29T06:00:12Z", "lastAttemptOk": true, "lastAttemptNote": null }
```
`source` is `metalcharts` or `api-ninjas`. `fetchedAt` changes only when new prices arrive.
Stale when now minus `fetchedAt` is over 24 hours. Prices must be numbers above 0.
`public/prices.json` was only a placeholder; remove it once `/api/prices` exists.

### localStorage (B.3)
Keys: `cf.v1.saved` (newest first), `cf.v1.prices`, `cf.v1.firstVisitNoteDismissed`.
A saved calculation: `id`, `savedAt`, `zakatDate {gregorian, hijri}`, `inputs`, `nisabChoice`,
`pricesUsed {goldUsdPerGram, silverUsdPerGram, fetchedAt}`, `result`. Nothing else is stored.

### Engine (B.4): `calculateZakat(inputs, prices)`
Inputs: `cashCents`, `savingsCents`; `gold` and `silver` as `{grams, valueCents}` (enter one;
if only grams, value = grams x price); `gems [{valueCents, purpose personal|resale}]`;
`securities [{valueCents, purpose trade|longTerm, zakatableSharePct (default 30), countInFull}]`;
`crypto [{valueCents, purpose}]`; `realEstateForSale [{valueCents}]`;
`rentals [{rentCollectedUnspentCents, expensesPaidCents}]`;
`businesses [{ownershipPct (default 100), cashCents, inventoryCents, receivablesCents,
liabilitiesCents}]`; `retirement [{vestedBalanceCents, method annual|whenAccessible,
zakatableSharePct (default 100), penaltyTaxCents (default 0)}]`;
`debts {dueNowCents, installments12mCents}`; `nisab gold|silver` (no result until set);
`heldOneLunarYear` boolean (no result until set); `zakatDate` YYYY-MM-DD (stored, does not
change the amount). Prices: `{goldUsdPerGram, silverUsdPerGram, fetchedAt}`.
Result: `ok`, `lines [{category, valueCents, treatment full|reduced|excluded, reasonKey}]`,
`totalZakatableCents`, `netCents` (never below 0), `debtsSubtracted {dueNowCents,
installments12mCents}`, `nisab {choice, grams, pricePerGram, valueCents}`, `status
due|belowNisab|notYetDue`, `zakatDueCents`, `pricesUsed`, `errors [{field, code}]` with code
`negative|notANumber|missingPrice`.
Rules: nisab 87.48 g gold or 612.36 g silver; rate 2.5%; wealth exactly at nisab is due; round
each computed value to the cent (halves up) and Zakat once at the end; blank means 0;
negative or non-numeric is rejected naming the field while keeping other entries.
Test-case format (B.6) example, must pass:
cash 300000 cents + gold 51 g (valueCents null), silver nisab, held a year, prices
134.34 / 1.96 -> net 985134, nisab value 120023, zakat due 24628, status due. With gold nisab
the same wealth is below nisab and Zakat is $0.00.

### Database (B.7, B.8)
Tables: `profiles` (user_id pk, time_zone, zakat_date, zakat_hijri_month, zakat_hijri_day,
created_at); `calculations` (id, user_id, saved_at, zakat_date, nisab_choice, inputs, prices_used,
result); `reminder_prefs` (user_id, type, enabled, in_app, email; pk user_id+type);
`reminders_sent` (user_id, type, channel inApp|email, local_date, created_at, read_at; pk on
the first four); `goals` (id, user_id, name, amount_cents > 0, period monthly|yearly,
created_at); `gifts` (id, user_id, amount_cents > 0, given_on, recipient, note, goal_id set null
on goal delete, goal_label, created_at); `admins` (user_id); `admin_access_log` (id, admin_id,
subject_user_id, accessed_at, action). Every `user_id` cascades on user delete.
Access: users touch only their own rows in profiles, calculations, reminder_prefs, goals, gifts.
On `reminders_sent` users read and mark read their own; only the server inserts.
`admins`, `admin_access_log` and `price_cache` are never reachable by a signed-in user; only the
server touches them. The server enforces the same rules in code on every route. Admins read user data only
through `admin_read_user_data(subject)`, which logs the read.

### Server routes (B.7)
`GET /api/prices` (anyone); `POST /api/auth/register|login|logout|reset` (anyone);
`GET|POST|DELETE /api/calculations`, `GET|PUT /api/profile` and `/api/reminder-prefs`,
`GET|POST|PUT|DELETE /api/goals` and `/api/gifts`, `GET /api/reminders`,
`POST /api/reminders/read`, `DELETE /api/account` (signed-in user); `GET /api/admin/users/:id`
(admin, logged); `POST /api/jobs/reminders` (hourly workflow with `JOB_TOKEN`).

### Brevo reminder request (B.7)
```json
{ "sender": {"name": "CharityFlow", "email": "<verified sender>"},
  "to": [{"email": "<user email>"}], "subject": "Ramadan reminder",
  "textContent": "It is Ramadan. A small gift today counts." }
```
Key goes in the `api-key` header, from a Render env var. No financial figures in reminder emails.

## Story list (37 built in the MVP)
S1.1 to S1.12, S2.1 to S2.3, S3.1 to S3.6, S4.1, S4.2, S5.1 to S5.3, S6.1, S6.3 to S6.5,
S8.1 to S8.3, S12.1 to S12.4. Not built (Final Release): S4.3, S6.2, S6.6, S8.4, S7.x, S9.x,
S10.x, S11.x (not part of this plan; do not build or mention them).

## Status (updated after each step; newest first)

**Regional nisab note reworded by the user (2026-11-09).** `helperText.nisabRegionNote` now uses
the user's own wording ("…using the Gold Standard… higher zakat threshold and can be more
beneficial to deserving zakat recipients…"). Open question flagged: a higher threshold means
fewer people owe Zakat, so the "more beneficial to recipients" reason may need Mufti Ahmad's review.

**Calculator: gold regional note + "Back to review" (2026-11-09).** At the user's request,
`helperText.nisabRegionNote` (Settings step) now says scholars recommend the **gold** nisab for
the US, Canada and the EU (was silver), with the reason changed to fit gold: gold has kept its
value over the centuries far better than silver, so it is closer to the wealth the nisab was
meant to mark. The nisab helper above the dropdown no longer calls gold "the more cautious,
traditional choice" (both are traditional, and "cautious" is the usual argument for silver); it
now says gold better reflects the value the nisab was meant to represent. Not yet checked by
Mufti Ahmad. Once the review screen has been reached, steps 1-10 show
a "Back to review" button (`ReviewShortcut` context in `StepShell.jsx`, provided by
`CalculatorPage`), so an Edit no longer means clicking Next through every remaining step.
Settings keeps its own "Review" button and checks. The flag is saved in the draft
(`reviewReached`), so it survives a reload, and Start over clears it. Tests 227/227, build
passes, headless Chrome at 360px: all checks pass.

**Input validation pass (2026-11-09).** User asked for sanitization and validation on every form.
One set of rules in `src/lib/inputRules.js`, used by the screens and the server: money boxes
accept only digits, commas and one point with 2 decimals (13 whole-dollar digits max), grams only
digits and one point (4 decimals), percentages only 0 to 100 (a keystroke past 100 is refused),
dates real and 1900 to 2200 (gifts 2000 to today), list items max 25, text lengths (name 100,
recipient 100, note 500, email 254). Filtering happens as people type or paste
(`MoneyField`, new `NumberField`), so letters, "$", "-", "e" and non-ASCII digits never get in.
Bugs found and fixed: `dollarsTextToCents` used floating point and turned
"99999999999999999999" into 1e22 (now whole-number math, capped, exact); invalid entries made
"Calculate my Zakat" silently do nothing (the review screen now lists each problem with a Fix
button); grams and percentage fields showed no error; error text exposed field paths like
"securities[0].valueCents"; grams were passed to the engine as raw text (now parsed and
checked first); no list cap in the browser (the 26th item could not be saved). Server limits now
import the same constants. Tests 226/226 (new: input rules, and a hostile-input sweep sending
wrong types, Infinity, nested objects, SQL- and path-like strings and bad ids to every write
route: all 400, nothing written, plus a control case that is accepted). Headless Chrome 13/13
with real keystrokes and paste.

**Update banner instead of silent autoUpdate (2026-11-09).** After the M7 deploy the user saw
the old "coming soon" planner: the service worker showed the cached version first and the new
one only on a later load. With the user's agreement (a change from the plan's `autoUpdate`),
`vite.config.js` now uses `registerType: 'prompt'` and `src/components/UpdateBanner.jsx`
registers the service worker, checks for a new version when the app comes back on screen (iPhone
Home Screen apps resume rather than reload), on reconnect and hourly, and shows "A new version of
CharityFlow is ready — Reload / Not now". Nothing reloads until the person taps Reload, so no
typing is lost anywhere; ignored, the update starts once every tab is closed. Headless Chrome
10/10 (banner appears, no self-reload, Not now, still waiting after a plain reload, Reload
switches version, calculator draft survives). Devices on the previous version get this one after
closing the app or all tabs once.

**Step 6 — M7 Sadaqah planner, built (2026-11-09).** No SQL needed (tables from M4). Rules in
`src/planner/progress.js` (pure, Vitest): calendar month/year periods; "today" and a goal's start
day from the user's stored time zone; progress = given this period, remaining, met (exactly at
the amount is met); streak = consecutive *completed* periods before the current one that reached
the amount, never before the goal's creation period (unknown 1), recalculated from the gifts as
they are now; a gift with no goal or a removed goal counts toward none. Server
`server/routes/planner.js` + `server/planner/cleanPlanner.js`: `GET|POST /api/goals`,
`PUT|DELETE /api/goals/:id`, same for `/api/gifts`; own rows only (other users' ids answer 404),
gift goal must be the user's own, allowlist validation (name ≤100, recipient ≤100, note ≤500,
control characters stripped, amount 1¢ to $10B integer cents, gift date real and not in the
future), caps 50 goals / 5,000 gifts, per-user rate limit. Removing a goal first copies its name
into its gifts' `goal_label`, then the database sets `goal_id` null. Choosing a new goal for such
a gift clears the label. Screen `#/planner` (signed in; header link): goal cards with a progress
bar, given/remaining/met and streak, change/remove with confirmation; log a gift; gift list with
edit/delete. Tests 209/209 (15 planner rules covering every plan case, 11 routes incl. two users).
`npm run test:access` extended to goals and gifts through the routes: all pass against real
Supabase (incl. removed goal keeps the gift, labelled, goal_id null). Headless Chrome 12/12
(one cent short / exactly met, 3-month streak, editing a past gift drops it to 1, remove goal
keeps labelled gifts, text shown as plain text, no horizontal scroll at 360 px). **Still needed:**
deploy, then a teammate's phone walkthrough of S8.1 to S8.3 with a test account.

**CI hardening (2026-11-08).** Repo stays public (checked: no secret in any of the 27 commits,
`.env` never committed). Workflows: least-privilege `permissions` (`test.yml` contents: read;
`price-health.yml` and `reminders.yml` none), `timeout-minutes` on every job, actions pinned to
exact commits (`checkout` and `setup-node` v4.4.0) with `persist-credentials: false`, and
`.github/dependabot.yml` proposes weekly updates for the pins. For the user in GitHub settings:
secret scanning + push protection, branch protection on `main`. Possible Final Release change
(not done, it would change the approved stack): Supabase `pg_cron` + `pg_net` calling
`POST /api/jobs/reminders` instead of the GitHub schedule.

**Step 5 — M6 reminders, built (2026-11-08).** No SQL needed (tables from M4). Pure logic in
`server/reminders/decideReminders.js` (local date/hour/weekday and Hijri month/day per user time
zone via `src/lib/hijriParts.js`, the same Intl Umm al-Qura method as the screens; nothing before
09:00 local; first run after 9 sends). `runReminderJob.js` inserts each `reminders_sent` row with
ignore-duplicates and sends email only when the row was new; if Brevo fails the row is deleted so
the next hourly run retries (unknown 3). `POST /api/jobs/reminders` needs `Authorization: Bearer
<JOB_TOKEN>` (≥32 chars, constant-time compare, per-IP limit); `{asOf}` = dry run that writes and
sends nothing and shows users only as "user 1, user 2" (Actions logs are public). Routes:
`GET|PUT /api/reminder-prefs` (exactly the four types, booleans, on needs a channel, saves the
browser time zone — unknown 4), `GET /api/reminders` (last 30 days in-app), `POST
/api/reminders/read`, `PUT /api/profile {zakatDate}` (server computes the Hijri month/day; null
removes). Email via `server/reminders/brevo.js` (env `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`), text
from `src/content/reminderText.js`, no figures, link to `#/reminders`. Screens: `#/reminders`
(in-app list, Zakat date set/change/remove with Hijri month, four types with in-app/email),
header Reminders link with unread badge, calculator pre-fills the account Zakat date, "use this
as your yearly Zakat date?" after Save to my account. Workflow `.github/workflows/reminders.yml`
hourly at :07 + manual dry run (`as_of`), token and as-of passed via env/jq. Tests 183/183 (all
plan dry-run cases, twice-in-an-hour/day, two time zones, Brevo-failure retry, off stops next
occasion, routes, token). Live local run against real Supabase: 13/13 (dry run writes nothing,
real run 1 in-app row on the user's local date, second run 0, read). Headless Chrome 12/12.
**Needs the user before it is live:** Render env vars `JOB_TOKEN` (value in local `.env`),
`BREVO_API_KEY`, `BREVO_SENDER_EMAIL`; GitHub secret `JOB_TOKEN`. Then: a real email reminder,
and the hourly workflow running unaided twice.

**Step 4 closed — M5 DONE (2026-11-08).** First live iPhone airplane-mode test failed: the
offline calculator said it could not work out the nisab, with the service worker's raw
"no-response" error. Cause: prices were fetched only when the calculator opened, so a visit that
stayed on Home stored none (and an iPhone Home Screen app may keep storage separate from Safari).
Fix `56ff0b9`: `src/lib/prices.js` fetches and stores prices when the app opens on any page and on
reconnect, shares one request with the calculator, and shows a plain offline message instead of
browser/service-worker error text; the first-visit note tells iPhone users to open the Home
Screen app once while online. 160/160 tests; headless Chrome reproduces the Home-only case and
passes. Re-test on https://charityflow.onrender.com from a fresh Home Screen icon (opened once
online, then airplane mode): calculation, device save, close and reopen, reconnect all passed.
Not reported: Android airplane-mode test (the plan asks for one) — do it before the demo if one is
available. Outside M5 and still open from earlier: delete the old `charityflow-app` Render service,
run Price health manually, add the four admins, fix the API Ninjas key.

**Step 4 follow-up — M5 manual tests passed locally (2026-11-08).** The user ran the laptop
checklist in Chrome against `npm start`: guest save, reload keeps form/step/result, offline via
DevTools (banner, calculation, device save, "Needs a connection"), transfer (no, then yes in a new
tab), signed-in offline save, delete, 360 px layout, and the update test (rebuilt with a changed
header while a form was half filled: new version appeared, entries kept — M5 unknown 1 closed).
iPhone Safari over Wi-Fi (plain HTTP, so no service worker): guest save, reload restore, transfer
and layout passed. Pushed to deploy. **Still to do on the live HTTPS site:** iPhone (Home Screen
and Safari) and Android airplane-mode test, per the M5 "Proving it works" list.

**Step 4 — M5 saving and offline, built (2026-11-08).** Server: `server/routes/calculations.js`
(`GET|POST /api/calculations`, `DELETE /api/calculations/:id`, signed-in only, user id only from
the session). `server/calculations/cleanCalculation.js` rebuilds every saved calculation from an
allowlist (types, enums, list sizes ≤ 25, prices in the B.2 band, dates) and re-runs the engine:
the browser's figures must match or the save is refused, and the server's own result is stored.
POST takes `{calculations:[1..10]}` (all or none); cap 200 saves per account; rate limits per
user and per IP; 404 for both "missing" and "someone else's". Browser: guest saves in
`cf.v1.saved` (`src/lib/savedCalculations.js`, each entry validated on load, max 50), "Save to my
account" with a needs-a-connection message that keeps the result on screen, `#/saved` page
(device + account lists, delete with confirm), transfer prompt on Account/Saved after sign-in
(yes = moved into the account in batches and removed from the device; no = asked again next
tab). Offline: `vite-plugin-pwa@1.3.0` (dev dependency; precache, autoUpdate, clientsClaim,
`/api/prices` NetworkFirst with 1-entry cache, no other `/api` ever cached), offline banner,
first-visit note (`cf.v1.firstVisitNoteDismissed`), "Needs a connection" on account screens,
prices refetched on reconnect (S5.3), price age on every result. In-progress form (+ step and an
on-screen result) now lives in `sessionStorage` (`cf.v1.draft`, `src/lib/formDraft.js`); the old
pre-M5 localStorage form copy is deleted on load (B.3 allows only three keys). App icon (crescent)
+ manifest. Tests: 154/154 (new: route tests, guest-save/transfer, draft, all 20 cases save
unchanged through the server checks). `npm run test:access` 70/70 against real Supabase (9 new
calculation checks). Headless-Chrome run (local server + real Supabase): service worker
offline reload, offline result = online result, guest save survives reload, transfer adds one
row with the original time and figures, signed-in offline save shows the message, no
horizontal scroll at 360 px. **Still needs a human:** deploy, then the plan's real iPhone +
Android airplane-mode test and the "deploy while a phone holds the old version" test.

**Step 3 closed — M4 DONE (2026-11-08).** The user ran the real-inbox phone walkthrough on
https://charityflow.onrender.com: register, confirm, sign in/out, reset, delete all passed;
confirmation and reset emails landed in the Gmail inbox (sender shows Brevo's
`brevosend.com` address, expected without our own domain). Phone sign-up on mobile data
worked, so per-IP rate limits see real client addresses on Render. Supabase settings updated to
match: min length 8, no required characters, 1-hour email links, sender name CharityFlow.
Password policy decision: the user chose to follow NIST SP 800-63B (no forced number/symbol).
Still open but outside M4: delete the old `charityflow-app` Render service, run Price health
manually to prove the `APP_URL` secret, add the four admins once teammates register, fix the
API Ninjas backup key.

**Step 3 hardening — account security (2026-11-08).** The user asked for strong, non-default
security on accounts and for that standard on all future code. Kept S3.2's 8-character minimum
(user's choice) and added NIST SP 800-63B checks, shared by server and screens in
`src/lib/passwordRules.js`: max 72 bytes, no common passwords (also with digits/symbols added),
no repeats/sequences, not the email name; the server also rejects passwords found in known
breaches (`server/auth/breachCheck.js`, Have I Been Pwned range API, only a 5-character hash
prefix leaves the server, allowed on the other rules if that service is down). Rate limits
(`server/auth/rateLimit.js`, in memory, per IP and per email): needed because Supabase sees
every request as coming from our one server. Failed sign-ins per email back off 30s → 15 min
after 5 free failures, never a permanent lockout, same answer for unknown emails. Deleting the
account now needs the password again. Screens show the rules and a strength meter.
106/106 tests, access test passes locally. Supabase dashboard settings to match: see the report.

**Live URL moved to https://charityflow.onrender.com (2026-11-08).** The user moved hosting to
the Render service `charityflow` (four keys as Environment Variables, Supabase Site URL and the
`APP_URL` GitHub secret updated). The old `charityflow-app` service is to be deleted. Full
re-check on the new URL: live bundle equals the `583bf96` build, security headers present, no
key or Supabase address in the bundle; CI green; 92/92 unit tests (engine + 20 cases); live
prices in band and served from cache; `npm run test:access` 61/61; email-link flows checked
with Supabase-generated links (no email sent): link points at the new Site URL, confirm signs
in, used link fails, confirmed email can't re-register, reset sets a new password, old one
fails, other device signed out, delete removes the account. Still needs a human: real-inbox
phone walkthrough, M2 stranger test at 360 px, and a manual Price health run to prove the
`APP_URL` secret.

**Step 3 follow-up — M4 access test passed live (2026-11-07).** The user ran
`002_accounts.sql` (all 8 tables present), set the Site URL and both email templates, and added
`SUPABASE_PUBLISHABLE_KEY` to local `.env`. `npm run test:access` against the real Supabase:
61/61 checks passed (route layer, database rules alone on all 6 user tables, server-only tables,
admin log = exactly one row, delete leaves no row and removes the sign-in record, old cookies die
after delete and sign-out). Test users cleaned up. Still open for M4: real-inbox phone walkthrough
(register, confirm, sign in/out, reset, delete; link opened on a different device) after deploy;
adding the four admins once teammates register.

**Step 3 — M4 accounts, built (2026-11-07).** Server: `server/app.js`
(app factory; `index.js` just starts it), `server/supabase/` (`authClient.js` = Supabase Auth over
REST, `dbClient.js` = account tables, every function filtered by the session's user id),
`server/auth/session.js` (HttpOnly `cf_session` cookie with the access + refresh token, re-checked
with Supabase on every request, refreshed once when expired, cleared when revoked),
`server/routes/auth.js` and `server/routes/account.js`. Routes: `POST /api/auth/register|login|
logout|reset` (B.7) plus `resend`, `confirm` (email link → session), `new-password` (then signs
out other devices) and `GET /api/auth/session`; `GET|PUT /api/profile`, `DELETE /api/account`
(body `{confirm:"DELETE"}`), `GET /api/admin/users/:id` (logged) and `GET /api/admin/stats`.
CSRF: SameSite=Lax cookie + Origin check on every non-GET `/api` call. SQL:
`supabase/002_accounts.sql` creates every B.1 table with RLS, own-row policies, `on delete
cascade`, explicit grants (auto-expose is off), `admin_read_user_data` and `admin_stats`
(execute revoked from anon/authenticated). Choices not spelled out in the plan: email links
land on `#/confirm?token_hash=…&type=…` and need a button tap (stops mail scanners using up the
link, works in a different browser — plan M4 unknown 2); gifts can only reference their own
owner's goal (composite FK); `goal_label` is filled by server code in M7, not a trigger.
Screens: `#/register`, `#/signin`, `#/reset`, `#/confirm`, `#/account`, and `#/reminders` /
`#/planner` placeholders that offer registration to guests (S3.1). Status page shows counts to
admins. Tests: `server/routes/accounts.test.js` (20, in-memory fake Supabase). Live check:
`npm run test:access` (`scripts/access-test.js`) runs the two-user test through the routes AND
the database rules alone, the admin-log check, and delete-leaves-no-rows. 92/92 tests, build,
lint clean. **Needs the user before it is live:** run `002_accounts.sql`; set the two email
templates and Site URL (see the M4 report); add `SUPABASE_PUBLISHABLE_KEY` to local `.env` for
the access test; then run it, register/confirm/reset/delete from a real inbox on a phone.

**Step 2 closed — M3 fully verified (2026-11-07).** `price-health.yml` run manually: passed
clean (prices 1 hour old, exit 0). Manual browser walkthrough on the live site against 4 test
cases computed from today's real prices (gold $130.7247/g, silver $1.669/g) — cash above silver
nisab (due, $250.00 on $10,000), same cash below gold nisab (belowNisab), a small amount below
silver nisab (belowNisab), and not held a year (notYetDue) — all matched expected output,
including net wealth and nisab value shown on the result screen. M3 is done: built, tested,
broken once in production (Secret Files vs. Environment Variables), fixed, and now verified by
hand in a real browser. Nothing left open for M3.

**Step 2 follow-up — M3 confirmed live on Render (2026-11-07).** After deploying, `/api/prices`
kept returning 500 with `SUPABASE_URL is not set` even after re-adding env vars and a clean
redeploy. Root cause: the 4 keys had been added to Render as **Secret Files**, not
**Environment Variables** — a Secret File writes to disk, never to `process.env`, so the app
could never see them regardless of redeploys. Diagnosed with a temporary `/api/debug-env` route
(reported only true/false per var, never a value) added, tested, then removed once confirmed.
After moving the 4 keys to real Environment Variables, Render auto-restarted and
`https://charityflow-app.onrender.com/api/prices` returned real prices
(`goldUsdPerGram: 130.7247`, `silverUsdPerGram: 1.669`), matching the same cached row from the
earlier local test. `/api/health` was live throughout. M3 is now confirmed live, not just
locally verified. Still open: `price-health.yml`'s `APP_URL` secret should be re-checked now
that the service is confirmed stable, and the live calculator/status pages haven't been
clicked through in a browser yet (only curl-tested).

**Step 2 follow-up — M3 verified live end-to-end (2026-11-07).** Fixed three real issues found
only by testing with real keys: (1) Supabase's new `sb_secret_`/`sb_publishable_` keys must go
on the `apikey` header only — sending one as `Authorization: Bearer` too makes PostgREST try to
parse it as a JWT, fail, and fall back to the `anon` role, which then hits RLS as a 403;
`priceCacheStore.js` fixed. (2) This Supabase project has "auto-expose new tables OFF," so a
brand-new table gets zero REST grants even for `service_role` — added explicit `grant select,
insert, update` statements to `supabase/001_price_cache.sql` (the user re-ran just those two
lines). (3) The real MetalCharts endpoint is `GET /v1/prices` (not `/v1/latest` as I'd guessed),
and gold/silver are nested as `data.XAU.price`/`data.XAG.price` in troy ounces, not bare
numbers — `providers.js` fixed and confirmed against one real request. `npm start` locally then
returned real prices end-to-end (first call fetched live: $130.72/g gold, $1.669/g silver;
second call was a confirmed cache hit — same `fetchedAt`, no new provider call), stored
correctly in `price_cache`. **API Ninjas key returns "Invalid API Key" from their service** —
not a code issue (same error regardless of endpoint/params); the user needs to check that key
in their API Ninjas dashboard. Not blocking, since MetalCharts is tried first and works. Minor
cosmetic note: timestamps round-trip through Postgres as `+00:00` instead of `Z` — both are
valid ISO 8601 UTC and parse identically, no action needed. M3 is now genuinely done, not just
built. Still outstanding: `price-health.yml` needs `APP_URL` as a GitHub secret once Render is
live with the four env vars, and a stale/missing-price drill on the deployed site.

**Step 2 — M3 live prices, built but not live-tested (2026-11-06).** `GET /api/prices` is
implemented with the cache/fallback logic as a pure, fully-tested function
(`server/prices/decidePrices.js`, 10 tests, fake providers only — never calls a real API in
tests). Real I/O is thin and separate: `server/prices/providers.js` (MetalCharts then API
Ninjas, 8s timeout each), `server/prices/priceCacheStore.js` (Supabase REST with the
service-role key, 8s timeout), wired in `server/routes/prices.js`. SQL for `price_cache` is in
`supabase/001_price_cache.sql` — RLS on with zero policies, so only the service-role key (used
only by the server) can ever touch it. The app: `usePrices` now calls our own `/api/prices`,
keeps a `cf.v1.prices` localStorage copy (Appendix B.3, ready for M5 offline use),
`CalculatorPage` shows a stale-prices warning but still calculates (S12.3) and a blocking
"no price available" message when none has ever been retrieved (S12.4) — the M2 custom-price
workaround is retired now that real prices exist. `#/status` shows last success, last attempt,
source and the credit link. `price-health.yml` calls the live app twice a day and fails if
stale. Security pass done as part of this step: no secret ever in a response body or log line
visible to the client (checked by starting the server with no env vars set — client got a
generic 500, the real cause only hit the server log); all three external calls (MetalCharts,
API Ninjas, Supabase REST) have an 8-second timeout; price values are bounds-checked
(sanity band) before being trusted or cached; `price_cache` is unreachable by any signed-in
user by construction (RLS, no policies); `x-powered-by` is disabled and basic
`X-Content-Type-Options`/`X-Frame-Options`/`Referrer-Policy` headers are set; no CORS
middleware was added since the browser only ever needs same-origin access. 72/72 tests, build
and lint clean.
**NOT verified against the real APIs** — I have no MetalCharts or API Ninjas key. The response
shapes in `providers.js` (MetalCharts' `data.XAU`/`data.XAG` in troy ounces; API Ninjas'
`{price}` per metal) are my best read of the public docs, not confirmed. Needs a human with
real keys to run one request and report back before this is trusted in production — see the
report for exactly what to check.

**Step 1 follow-up — M2 is DONE (2026-11-06).** Mufti Ahmad confirmed the engine's rules (not a
specific spreadsheet), so the 20 cases were built directly: `src/hooks/twentyCases.test.js`
covers every category (cash/savings, gold/silver by value and by grams, gems resale/personal,
securities trade/long-term-default/count-in-full, crypto trade/long-term, multiple real-estate
entries, rentals net of expenses, business ownership share, retirement annual/when-accessible),
the nisab boundary (above, below, exactly at), debts subtraction, and gold-vs-silver nisab on
the same wealth. Each case is entered as form text and run through `buildEngineInputs()` — the
same path the screens use — then checked against the confirmed engine's own output, so it
verifies the screens' input handling, not the religious rules (those were Mufti Ahmad's and
engine item 8's job). 63/63 tests pass. M2's "Done when" list is now fully satisfied except the
one thing no one has done yet: a real phone/laptop walkthrough by someone outside the team.

**Step 1 — M2 gaps closed (2026-11-06).** Audited M2 against its "Done when" list. Fixed: the
US/Canada/EU nisab note was missing from the Settings step (added, `helperText.nisabRegionNote`);
definitions were only reachable from Home, not from the result screen (extracted to a shared
`Definitions` component, now on both). Already satisfied before this step: every category has
an explanation (`reasonText.js`), the disclaimer is on every page via the footer, nisab/lunar-year
require an explicit answer, the date step shows Gregorian and Hijri, guests give no personal
info, and the only network request is a static GET of `public/prices.json` carrying no entered
value. `public/prices.json` remains the fake price source until M3 lands, as instructed.
CSS was audited for fixed widths that could overflow at 360px — none found (everything uses
`max-width` with flex-wrap) — but this is not a substitute for a real-device check, which
nobody has run yet. **Still open and NOT verified: "all 20 cases match through the screens."**
I do not have the 20-case spreadsheet Mufti Ahmad confirmed; without those inputs/expected
results I can't build or run that check. Needs the data from the user.

**Step 0 follow-up (2026-11-06).** Mufti Ahmad confirmed the 20-case spreadsheet against the
engine with no corrections needed. Known-gap #8 is closed — the retirement
`annual`/`whenAccessible` rules and rounding are confirmed as built. M1 is now fully DONE.
Render is connected (done by the user). Outlook/school-email spam tests and teammates each
merging a PR are deferred by the user to later — not blocking the next steps.

**Step 0 — foundations check (2026-11-06).** Checked the engine against every item in "Known
gaps" below: items 1-7 were already fixed in an earlier session (prices renamed to
`goldUsdPerGram`/`silverUsdPerGram`, gold/silver price themselves from grams when `valueCents`
is null, line `treatment` is `full|reduced|excluded`, errors are `{field, code}`,
`realEstateForSale` is a list, test prices are 134.34/1.96, the B.6 case passes, and
`nisab`/`heldOneLunarYear` give no result until explicitly chosen). Item 8 (retirement
annual/whenAccessible, the 20-case rounding) is intentionally still open — it needs Mufti
Ahmad's confirmation, not a code change. The app shell also already exists: `src/components/
Header.jsx` and `Footer.jsx`, `src/pages/HomePage.jsx`, one routes file (`src/routes.js`), and
shared CSS with dark mode (`src/styles/variables.css`). `npm test` (43/43) and `npm run build`
pass. Open: the M0 items that need a human (Render connection, Outlook/school-email tests,
every teammate merging one PR) and the 20-case spreadsheet / Mufti Ahmad confirmation for
engine item 8 — neither is something to do from code.

## Known gaps in the current code
All closed as of Step 0 (2026-11-06). Items 1-7 (price field names, grams-to-value, line
treatment values, error shape, `realEstateForSale` as a list, test prices, no-default
nisab/lunar-year) were fixed in an earlier session. Item 8 (retirement `annual`/
`whenAccessible` and the 20-case rounding) is now confirmed by Mufti Ahmad with no
corrections needed. Nothing open here.
