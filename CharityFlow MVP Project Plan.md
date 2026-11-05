# CharityFlow: MVP Project Plan

**Team:** CharityFlow · **Course:** CISC 3171, Fall 2026 (Instructor: Alec Malstrom) · **Status:** Draft v3 · **Built from:** Requirements Document v0.3

## What We're Doing

CharityFlow is a website that works out a Muslim user's Zakat under Hanafi rules, explains how it got there, and helps them plan voluntary giving through the year. The MVP is every P1 feature in our requirements: a Zakat calculator that works for guests and works offline, live gold and silver prices, accounts, saved calculations, reminders and a sadaqah planner, all built on free services.

We are starting from scratch, with no code. When this plan is complete, anyone can open a public link and work out their Zakat with no account. A person who creates an account can save calculations, set their Zakat date, receive in-app and email reminders, set giving goals and log gifts. The calculator keeps working with no internet connection after one online visit.

## Why We're Doing It

Muslims who owe Zakat usually work it out by guesswork, a spreadsheet, or by asking a friend or an imam. Online calculators tend to cover only cash and gold, give a number without showing how they reached it, and ignore investments, crypto, retirement accounts, rental income and debts. A mistake means paying too little, which leaves a religious duty unmet, or paying too much. Voluntary giving has the same problem: without a reminder or a record, people miss their Zakat date and let their giving lapse.

CharityFlow replaces that guesswork. A person gets an answer in a few minutes, on a phone, with no account, and can follow every line of it. If they want, they can keep their calculations, be reminded at the right times of year, and track what they give.

Three facts shape everything below.

| Constraint | Fact | What it forces |
| --- | --- | --- |
| Calendar | Today is Thu Oct 29. MVP demos run Tue Nov 10 to Thu Nov 12, and this plan is due Tue Nov 10. We build until Mon Nov 9 | Parallel work and a fixed build order |
| Budget | $0, no payment card on any service | Free tiers only, checked against their published limits |
| Rules | Hanafi rules and nisab method supplied by Mufti Ahmad (Requirements Appendix A) | The calculation engine is built and tested first |

## How We're Doing It

### Design

We are building a website with its own back-end server and a hosted database. The React app runs in the browser and does the calculation. Everything else (sign-in, saved data, price lookups and reminders) goes through our Node server, which is the only part that holds a key or talks to the database. One scheduled job on GitHub sends reminders by calling that server. Everything runs on free tiers.

#### Stack

| Layer | Choice | Why it fits | Rejected |
| --- | --- | --- | --- |
| Front end | JavaScript with React, built with Vite (`npm create vite@latest charityflow -- --template react`) | The team's choice. The Vite React template runs in three commands, and there is no TypeScript or state library to learn | TypeScript, Redux (extra learning, no MVP benefit) |
| Calculation engine | One plain JavaScript module (`src/engine/`) that takes inputs and prices and returns a result. Money is whole cents. The browser runs it, so it also works offline | Testable without a browser or a server, and the same code gives the same answer online and offline | Calculating inside React components |
| Back-end server | Node.js with Express, one small app that serves the built site and an `/api` for sign-in, saved calculations, price lookups and reminders. It looks up gold and silver prices when a calculation needs them and keeps each price for 8 hours in a database table, with API Ninjas as the fallback | The browser never holds a database address or a key. Fetching on demand uses the API as intended, and the cache keeps us near 90 requests a month against the 200 allowed | Letting the browser talk to the database directly, a static-only host, a scheduled price file |
| Database storage | Supabase Postgres, reached only from our server with the secret key kept in the host's settings. Row-level rules stay on as a second layer | Free, hosted, and the rules mean a bug in our server code still cannot expose another user's rows | A database on our own machine, Firebase (its scheduled functions need the paid plan) |
| Accounts and sign-in | Supabase Auth, called by our server for sign-up, confirmation, sign-in and password reset. The server keeps the session in an HttpOnly cookie | Password storage and reset links are handled by a maintained service, and the browser never sees a token it could leak | Writing our own password storage |
| Email service | Brevo free plan, set up as Supabase's custom email sender for sign-up and reset messages, and called by our server for reminder emails. One verified sender address | 300 emails a day free. Supabase's built-in sender is meant for testing and is limited to a few emails an hour | Supabase's built-in sender, Resend (its free plan appeared to need a verified domain, which we do not own) |
| Scheduled work | One GitHub Actions workflow runs hourly and calls the server's reminder endpoint with a secret token | Reminders need a clock, not a user action. Actions are free for public repositories, and the hourly call also keeps the Supabase project active | `pg_cron` inside Supabase (it stops when the project pauses) |
| Hosting | Render's free web service runs the server and deploys from the GitHub repository on every merge to `main`. The repository is public | Free, deploys itself from GitHub, and holds all secrets in its settings instead of in the code | GitHub Pages (static pages only), a private repository |
| Offline | `vite-plugin-pwa` (Workbox) with `registerType: 'autoUpdate'` | Generates the service worker and manifest from a few lines of config | A hand-written service worker |
| Islamic dates | The browser's built-in `Intl.DateTimeFormat` with `calendar: 'islamic-umalqura'`. The reminder job uses the same method | No library to add | A date library |
| Guest saves | `localStorage` | Simplest option, and a guest's data never leaves the device | IndexedDB |
| Tests | Vitest | Reads the Vite config and runs with `npm test` | Manual-only testing |

Supabase's free plan allows 2 projects, 500 MB of database and 50,000 monthly active users, far above what we need. It pauses a project after 7 days of inactivity, which the hourly reminder job prevents. Render's free web service gives 750 instance hours a month, sleeps after 15 minutes without traffic and takes about a minute to wake. Every secret (the Supabase secret key, the price and email keys, the job token) lives only in Render's environment settings and GitHub Actions secrets. None is in the repository or in the browser, so the repository can stay public. The MetalCharts free tier requires a visible credit link next to public prices, so the result screen and status page carry "Metal prices by MetalCharts". Sources are in References.

#### Architecture

&#91;embedded content: CharityFlow MVP architecture · browser, one server, 4 outside services\]

The browser talks only to our server. The server talks to Supabase for sign-in and saved data, to the price APIs when a calculation needs a price, and to Brevo for email. GitHub Actions runs the tests on every pull request and calls the server once an hour to send reminders. The highlighted box is the code that most needs to be correct.

#### Key Decisions That Affect Everything

1. **Money is whole cents.** A value computed from grams, a percentage or an ownership share rounds to the nearest cent when computed, and Zakat due rounds to the nearest cent once at the end. We confirm this against 20 hand-calculated cases in M1 (NFR1).
2. **Guests keep everything on their device.** A guest's entries never leave the browser (NFR6). An account holds an email address, a password, and only what the user chooses to save (NFR4).
3. **Each person's reminders follow their own time zone.** The app stores the browser's time zone name when an account is created, and the reminder job decides each person's local date from it.

### Buckets of Work

Five kinds of work make up the MVP. Each spans more than one milestone.

**Getting the numbers right.** Every other part of the product is worthless if the Zakat due is wrong, and a wrong figure does not crash anything. The rules have many small edge cases: jewelry, long-term holdings at a 30% default zakatable share, debts due within 12 months, retirement balances under two methods, and ownership shares. We handle this by keeping the rules in one pure engine (M1), writing its tests from Appendix A of the Requirements Document, and having Mufti Ahmad confirm the test cases before screens are built on top of them.

