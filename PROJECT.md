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
- Build freeze: **Mon Nov 9, 18:00**. Demo Nov 10 to 12. Updated plan due **Nov 11**.
- Cut order if behind: **M7 first, then M6**. Never cut M0 to M5 or M8.
- Never cut: engine tests, the disclaimer (S2.2), price age on every result (S12.2),
  the nisab choice (S1.9), access-rule tests (NFR5).

## Stack (do not swap without asking)
React + Vite, plain JavaScript (no TypeScript until the Final Release), Vitest, hash routes
(`#/calculator`), Vite base `/charityflow/`, GitHub Pages deployed by GitHub Actions
(`.github/workflows/deploy.yml`, runs `npm test` first), Supabase free (Auth, Postgres, RLS),
Brevo free SMTP (sign-up/reset emails via Supabase, reminder emails via API), GitHub Actions
scheduled jobs (prices twice a day, reminders hourly), `vite-plugin-pwa` for offline,
`Intl.DateTimeFormat` with `islamic-umalqura` (fallback `islamic-civil`) for Hijri dates,
`localStorage` for guest saves. No server of our own.

## Hard rules
1. Money is integer cents everywhere. Prices are dollars per gram, up to 4 decimals.
2. The engine (`src/engine/`) is pure: no network, no screens, no storage. Never change its
   math without being asked, and run `npm test` after any change.
3. The browser never calls the price API. A scheduled job writes `public/prices.json`.
4. Guests' entries never leave the device (NFR6). No third-party scripts, no CDNs.
5. The database enforces access with row-level security, not the screens (NFR5).
6. No secrets in code. Only public-safe `VITE_` values in `.env`. Service keys live only in
   GitHub Actions secrets.
7. No `dangerouslySetInnerHTML`, `innerHTML` or `eval`. Render user text as plain text.
8. Mobile first (360 px wide, no horizontal scroll), accessible (labels, focus, keyboard, AA contrast).
9. Wrap every `localStorage` read and write in try/catch and validate what is loaded.
10. Run `npm test` and `npm run build` before saying a task is done.

## Accounts that exist (all free, set up by the team)
GitHub repo `Navruz77/charityflow` (public, 4 collaborators). Supabase project
`ocqcehendxpwbbzgvpie` (Data API on, auto-expose new tables OFF, auto-RLS ON). Brevo (SMTP key
in Supabase, sender verified, API key for reminders). MetalCharts free key (200 requests a
month, credit link "Prices via metalcharts.org" required next to public prices). API Ninjas
free key (backup; last daily settlement; use `name=gold` / `name=silver`, `unit=g`).
GitHub secrets already set: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
Still to add when needed: `METALCHARTS_API_KEY`, `API_NINJAS_KEY`, `BREVO_API_KEY`,
`SUPABASE_SERVICE_KEY`.

## Milestones (build order)

**M0 Foundations: DONE.** Repo, Pages deploy, accounts, keys, first test email (landed in spam;
expected without a domain; Outlook and school-email tests still to do).

**M1 Engine: DONE with open items** (see "Known gaps" below).

**M2 Guest calculator screens** (due Nov 3). Stories S1.1 to S1.12, S2.1 to S2.3, S3.1.
One screen per group (cash and metals; investments and crypto; property and business;
retirement and debts; nisab choice; Zakat date; result). Entries kept when going back.
"Why this counts" text per step. Result lists each category, debts subtracted, net wealth,
nisab used, amount due, and explains every line. Nisab step: gold or silver, no result until
chosen, note for US/Canada/EU, recalculates without re-entry. Date step shows Gregorian and
Hijri and asks the one lunar-year question. Disclaimer on every result. Definitions of nisab,
hawl, Zakat, sadaqah one tap away. Guests give no personal information.
Done when: a stranger finishes a calculation on a phone and a laptop, every category above $0
has an explanation, the disclaimer is on every result, all 20 test cases match through the
screens, no horizontal scroll at 360 px, and the network panel shows no request carrying an
entered value.

**M3 Live prices** (due Nov 2). Stories S12.1 to S12.4. Workflow `refresh-prices.yml` at
05:43 and 17:43 UTC plus manual run. Script: MetalCharts first, then API Ninjas, then keep the
last published file and record the failure. Convert to USD per gram (31.1034768 g per troy oz
if the source is per ounce). Reject missing, non-numeric, zero, negative values and values
outside the sanity band (gold 20 to 1,000, silver 0.2 to 100 USD/g). Write `public/prices.json`
(shape below), then build and deploy. Fail the run if the last good fetch is over 24 hours old
(this is the alert). App: nisab from prices (S12.1); retrieval time on every result (S12.2);
warning over 24 hours but still calculate (S12.3); no result and a clear message if no price
was ever retrieved (S12.4). `#/status` page shows last success, last attempt, source, credit link.
Never call the live API during development; use a fake `prices.json`.
Done when: the workflow ran on schedule twice unaided, both failure drills work, and the stale
and missing messages match S12.3 and S12.4. First task: one real request to confirm response
field names and units before writing the script.