**Serving commodity prices.** The nisab is a weight of metal valued at today's price, so every calculation needs a current price, and we cannot pay for a price API or assume a free one is always up. The server looks the price up when a calculation needs it, keeps it for 8 hours so we stay inside the free request limit, falls back to a second provider, and shows the age of the price on every result (M3). The greatest uncertainty is the free API's exact response format, which we check in the first hour of M3.

**Accounts and saved data.** Accounts mean we hold figures people consider private, so sign-in, saving and deleting all go through the server, which is the only part that can reach the database. We build the tables and per-user access rules, the sign-up, confirmation, reset and delete flows, and the saving and transfer of calculations (M4, M5). Email is the hardest part: we have no domain, so sign-up and reset emails come from one verified Brevo sender and may land in spam, which we test on day one (M0).

**Reminders and giving plans that run on their own.** A reminder must arrive on the right local day, once, in the channels the user chose, without anyone pressing a button. That needs a scheduled job, each person's time zone, Islamic calendar dates that can differ by a day between methods, and email limits (M6). The planner is mostly rules about periods and streaks, which we test as plain functions (M7). GitHub's scheduler is best-effort, so the job sends a due reminder on its first run after 9:00 local time and never twice.

**The guided calculator.** The rules in the first bucket only help if a beginner can get through them on a phone without help. This bucket is the step-by-step form, the explanation of every line, the nisab and date steps, the guest save, and the offline copy of the app and the last prices (M2, M5). The work is deciding what to ask on each screen, in what order and in what words, and keeping it usable at 360 px wide.

### Milestones

Eight milestones, in build order. Each ends in something we can check. The calculation engine comes before the screens because it is the riskiest code. The server and prices come before offline work because offline caches what the server returns. Accounts come before saving, reminders and the planner because all three store data per user.

#### M0: Foundations and services

**Dates:** Thu Oct 29 to Fri Oct 30 · **Estimate:** 2 days · **Stories:** none (it makes every later milestone possible)

**How it works.**

- We create a public GitHub repository, `charityflow`, and scaffold it with `npm create vite@latest charityflow -- --template react`. We add Vitest now and `vite-plugin-pwa` (configured in M5). We add a small Express server in `server/` that serves the built site and a `/api/health` route. Everyone installs Node 22.12 or newer, which satisfies the Node requirements published for both Vite and Vitest.
- Every change goes through a pull request reviewed by one teammate. GitHub Actions runs `npm test` and `npm run build` on every pull request. Render's free web service is connected to the repository and redeploys the site and server on every merge to `main`. Routes in the app are hash-based (`#/status`), so the server needs no routing rules for them.
- Named teammates create the free accounts: a MetalCharts key, an API Ninjas key, a Supabase project, a Brevo account with one verified sender address, and the Render service. The secrets (`METALCHARTS_API_KEY`, `API_NINJAS_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `BREVO_API_KEY`, `JOB_TOKEN`) go into Render's environment settings, and only `JOB_TOKEN` is also stored as a GitHub Actions secret. No key is in the repository or reaches the browser.
- Brevo is set as Supabase's custom email sender, and we send test sign-up emails through it.
- Each teammate works through the React Quick Start on react.dev before writing feature code.

**Proving it works.** Each teammate opens a pull request that changes the home page title, gets it reviewed and merged, and sees the change at the live URL. We send test emails to a Gmail address, an Outlook address and a school address, and record whether each reached the inbox, the spam folder or nowhere.

**We'll know this milestone is complete when** all four of us have merged a change that went live through the pipeline, `npm test` passes in CI, every key is stored as a secret, and each of the three test emails has arrived (inbox or spam) so we know where they land.

**Unknowns.**

1. *Repository visibility.* Decision: the repository is public. Every secret lives in Render's settings or in GitHub Actions secrets, so the code reveals no credentials.
2. *Email without a domain.* Decision: Brevo with one verified sender address, such as a teammate's. Method: the three test emails on Oct 30. Whatever the result, the sign-up screen carries a "check your spam folder" line and we create demo accounts ahead of the demo. We do not buy a domain, because that breaks the $0 rule.
3. *Brevo's web API or SMTP for the reminder job.* Decision: Brevo's web API over HTTPS, because it needs no extra library. Supabase uses Brevo's SMTP for its own emails.
4. *Free server wake-up time.* Render's free server sleeps after 15 minutes without traffic and takes about a minute to wake. Decision: the app shows a "waking up" message on the first request and never loses what was entered, and we load the site before every test session and demo.

#### M1: The calculation engine

**Dates:** Fri Oct 30 to Sun Nov 1 · **Estimate:** 3 days · **Stories:** S1.1 to S1.12 (calculation rules only) · **Also covers:** NFR1, NFR2

**How it works.** One function, `calculateZakat(inputs, prices)`, in `src/engine/`, returns a full breakdown (Appendix B.4). It never touches the screen, the network or the database. It implements Appendix A.4 of the Requirements Document:

- Cash and savings count in full (S1.1). Gold and silver count in full, entered as grams or dollars. Gemstones count only when held for resale (S1.2).
- Stocks, funds and ETFs held to trade count in full. Long-term holdings count as market value times the zakatable share, 30% when blank, or in full if the user opts in (S1.3). Crypto held to trade counts in full, and long-term crypto does not count (S1.4).
- Real estate held for sale counts in full (S1.5). Rental properties count rent collected and unspent minus expenses, never below $0 (S1.6). Businesses count cash plus inventory plus receivables minus liabilities, never below $0, times the ownership share (S1.7).
- Debts due now and installments due within 12 months are subtracted, and net wealth is never below $0 (S1.8).
- Retirement accounts use "pay annually" (vested balance times zakatable share, minus estimated penalty and taxes, never below $0) or "pay when accessible" ($0 now) (S1.12).
- The nisab is 87.48 g of gold or 612.36 g of silver at the current price (S1.9). With the lunar-year answer from S1.10 and the 2.5% rate, the engine returns Zakat due, or "not yet due" (S1.11).
- Validation follows the F1 introduction: a blank is $0, and a negative or non-numeric amount is rejected with the field named while every other entry is kept.

The account-stored Zakat date in the last criterion of S1.10 is built in M6.

**Proving it works.** Table-driven Vitest tests in `src/engine/`:

- Requirements Appendix A.6 provides tests 1 and 2: $9,851.34 of net wealth gives $0.00 against the gold nisab and $246.28 against the silver nisab, and $7,500 gives $187.50 against the silver nisab.
- Every category is tested below the nisab, exactly at the nisab (due, because the requirement says wealth "reaches" the nisab), and above it.
- The defaults (30% share, 100% retirement share, $0 penalty) and every "never below $0" rule each have a test.
- Each rejected input names its field.
- A spreadsheet of 20 cases is calculated by hand by a teammate who did not write the engine, and compared line by line.
- A speed test runs 1,000 calculations in under 1 second (NFR2).

On Sun Nov 1 we send Mufti Ahmad the 20 cases (inputs and expected results) for confirmation.

**We'll know this milestone is complete when** every engine test passes in CI, the 20-case spreadsheet matches the engine to the cent, and Mufti Ahmad has confirmed the cases or his corrections have been applied and re-run.

**Unknowns.**

1. *Rounding policy.* Decision: round each computed value to the cent when it is computed, and round Zakat due once at the end, because that matches what the user sees line by line. The 20 hand-calculated cases confirm it, and Mufti Ahmad sees them on Sun Nov 1.
2. *Price precision.* The requirements example uses prices with 2 decimals, and live prices have more. Decision: prices carry up to 4 decimals per gram and the engine works in ten-thousandths of a dollar, so the A.6 examples remain exact. The A.6 tests confirm it.

#### M2: The guest calculator in the browser

**Dates:** Sat Oct 31 to Tue Nov 3 · **Estimate:** 4 days · **Stories:** S1.1 to S1.12 (screens), S2.1 to S2.3, S3.1 (first two criteria) · **Also covers:** NFR3, NFR4, NFR6

**How it works.**

- A step-by-step form with one screen per group (Appendix A.1 to A.9): cash and metals, investments and crypto, property and business, retirement and debts, nisab choice, Zakat date, result. Entries are kept when the user moves back and forward.
- Each step has a short "why this counts" explanation drawn from Requirements Appendix A. The result lists each category's contribution, the debts subtracted, net wealth, the nisab used and the amount due, and explains every line (S2.1).
- The nisab step offers gold or silver, shows no result until one is chosen, carries the note for people in the US, Canada and the EU, and recalculates without re-entry when the choice changes (S1.9).
- The date step converts a Gregorian date to a Hijri date with the browser's `Intl.DateTimeFormat`, shows both, and asks the one lunar-year question (S1.10).
- Every result carries the disclaimer (S2.2). Definitions of nisab, hawl, Zakat and sadaqah are one tap away (S2.3, Appendix A.10).
- A guest is asked for no personal information and can calculate with no sign-in (S3.1). Until M3, results use a fixed set of sample prices built into the app.

**Proving it works.**

- Two teammates enter the 20 M1 cases through the screens on two phones. Every amount due must equal the engine test.
- Three people outside the team get one sentence, "work out your Zakat", and a phone. We record whether they finish and where they stop.
- At 360 px wide and at desktop width there is no horizontal scrolling (NFR3).
- With the browser's network panel open, no request carries an entered value (NFR6).

**We'll know this milestone is complete when** someone who has never seen the app completes a calculation on a phone and on a laptop, every category with an amount above $0 shows an explanation, the disclaimer appears on every result, and all 20 cases match.

**Unknowns.**

1. *Hijri dates in browsers.* Decision: use `islamic-umalqura`. Method: a 30-minute check on Fri Oct 30 formats today's date in Chrome, Safari on iPhone, Firefox and Edge, on one laptop and two phones. We fall back to `islamic-civil` only if one browser cannot format `islamic-umalqura`. The one-day difference between variants is already accepted in S1.10.
2. *Step-by-step form or one long page.* Decision: a step-by-step form, one group per screen. It matches the requirements, keeps each screen short on a phone, and the three outside testers confirm that people finish it without help.

#### M3: Live gold and silver prices

**Dates:** Sat Oct 31 to Mon Nov 2 · **Estimate:** 3 days · **Stories:** S12.1 to S12.4, and the price-time line of S1.11 · **Also covers:** NFR9 (price health; user counts are added in M4)

**How it works.**

- The server has one price route, `GET /api/prices`. When a calculation needs prices, the app calls it. The server checks the `price_cache` table: prices younger than 8 hours are returned as they are. Otherwise the server calls MetalCharts with the secret key, reads gold and silver, converts to US dollars per gram, and rejects any value that is missing, non-numeric, zero or negative, or outside a sanity band. It stores the new prices with the retrieval time and returns them (Appendix B.2).
- If MetalCharts fails, the server tries API Ninjas. If both fail, it returns the last stored prices and records the failed attempt, so a calculation can still run with an older price. If no price has ever been stored, the server says so.
- In the app, the nisab is computed from the prices (S12.1). Every result shows when the prices were retrieved (S12.2) and a warning when they are over 24 hours old, while still calculating (S12.3). If no price has ever been retrieved, the app says it cannot work out the nisab or any weight-based value and shows no result (S12.4). The app keeps the last prices it received in `localStorage`, which the offline calculator in M5 uses. See Appendix A.14 and A.15.
- A `#/status` page (Appendix A.12) shows the last successful retrieval, the last attempt and its outcome, and which source was used. It carries the MetalCharts credit link.
- A small workflow, `price-health.yml`, runs twice a day, calls `GET /api/prices`, and ends in failure if the last successful retrieval is over 24 hours old, so that GitHub notifies the repository owner (the NFR9 alert).

**Free-limit math.** A price is reused for 8 hours, so the server makes at most 3 MetalCharts requests a day, about 90 a month, plus a few manual tests, against the 200 a month the free tier allows. The count does not grow with the number of visitors. During development we use a fake provider, never the live API.

**Proving it works.**

- Call `/api/prices` twice within 8 hours: the second call returns the stored prices and the provider's request counter does not move. Set the stored time back past 8 hours: the next call fetches new prices.
- Break the primary key on purpose: the fallback supplies prices. Break both: the previous prices come back, `lastAttemptOk` is false, the app still calculates, and the status page shows the failure.
- Edit the stored time so the prices are 25 hours old: the stale warning appears. Empty the cache table: the S12.4 message appears and no result is shown.
- Read the monthly usage counter in the API's response headers after a week to confirm we stay well under 200.

**We'll know this milestone is complete when** the cache test, both failure drills and the 25-hour test behave as described, `price-health.yml` has run at least twice, and the stale-price and missing-price messages match S12.3 and S12.4.

**Unknowns.**

1. *The free API's exact response.* We expect prices in US dollars per troy ounce, converted at 31.1034768 grams per troy ounce. Method: one request from a laptop on day one, before writing the server code, to confirm field names and units. The fallback provider is checked the same day.
2. *How long to keep a price.* Decision: 8 hours. It keeps us near 90 requests a month and a price is never more than one working day old when someone calculates.
3. *Failure alerts.* Decision: `price-health.yml` fails when the prices are stale, and GitHub emails the repository owner. We also look at the status page every day of demo week.

#### M4: Accounts

**Dates:** Sun Nov 1 to Wed Nov 4 · **Estimate:** 4 days · **Stories:** S3.2, S3.3, S3.4, S3.6, and the account-feature criterion of S3.1 · **Also covers:** NFR4, NFR5, NFR9 (user counts)

**How it works.**

- Sign-in goes through our server. Routes under `/api/auth` call Supabase Auth from the server, which keeps the session in an HttpOnly cookie so no token reaches the page's scripts. Registration asks for an email and a password of at least 8 characters and nothing else. The account is not active until the user confirms the email, and they can ask for the message again. An email that already has an account is refused and pointed to sign-in (S3.2, Appendix A.16).
- A wrong email and a wrong password give the same "sign-in failed" message, with no hint which part was wrong. Signing out ends the session on the server (S3.3, Appendix A.17 and A.19).
- A reset link sent to the account's address lets the user set a new password. The old password stops working and every other device is signed out (S3.4, Appendix A.18).
- Deleting an account needs an explicit confirmation. The server then uses its secret key to remove the sign-in record and permanently removes the email, saved calculations, reminders, giving log and preferences (S3.6, Appendix A.19).
- The tables in Appendix B.1 are created now, each with row-level rules and a link to the user that deletes the row when the user is deleted. Only the server connects to the database, and the rules stay on as a second layer. Tables that later milestones fill (reminders, goals, gifts) clean up automatically.
- When an account is created, the app sends the browser's time zone name and the server stores it in `profiles`. Reminders in M6 depend on it.
- The four of us are rows in an `admins` table. An admin reads a user's data only by calling `admin_read_user_data`, which writes a log row with the admin and the time (NFR5, D11). A signed-in admin sees user and saved-calculation counts on the status page.
- A guest who opens reminders or the planner is told they need an account and offered registration (the last criterion of S3.1).

**Proving it works.**

- A two-user test script signs in as user A and tries to read, change and delete user B's data through every `/api` route. Every attempt must fail. The same test runs against the database with user A's rules alone, to prove the second layer.
- A sign-in with an unknown email and a sign-in with a wrong password show the identical message.
- The reset flow runs end to end: the old password fails and another signed-in session is signed out.
- We delete an account that has rows in every table and then query each table: no row for that user remains.
- An admin read creates exactly one log row, and a non-admin call fails.
- Confirmation and reset links are opened on a phone for a request made on a laptop.
- With the browser's network panel open, every request goes to our own address: no database address and no key appears.

**We'll know this milestone is complete when** all seven tests pass and a teammate registers, confirms from a real inbox, signs in, signs out, resets the password and deletes the account on their own phone.

**Unknowns.**

1. *Deleting the sign-in record.* Decision: the server does it with its secret key, so no extra database function or second service is needed.
2. *Links opened in a different browser.* Reports say Supabase's default email templates can fail when the link is opened in a different browser than the one that asked. Method: we test that case on Nov 2. If it fails, we switch to the token-hash link template.
3. *Email limits.* Supabase has its own per-hour limit on auth emails, separate from the sender's limit. Decision: after connecting Brevo we raise it in the dashboard and send 10 test emails to confirm.

#### M5: Saving and offline use

**Dates:** Tue Nov 3 to Fri Nov 6 · **Estimate:** 4 days · **Stories:** S4.1, S4.2, S3.5, S5.1, S5.2, S5.3 · **Also covers:** NFR2, NFR6

**How it works.**

- *Guests* tap "Save on this device", which stores the date, inputs, nisab choice, prices used and result in `localStorage` (Appendix B.3), says it lives only on this device, and lists it under "Saved on this device" (S4.1, Appendix A.11).
- *Signed-in users* tap "Save to my account", which sends the same fields to the server, and the server adds a row to `calculations` for that user (S4.2). If they are offline, they are told saving needs a connection, the calculation stays on screen, and they can save once they are back online (Appendix A.21).
- *Transfer.* After registering or signing in, a user with guest saves on the device is asked "Add them to your account?", and they are added only on yes, keeping their original inputs, results and nisab figures (S3.5, Appendix A.20).
- `vite-plugin-pwa` precaches the app files. The service worker answers `/api/prices` from the network first and falls back to the last response, and the app also copies the last good prices into `localStorage`.
- When offline, a banner says so (Appendix A.13). The calculator, explanations, definitions and disclaimer all work, and the result shows the age of the prices it used (S5.1, S5.3). Account features show the needs-a-connection message and nothing the user entered is lost (S5.2).
- A first-visit note says: open CharityFlow online once and it will work without internet; on iPhone, add it to the Home Screen so Safari keeps it.

**Proving it works.**

- In Chrome DevTools, set the network to offline after one visit and run the 20 cases. Results must equal the online results for the same inputs and prices.
- On a real iPhone and a real Android phone: visit once, switch on airplane mode, complete and save a guest calculation, close the browser, reopen it and find the saved calculation.
- Signed in and online, save a calculation and check that the row holds every field. Signed in and offline, check that the message appears and the calculation is not lost.
- Transfer: save two guest calculations, register, accept, and compare the two new rows with the originals. Repeat and decline: no rows are added.
- A test build times a result with `performance.now()`: under 1 second online and offline (NFR2).
- Deploy a new version while a phone holds the old one. It must update on the next visit without losing saved calculations.

**We'll know this milestone is complete when** both phone tests pass in airplane mode, a calculation made offline equals the same calculation made online to the cent, and the account save and transfer tests pass.

**Unknowns.**

1. *Update behavior.* `autoUpdate` reloads the page when a new version is found, which could wipe a half-finished form. Decision: we keep `autoUpdate` and keep the in-progress form in `sessionStorage`, restoring it after any reload. Method: on Nov 3 we update the site while a form is half filled and confirm the entries come back.
2. *Safari's 7-day limit.* Safari deletes a site's script-writable storage, including service worker caches, after 7 days of Safari use without visiting that site, and Home Screen web apps are not counted. We cannot remove the limit, so the first-visit note tells iPhone users what to do.

#### M6: Reminders

**Dates:** Thu Nov 5 to Sun Nov 8 · **Estimate:** 4 days · **Stories:** S6.1, S6.3, S6.4, S6.5, and the account-stored date in S1.10 · **Also covers:** NFR8

**How it works.**

- *Zakat date.* A settings screen lets a signed-in user set, change or remove their Zakat date (S6.1, Appendix A.22). We store the Gregorian date they entered and its Hijri month and day, because the date recurs on its Hijri date. The calculator pre-fills it for signed-in users (the last criterion of S1.10). When a user saves a calculation that carries a Zakat date, we ask them to confirm it as their annual date. No countdown is shown.
- *Four reminder types.* Zakat month, Ramadan, Friday and Dhul-Hijjah are all off until the user turns them on, and each can go in-app, by email or both. Turning one off stops it from the next occasion (S6.5).
- *The job.* An hourly GitHub Actions workflow calls `POST /api/jobs/reminders` with the secret job token, and the server runs the reminder code. For each user with a reminder on, it works out their local date from the stored time zone and their Hijri date with `Intl`. A Zakat-month reminder is due on any day of the Hijri month of their Zakat date and never if they have no Zakat date (S6.3). A Ramadan reminder is due every day of Ramadan, a Friday reminder every Friday, and a Dhul-Hijjah reminder on its first day (S6.4).
- *Once only.* After 9:00 local time, the job tries to insert a `reminders_sent` row for the user, type, channel and local date. A unique key makes a second attempt fail, so there is never more than one reminder per channel per day (S6.5, NFR8).
- *Delivery.* The app shows in-app reminders from that table (Appendix A.23). Email reminders go out through Brevo (Appendix A.24).
- *Testing without waiting.* The reminder code accepts a pretend date and time (`as-of`) and returns who would be reminded without sending anything.

**Proving it works.**

- Dry runs cover each type: Zakat month on every day of the month and not without a date, Ramadan every day, Friday only on Fridays, Dhul-Hijjah only on its first day, and nothing when a type is off.
- Running the job twice in one hour, and twice in one day, creates no duplicate.
- Two test users in different time zones each get their reminder on their own local date.
- A real in-app reminder and a real email reminder arrive for a test account.
- Turning a reminder off stops it from the next occasion.

**We'll know this milestone is complete when** every dry-run case passes, a real in-app and a real email reminder arrive on the right local date, a second run sends nothing, and the hourly workflow has run unaided at least twice.

**Unknowns.**

1. *Islamic month starts.* They can differ by a day between methods and from moon sighting. Decision: the MVP uses the calculated date, as the requirements specify, and the reminder code uses the same `Intl` method as the app so the two always agree.
2. *Late or dropped job runs.* GitHub's scheduler is best-effort. Decision: the job sends on its first run after 9:00 local time, so a delay does not lose a reminder. We test by skipping hours with the pretend date.
3. *Email limit.* Brevo's free plan sends 300 emails a day, far more than we need. If Brevo refuses a message the job logs it and the next run tries again.
4. *Time zone changes.* Requirements do not say what happens when someone travels. Decision: the settings screen refreshes the stored time zone from the browser whenever reminder settings are saved.

#### M7: Sadaqah planner

**Dates:** Thu Nov 5 to Sun Nov 8 · **Estimate:** 4 days · **Stories:** S8.1, S8.2, S8.3

**How it works.**

- *Goals.* A signed-in user can create any number of monthly or yearly goals, each with a name and an amount in US dollars, and change or remove them (S8.1, Appendix A.25). Removing a goal leaves logged gifts alone: they keep the goal's name as a label and stop counting toward any progress.
- *Gifts.* A user logs an amount, a date, and optionally a recipient, a note and one goal. They can edit or delete a gift (S8.2, Appendix A.26). Changing a gift's date moves it to the goal period of its new date. A gift with no goal counts toward none.
- *Progress.* For each goal the screen shows the total given this period, the amount remaining and whether it is met. A goal's streak is the number of consecutive completed periods in which the gifts currently logged reached its amount, recalculated after any edit or delete. A period that closes below the amount returns the streak to 0 (S8.3, Appendix A.27).
- The rules are plain functions in `src/planner/`, tested with Vitest, and periods follow the user's stored time zone.

**Proving it works.** Vitest cases: a gift exactly at the amount completes the period and one cent below does not; a closing period below the amount resets the streak; editing or deleting a past gift recalculates it; a date moved across a period boundary changes both periods; a removed goal's gifts keep their label and stop counting; and a gift with no goal counts toward none. The M4 two-user test is extended to goals and gifts.

**We'll know this milestone is complete when** every test passes and a teammate completes the walkthrough of S8.1 to S8.3 on a phone with a test account.

**Unknowns.**

1. *Where a goal's streak starts.* Decision: a streak counts only periods from the goal's creation date.
2. *What a period is.* Decision: calendar months and calendar years in the user's stored time zone.

### Timeline

We have 12 days from today (Thu Oct 29) to the first MVP demo day (Tue Nov 10), and this plan is due the same day. The build is done by Mon Nov 9.

#### Schedule

&#91;embedded content: MVP schedule, Oct 29 to Nov 10 · 8 milestones, 1 review\]

M1, M2 and M3 start together: two teammates build the engine while two build the form shell against it and the server's price route. M4 starts Nov 1 so accounts are ready before saving, reminders and the planner. M6 and M7 run side by side. The dashed line is demo day, which is also the day this plan is due.

## Risks

These are the things that could derail the project, most likely first.

| # | Risk | Category | What we do about it |
| --- | --- | --- | --- |
| R1 | Most of us are new to React, SQL, sign-in flows and running a server, so a milestone could take longer than planned | Personnel | The M0 exercise where everyone ships one change, the React Quick Start, pair work on the engine, the server and the access rules, small pull requests, and managed services instead of anything we host ourselves. The planner and reminders are built last, so a late milestone costs the least important work |
| R2 | We have no domain, so sign-up and reset emails could land in spam or not arrive, which blocks accounts and reminders | Dependency | Three test emails on Oct 30, a spam-folder note on the sign-up screen, demo accounts created in advance, and a message to Prof. Malstrom on Oct 31 if the tests fail |
| R3 | The price source is a single free provider whose limits, terms and response format could change or differ from what we read | Dependency | A fallback provider, an 8-hour cache that keeps the last good price, a first-day check of the real response, a fake provider for development, and the credit link the free tier requires |
| R4 | The free server sleeps when idle and has a monthly hour limit, so the site could be slow or unavailable during a demo | Cost | It wakes in about a minute, so we load it before every test session and demo, and the app shows a waking-up message. It is plain Node and Express, so it can move to another free host, and the Render dashboard shows the hours used against the 750 a month |

## References

**Project documents**

- [CharityFlow Requirements Document v0.3](https://claude.ai/artifact/Av2PxRAewYr5e9piwijTag): scope, story IDs, NFRs, decisions D1 to D12, and Appendix A (Zakat rules and worked examples)
- Software Pitch: Smart Zakat & Sadaqah (Charity) Planner (class submission)
- CISC 3171 Project, Requirements Doc and Project Plans assignment documents, and the Euchre with Friends Project Plan (the example this plan follows)

**Tools and platforms.** Checked on Oct 29, 2026. Only the MetalCharts and Render pages were opened in full. The others come from search results and are re-confirmed when we first depend on them: hosting and tooling in M0, prices in M3, accounts and email in M4.

- [MetalCharts free metals API](https://metalcharts.org/free-metals-api): 200 requests a month, 10 a minute, no card, credit link required, gold under `data.XAU`
- [MetalCharts silver price API](https://metalcharts.org/silver-price-api): quotes silver in US dollars per troy ounce
- [API Ninjas Metals Price API](https://api-ninjas.com/api/metalsprice): free key, last daily close on the free plan, commercial use not allowed on the free tier
- [Render free web services](https://render.com/free): 750 instance hours a month, sleeps after 15 minutes without traffic and wakes in about a minute
- [GitHub Actions scheduled workflows](https://cronuru.com/guides/github-actions-scheduled-workflows) and a [GitHub community thread](https://github.com/orgs/community/discussions/210657): delays, and disabling after 60 days without activity
- [Supabase pricing and limits](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/): the free plan's 2 projects, 500 MB, 50,000 monthly users and 7-day pause
- [Preventing Supabase free-tier pausing](https://runhooks.app/blog/preventing-supabase-free-tier-pausing/): why `pg_cron` stops when a project pauses
- [Supabase auth rate limits](https://supabase.com/docs/guides/auth/rate-limits): the built-in email limit applies until custom SMTP is set up
- [Supabase custom SMTP setup](https://docs.sequenzy.com/guides/supabase-custom-smtp) and a [comparison of free senders for Supabase](https://codenote.net/en/posts/supabase-auth-custom-smtp-comparison/): custom SMTP is available on the free plan, and Brevo has the largest free daily volume
- [Supabase authentication in production](https://makerkit.dev/docs/md/tanstack-supabase/going-to-production/authentication): the built-in sender's limits, and email links that fail in a different browser
- [Brevo free SMTP server](https://www.brevo.com/free-smtp-server) and [free SMTP servers compared](https://sendlayer.com/blog/best-free-smtp-servers/): 300 emails a day on the free plan
- [Vite getting started](https://v7.vite.dev/guide/) (scaffolding the React template), [Vitest guide](https://vitest.dev/guide/) and [vite-plugin-pwa auto-update guide](https://vite-pwa-org.netlify.app/guide/auto-update)
- [React Quick Start](https://react.dev/learn): the team's first-day reading
- [Safari's 7-day cap on script-writable storage](https://searchengineland.com/what-safaris-7-day-cap-on-script-writeable-storage-means-for-pwa-developers-332519) and [an explanation of home-screen exemptions](https://ionic.io/blog/?p=3240)
- [Islamic calendar variants in JavaScript's Intl.DateTimeFormat](https://lingo.dev/en/javascript-i18n/display-year-era-non-gregorian)

**Looked at and not used**

- [Firebase scheduled functions](https://firebase.google.com/docs/functions/schedule-functions): require the paid Blaze plan
- [Resend sending limits](https://resend.com/docs/knowledge-base/resend-sending-limits): 100 emails a day and 3,000 a month on the free plan, and a verified domain is needed to reach other people

## Appendix A: UI Wireframes

Low-fidelity layouts for every MVP screen, drawn for a phone held upright. They show what is on each screen and in what order, not final styling. Dollar amounts are shown as `$` because the real values come from the user's entries and the day's prices. When a signed-in user is on A.8, A.9 or A.14, the save button reads "Save to my account" instead of "Save on this device".

### A.1 to A.3: Home and the first two steps

Home has one main action. Steps 1 and 2 collect cash, metals, investments and crypto.

&#91;embedded content: Wireframes A.1 to A.3 · Home, step 1, step 2\]

### A.4 to A.6: Last two steps and the nisab choice

Steps 3 and 4 collect property, business, retirement and debts. The nisab choice comes before any result is shown.

&#91;embedded content: Wireframes A.4 to A.6 · steps 3 and 4, nisab choice\]

### A.7 to A.9: Zakat date and the result

The result always carries the price time, a reason for each line and the disclaimer.

&#91;embedded content: Wireframes A.7 to A.9 · Zakat date, result due, result not due\]

### A.10 to A.12: Terms, saved calculations and status

These are reachable from Home. Saved calculations are stored only on the device.

&#91;embedded content: Wireframes A.10 to A.12 · terms, saved calculations, status\]

### A.13 to A.15: Offline, old prices and no prices

These three states replace or sit on top of the normal screens.

&#91;embedded content: Wireframes A.13 to A.15 · offline, old prices, no prices\]

### A.16 to A.18: Create account, sign in, reset password

An account needs only an email address and a password. A failed sign-in never says which one was wrong.

&#91;embedded content: Wireframes A.16 to A.18 · create account, sign in, reset password\]

### A.19 to A.21: Account, adding saved calculations, needs a connection

Signing out, deleting an account, moving guest saves into an account, and the message shown when something needs the internet.

&#91;embedded content: Wireframes A.19 to A.21 · account, add saved calculations, needs a connection\]

### A.22 to A.24: Reminder settings, in-app reminders, reminder email

Every reminder is off until the user turns it on, and each can go in-app, by email or both.

&#91;embedded content: Wireframes A.22 to A.24 · reminder settings, in-app reminders, reminder email\]

### A.25 to A.27: Giving goals, logging a gift, progress

Goals can be monthly or yearly. Progress and streaks come from the gifts the user has logged.

&#91;embedded content: Wireframes A.25 to A.27 · goals, log a gift, progress\]

## Appendix B: Data Schemas and Contracts

### B.1 Database tables and access rules

The Supabase database holds accounts and each signed-in user's own saved data. Only our server connects to it, using the secret key kept in the host's settings. The browser never does, and guests have nothing on any server. Email addresses and passwords are kept in Supabase's own sign-in tables, not ours. Every table with a `user_id` removes its rows when that user is deleted (S3.6).

| Table | Columns | Rows |
| --- | --- | --- |
| `profiles` | `user_id` (uuid, primary key), `time_zone` (text, an IANA name such as `America/New_York`), `zakat_date` (date, null), `zakat_hijri_month` (1 to 12, null), `zakat_hijri_day` (1 to 30, null), `created_at` | One per user |
| `calculations` | `id` (uuid, primary key), `user_id`, `saved_at` (timestamp), `zakat_date` (date, null), `nisab_choice` (`gold` or `silver`), `inputs` (JSON, B.4), `prices_used` (JSON), `result` (JSON, B.4) | Many per user |
| `reminder_prefs` | `user_id`, `type` (`zakatMonth`, `ramadan`, `friday` or `dhulHijjah`), `enabled` (default false), `in_app` (default false), `email` (default false). Primary key: `user_id` and `type` | Up to four per user |
| `reminders_sent` | `user_id`, `type`, `channel` (`inApp` or `email`), `local_date` (date), `created_at`, `read_at` (null). Primary key: `user_id`, `type`, `channel` and `local_date` | Many per user |
| `goals` | `id`, `user_id`, `name`, `amount_cents` (above 0), `period` (`monthly` or `yearly`), `created_at` | Many per user |
| `gifts` | `id`, `user_id`, `amount_cents` (above 0), `given_on` (date), `recipient` (null), `note` (null), `goal_id` (null, and set to null when its goal is removed), `goal_label` (null, filled with the goal's name when the goal is removed), `created_at` | Many per user |
| `admins` | `user_id` (primary key) | Four in total |
| `admin_access_log` | `id`, `admin_id`, `subject_user_id` (null after that user is deleted), `accessed_at`, `action` (text) | One per admin read |
| price\_cache | id (always 1), gold\_usd\_per\_gram, silver\_usd\_per\_gram, fetched\_at, source (metalcharts or api-ninjas), last\_attempt\_at, last\_attempt\_ok, last\_attempt\_note (B.2) | One in total |

### **Access rules**

- Our server checks the signed-in user on every route and reads or writes only rows for that user's id. As a second layer, the database rules on `profiles`, `calculations`, `reminder_prefs`, `goals` and `gifts` let a user read, add, change and delete only rows where `user_id` is their own id.
- On `reminders_sent`, a user can read their own rows and mark them read. Only the reminder code on our server adds rows.
- `admins`, `admin_access_log` and `price_cache` cannot be read or written by a signed-in user. Only our server touches them.
- `admin_read_user_data(subject)` is a database function that checks the caller is in `admins`, writes a row to `admin_access_log` with the admin and the time, and then returns the subject's rows. It is the only admin path to user data (NFR5, D11).
- The browser holds no database address and no key. The Supabase secret key lives only in the host's settings and is never sent to the app.
- The two-user test from M4 runs against every table.

### B.2 Price response

Returned by `GET /api/prices` and stored in the `price_cache` table. The app keeps the last copy in `localStorage`.

| Field | Type | Meaning |
| --- | --- | --- |
| `schemaVersion` | number | Always 1 for the MVP |
| `goldUsdPerGram` | number | US dollars per gram of gold, up to 4 decimals |
| `silverUsdPerGram` | number | US dollars per gram of silver, up to 4 decimals |
| `fetchedAt` | string, ISO 8601 UTC | When these prices were retrieved from the source (S12.2) |
| `source` | string | `metalcharts` or `api-ninjas` |
| `lastAttemptAt` | string, ISO 8601 UTC | When the workflow last tried to fetch |
| `lastAttemptOk` | boolean | Whether that attempt retrieved new prices |
| `lastAttemptNote` | string or null | A short reason when `lastAttemptOk` is false |

```json
{
  "schemaVersion": 1,
  "goldUsdPerGram": 134.34,
  "silverUsdPerGram": 1.96,
  "fetchedAt": "2026-10-29T06:00:12Z",
  "source": "metalcharts",
  "lastAttemptAt": "2026-10-29T06:00:12Z",
  "lastAttemptOk": true,
  "lastAttemptNote": null
}
```

The numbers above are the illustrative prices from Requirements Appendix A.2, not real quotes.

- Both prices must be numbers above 0. The server also rejects gold outside 20 to 1,000 and silver outside 0.2 to 100 US dollars per gram. That is a sanity band we chose to catch bad data, not a claim about the market.
- `fetchedAt` changes only when new prices were retrieved. `lastAttemptAt` changes on every attempt to retrieve them.
- Prices are stale when the current time minus `fetchedAt` is over 24 hours (S12.3). If the server has never stored a valid price and `localStorage` holds no earlier copy, the app shows no result (S12.4).

### B.3 Browser storage

| Key in `localStorage` | Holds | Written when |
| --- | --- | --- |
| `cf.v1.saved` | A list of saved calculations, newest first | The user taps "Save on this device" (S4.1) |
| `cf.v1.prices` | The last valid `price` response the app received from the server | Each successful response |
| `cf.v1.firstVisitNoteDismissed` | `true` once the first-visit note is dismissed | The user dismisses it |

Each saved calculation holds:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | A random unique id |
| `savedAt` | string, ISO 8601 UTC | When it was saved |
| `zakatDate` | object | `gregorian` as `YYYY-MM-DD` and `hijri` as the displayed Hijri date |
| `inputs` | object | The engine inputs (B.4) |
| `nisabChoice` | string | `gold` or `silver` |
| `pricesUsed` | object | `goldUsdPerGram`, `silverUsdPerGram` and `fetchedAt` |
| `result` | object | The engine result (B.4) |

Nothing else is stored: no names, no emails and no identifiers (NFR4, NFR6).

### B.4 Calculation engine contract

`calculateZakat(inputs, prices)` returns a result object. Money is whole cents as integers. Percentages are numbers from 0 to 100.

| Input field | Shape | Default when blank |
| --- | --- | --- |
| `cashCents`, `savingsCents` | integer, 0 or more | 0 |
| `gold`, `silver` | `{ grams, valueCents }`, enter one of the two | 0 |
| `gems` | list of `{ valueCents, purpose }`, purpose `personal` or `resale` | empty |
| `securities` | list of `{ valueCents, purpose, zakatableSharePct, countInFull }`, purpose `trade` or `longTerm` | share 30, `countInFull` false |
| `crypto` | list of `{ valueCents, purpose }` | empty |
| `realEstateForSale` | list of `{ valueCents }` | empty |
| `rentals` | list of `{ rentCollectedUnspentCents, expensesPaidCents }` | empty |
| `businesses` | list of `{ ownershipPct, cashCents, inventoryCents, receivablesCents, liabilitiesCents }` | ownership 100 |
| `retirement` | list of `{ vestedBalanceCents, method, zakatableSharePct, penaltyTaxCents }`, method `annual` or `whenAccessible` | share 100, penalty 0 |
| `debts` | `{ dueNowCents, installments12mCents }` | 0 and 0 |
| `nisab` | `gold` or `silver` | none: no result until set |
| `heldOneLunarYear` | boolean, the answer to the S1.10 question | none: no result until set |
| `zakatDate` | `YYYY-MM-DD` | none. It is stored with the result and does not change the amount |

`prices` is `{ goldUsdPerGram, silverUsdPerGram, fetchedAt }`.

| Result field | Shape |
| --- | --- |
| `ok` | `true`, or `false` with `errors` |
| `lines` | list of `{ category, valueCents, treatment, reasonKey }`, treatment `full`, `reduced` or `excluded` |
| `totalZakatableCents`, `netCents` | integers. Net is never below 0 |
| `debtsSubtracted` | `{ dueNowCents, installments12mCents }` |
| `nisab` | `{ choice, grams, pricePerGram, valueCents }` |
| `status` | `due`, `belowNisab` or `notYetDue` |
| `zakatDueCents` | integer, 0 unless `status` is `due` |
| `pricesUsed` | the prices passed in |
| `errors` | list of `{ field, code }`, code `negative`, `notANumber` or `missingPrice` |

Rules the engine applies: a value computed from grams, a percentage or an ownership share rounds to the nearest cent, halves up, when computed. Zakat due is net wealth times 2.5%, rounded once. `status` is `notYetDue` when `heldOneLunarYear` is false, `belowNisab` when net is below the nisab value, and `due` otherwise.

### B.5 Calculation flow

&#91;embedded content: Calculation flow · 8 screens, 1 decision, 2 outcomes\]

The form steps can be revisited in any order before the result. Only the final decision changes the outcome, and the screens match Appendix A.

### B.6 Test case format

The 20 cases we send Mufti Ahmad, and every engine test, use one format so he can read them. This is Requirements Appendix A.6, example 1.

```json
{
  "name": "A.6 example 1, silver nisab",
  "inputs": {
    "cashCents": 300000,
    "gold": { "grams": 51, "valueCents": null },
    "nisab": "silver",
    "heldOneLunarYear": true
  },
  "prices": { "goldUsdPerGram": 134.34, "silverUsdPerGram": 1.96, "fetchedAt": "2026-10-29T06:00:00Z" },
  "expected": { "netCents": 985134, "nisabValueCents": 120023, "zakatDueCents": 24628, "status": "due" }
}
```

### B.7 Server routes, scheduled jobs and email

The browser calls only these routes on our server.

| Route | Who can call it | What it does |
| --- | --- | --- |
| `GET /api/prices` | Anyone | Returns the stored prices, and fetches new ones first when they are over 8 hours old (B.2) |
| `POST /api/auth/register`, `/login`, `/logout`, `/reset` | Anyone | Sign-up, sign-in, sign-out and password reset through Supabase Auth. Sets or clears the session cookie |
| `GET`, `POST`, `DELETE /api/calculations` | Signed-in user | Lists, saves and deletes that user's own saved calculations |
| `GET`, `PUT /api/profile` and `/api/reminder-prefs` | Signed-in user | Zakat date, time zone and reminder settings |
| `GET`, `POST`, `PUT`, `DELETE /api/goals` and `/api/gifts` | Signed-in user | Giving goals and gifts |
| `GET /api/reminders`, `POST /api/reminders/read` | Signed-in user | In-app reminders and marking them read |
| `DELETE /api/account` | Signed-in user | Deletes the account and all its rows after the user confirms |
| `GET /api/admin/users/:id` | Admin | Calls `admin_read_user_data`, which logs the read |
| `POST /api/jobs/reminders` | The hourly workflow, with the job token | Runs the reminder code |

| Job | Runs | Reads | Writes | Counts as failed when |
| --- | --- | --- | --- | --- |
| Reminder job | Hourly, from a GitHub Actions workflow that calls `POST /api/jobs/reminders` | `profiles`, `reminder_prefs`, `reminders_sent` | `reminders_sent`, and email through Brevo | A run ends in an error. The next run tries again |
| Price check | Twice a day, from `price-health.yml`, which calls `GET /api/prices` | `price_cache`, and the price APIs when the stored price is over 8 hours old | `price_cache` | The last successful fetch is over 24 hours old |

The reminder job works like this:

1. Load every user with at least one reminder type enabled, with their stored time zone.
2. For each user, work out the local date and time and the Hijri date for that time zone with `Intl.DateTimeFormat`.
3. Skip the user if their local time is before 9:00.
4. Decide which enabled types are due. Zakat month is due when the Hijri month equals the stored `zakat_hijri_month`. Ramadan is due when the Hijri month is 9. Friday is due when the local weekday is Friday. Dhul-Hijjah is due when the Hijri month is 12 and the day is 1.
5. For each enabled channel of a due type, insert a `reminders_sent` row. If the key already exists, do nothing. If the row was inserted and the channel is email, send the message through Brevo.
6. `--as-of <date and time>` replaces "now" and prints what would happen without writing or sending.

Reminder emails come from the verified Brevo sender, with a subject like "Ramadan reminder" and a body like Appendix A.24. They contain no financial figures. Sign-up confirmation and password-reset emails are sent by Supabase Auth through the same Brevo sender.

The reminder job sends each email to Brevo as one request with these fields. The field names follow Brevo's transactional email request and are confirmed against its documentation in M0.

```json
{
  "sender": { "name": "CharityFlow", "email": "the verified sender address" },
  "to": [ { "email": "the user's email address" } ],
  "subject": "Ramadan reminder",
  "textContent": "It is Ramadan. A small gift today counts."
}
```

The request carries the Brevo key in a header. It contains no financial figures, and the key lives only in GitHub secrets.

### B.8 Account states

&#91;embedded content: Account states · 5 states\]

A guest becomes a user only by registering and confirming the email. Deleting is allowed only from the signed-in state and cannot be undone.

### B.9 Where this appendix is used

| Section | Used by |
| --- | --- |
| B.1 Database tables and access rules | M3 price cache, M4 accounts, M5 saving, M6 reminders, M7 planner |
| B.2 Price response | M3 price route, M5 offline copy |
| B.3 Browser storage | M5 guest saves and offline use |
| B.4 Engine contract, B.6 test cases | M1 engine, M2 screens |
| B.5 Calculation flow | M2 screens |
| B.7 Server routes, jobs and email | M3 price route, M4 to M7 |

## Appendix C: Traceability

This appendix lists the 37 stories built in this MVP and the milestone that builds each. A story that no milestone names is a story nobody is building, so this is how we check.

### C.1 Stories built in this MVP (37)

| Story | What the user can do | Built in | Proven by |
| --- | --- | --- | --- |
| S1.1 | Enter cash and savings | M1, M2 | Engine tests and the 20-case run through the screens |
| S1.2 | Enter gold, silver and gemstones | M1, M2, M3 | Engine tests, the 20-case run, and a check against live prices |
| S1.3 | Enter stocks, funds and ETFs | M1, M2 | Engine tests and the 20-case run |
| S1.4 | Enter cryptocurrency | M1, M2 | Engine tests and the 20-case run |
| S1.5 | Enter real estate held for sale | M1, M2 | Engine tests and the 20-case run |
| S1.6 | Enter rental properties | M1, M2 | Engine tests and the 20-case run |
| S1.7 | Enter business assets | M1, M2 | Engine tests and the 20-case run |
| S1.8 | Enter personal debts | M1, M2 | Engine tests and the 20-case run |
| S1.9 | Choose the nisab | M1, M2, M3 | Engine tests, the nisab step, and a switch without re-entry |
| S1.10 | Set my Zakat date | M1, M2, M6 | Engine tests, the date step in two browsers, and the pre-filled account date |
| S1.11 | See my Zakat result | M1, M2, M3 | The A.6 examples, the 20 cases, and the price time on the result |
| S1.12 | Enter retirement accounts | M1, M2 | Engine tests for both methods and the 20-case run |
| S2.1 | Understand each line of my result | M2 | Every category above $0 shows an explanation |
| S2.2 | Know the result is not a ruling | M2 | The disclaimer appears on every result |
| S2.3 | Learn the terms | M2 | Definitions reachable from Home and from the result |
| S3.1 | Use the app as a guest | M2, M4 | A full calculation with no sign-in, and a guest who opens an account feature is offered registration |
| S3.2 | Create an account | M4 | Registration, confirmation email, a duplicate email refused |
| S3.3 | Sign in and out | M4 | The same message for a wrong email or password, and sign-out removes access |
| S3.4 | Recover access | M4 | The reset flow end to end, the old password fails, other devices are signed out |
| S3.5 | Keep my guest calculations | M5 | Transfer test: accepting adds them, declining adds none |
| S3.6 | Delete my account and data | M4 | Deleting an account with rows in every table leaves none |
| S4.1 | Save as a guest | M5 | Save, close, reopen offline and find it |
| S4.2 | Save to my account | M5 | The row holds every field, and the offline message appears |
| S5.1 | Calculate with no connection | M5 | The 20 cases offline equal the 20 cases online |
| S5.2 | Be told when something needs the internet | M5 | The offline banner and the needs-a-connection screen, with nothing lost |
| S5.3 | Use current prices after reconnecting | M5 | The next calculation after reconnecting uses newer prices |
| S6.1 | Set my Zakat date | M6 | Set, change and remove it, and see it pre-filled in the calculator |
| S6.3 | Get reminders during my Zakat month | M6 | Dry runs: every day of the month, none without a date |
| S6.4 | Get reminders for meaningful times of year | M6 | Dry runs for Ramadan, Fridays and Dhul-Hijjah |
| S6.5 | Choose how I am reminded | M6 | All off by default, channels chosen separately, no duplicate in a day |
| S8.1 | Set giving goals | M7 | Tests for create, change and remove, with gifts kept |
| S8.2 | Log a gift | M7 | Tests for edit, delete and a date moved across periods |
| S8.3 | Track progress toward my goals | M7 | Progress and streak tests |
| S12.1 | Use live prices for the nisab and gold and silver values | M3 | A workflow run and the prices on the live site |
| S12.2 | See how current the prices are | M3 | The retrieval time on every result |
| S12.3 | Be warned about old prices | M3 | A 25-hour-old copy shows the warning |
| S12.4 | See what happens when prices cannot be retrieved | M3 | The missing-price drill shows no result |

### C.3 Non-functional requirements

| NFR | Requirement | Where it is met | In the MVP |
| --- | --- | --- | --- |
| NFR1 | Calculation accuracy | M1 tests, M2 case run | Yes |
| NFR2 | Calculation speed | M1 speed test, M5 timing online and offline | Yes |
| NFR3 | Device and browser support | M2 at 360 px, and a check in Chrome, Safari, Firefox and Edge before the demo | Yes |
| NFR4 | Data minimization | M2 and M4. Guests give nothing, and accounts give only an email address and a password | Yes |
| NFR5 | Data access | M4 server checks, row-level rules and the logged admin function, with the two-user test | Yes |
| NFR6 | Guest privacy | M2 network check and the M5 privacy check | Yes |
| NFR8 | Reminder delivery | M6 job, once per type, channel and local day | Yes |
| NFR9 | Operational monitoring | M3 price health and 24-hour alert, M4 counts for admins | Yes |

### C.4 Decisions from v0.3

D1 to D7, D10, D11 and D12 govern the MVP. For the start of an Islamic month, the MVP uses the calculated Hijri date, which is what S1.10 and S6.3 to S6.5 specify.