**M4 Accounts** (due Nov 4). Stories S3.2, S3.3, S3.4, S3.6. Supabase Auth email and password,
min 8 characters, email confirmation, resend. Same message for wrong email and wrong password.
Reset link sets a new password and signs out other devices. Delete account needs explicit
confirmation and removes everything. Create tables in B.7 with RLS (B.8) and
`on delete cascade` to the user. Store the browser time zone in `profiles` on account creation.
`admins` table and `admin_read_user_data` function that logs each read. A guest who opens an
account feature is offered registration.
Done when: a two-user script cannot read, change or delete the other user's rows in any table;
reset and delete flows pass; an admin read writes exactly one log row. Unknowns: delete the
sign-in record via a database function (else a Supabase function, the only server code
allowed); email links opened in a different browser; Supabase per-hour auth email limit.

**M5 Saving and offline** (due Nov 6). Stories S4.1, S4.2, S3.5, S5.1 to S5.3.
Guest: "Save on this device" to `localStorage`. Signed in: "Save to my account" inserts into
`calculations`; offline shows "needs a connection" and keeps the calculation on screen. After
sign-in, offer to add guest saves to the account (only on yes). `vite-plugin-pwa` precaches the
app; `prices.json` network-first with cache fallback and a `localStorage` copy. Offline banner;
calculator, explanations, definitions, disclaimer all work offline; result shows price age.
First-visit note (open online once; on iPhone add to Home Screen). Calculation under 1 second.
Unknown: `autoUpdate` may wipe a half-filled form; if so use a "new version ready" prompt or
keep a draft in `sessionStorage`.

**M6 Reminders** (Nov 5 to 8, cut second). Stories S6.1, S6.3 to S6.5. Settings for Zakat date
(Gregorian plus Hijri month/day), four reminder types (zakatMonth, ramadan, friday,
dhulHijjah), all off by default, in-app and/or email each. Hourly `send-reminders.js`: for each
user, local date and Hijri date from the stored time zone; skip before 09:00 local; insert a
`reminders_sent` row (unique key makes duplicates impossible); send email through Brevo only
if the insert happened; `--as-of <datetime>` dry run prints what would happen. Refresh the
stored time zone whenever reminder settings are saved.

**M7 Sadaqah planner** (Nov 5 to 8, cut first). Stories S8.1 to S8.3. Goals (monthly or yearly,
name, amount), gifts (amount, date, optional recipient, note, goal), progress and streaks.
Pure functions in `src/planner/` with Vitest tests. Periods are calendar months/years in the
user's time zone. Removing a goal keeps its gifts with a label and stops counting them.

**M8 Hardening and demo** (Nov 8 to 9). Browser matrix in `docs/test-matrix.md` (Chrome,
Safari, Firefox, Edge, current and previous, from 360 px), privacy checks, two-user test across
every table, walkthrough of all 37 stories, README, rehearse the demo twice.

## Contracts

### prices.json (B.2)
```json
{ "schemaVersion": 1, "goldUsdPerGram": 134.34, "silverUsdPerGram": 1.96,
  "fetchedAt": "2026-10-29T06:00:12Z", "source": "metalcharts",
  "lastAttemptAt": "2026-10-29T06:00:12Z", "lastAttemptOk": true, "lastAttemptNote": null }
```
`source` is `metalcharts` or `api-ninjas`. `fetchedAt` changes only when new prices arrive.
Stale when now minus `fetchedAt` is over 24 hours. Prices must be numbers above 0.

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
On `reminders_sent` users read and mark read their own; only the job (service key) inserts.
`admins` and `admin_access_log` are not reachable from the browser. Admins read user data only
through `admin_read_user_data(subject)`, which logs the read.

### Brevo reminder request (B.9)
```json
{ "sender": {"name": "CharityFlow", "email": "<verified sender>"},
  "to": [{"email": "<user email>"}], "subject": "Ramadan reminder",
  "textContent": "It is Ramadan. A small gift today counts." }
```
Key goes in the `api-key` header from GitHub secrets. No financial figures in reminder emails.

## Story list (37 built in the MVP)
S1.1 to S1.12, S2.1 to S2.3, S3.1 to S3.6, S4.1, S4.2, S5.1 to S5.3, S6.1, S6.3 to S6.5,
S8.1 to S8.3, S12.1 to S12.4. Not built (Final Release): S4.3, S6.2, S6.6, S8.4, S7.x, S9.x,
S10.x, S11.x.

## Known gaps in the current code (fix before building on it)
The engine and `public/prices.json` were written before this briefing and differ from the
contracts above. Align them to the contracts, keeping the 25 existing tests green or updated:
1. Prices use `goldPerGram` / `silverPerGram`; the contract is `goldUsdPerGram`,
   `silverUsdPerGram`, `fetchedAt` plus the extra `prices.json` fields.
2. Gold and silver entered in grams are ignored; the engine reads only `valueCents`. It must
   compute value from grams when `valueCents` is null.
3. Line `treatment` uses `full|partial|net|share|excluded`; contract is `full|reduced|excluded`.
4. Errors are `{field, message}`; contract is `{field, code}`.
5. `realEstateForSale` is a single number; contract is a list of `{valueCents}`.
6. Tests use invented prices (140 / 1.6). Use 134.34 / 1.96 and the B.6 case.
7. Missing `nisab` or `heldOneLunarYear` should give no result, not a default.
8. Retirement "annual" vs "whenAccessible" and the 20-case rounding are not yet confirmed
   against Requirements Appendix A / Mufti Ahmad. Do not change them without being told.
