# Supabase: shared data for balancethebudget.us

The public site is static (GitHub Pages), so shared features need a small backend: votes counted
across everyone, "how everyone played", short links for shared plans, and rankings of plans,
policy cards, and states (never of people). Supabase provides the database and anonymous sign-in.
The claude.ai copy of the game keeps using the artifact's own database.

**Status:** connected. Project `ygphfbeqgguypvmiundz`; the site's URL and publishable key are in
[`src/lib/backend.ts`](../src/lib/backend.ts). Only balancethebudget.us talks to the database: local
builds, previews, and forks stay offline unless `localStorage["ftd:backend"] = "on"` is set for
testing. Players sign in anonymously only when there is something to save (a vote or a finished
level), never just for visiting. CAPTCHA protection (Cloudflare Turnstile) is on: sign-ins without
a valid, unused token are refused (checked: no token, Cloudflare's test token, and a made-up token
are all refused, and a real browser sign-in succeeds). Daily Dollar reminders are set up (the
daily-reminders function, its secrets, and the hourly Cron job): the first device opted in and
received the "reminders are on" message on November 6, 2026.

## What is stored

| Table | One row per | Holds | Who can read it |
| --- | --- | --- | --- |
| `ballots` | player | support/oppose on cards, answers to the big questions (and a favorite ready-made plan from earlier versions, no longer asked), and, only if the player chooses to save it in mission 1.4, their ZIP code and its state | only that player |
| `players` | player | levels done, stars, first-try quiz results, medals, state (if picked), first-visit channel | only that player |
| `plans` | finished budget-desk plan | the plan part of the link, cards, stars | only its creator; others open one by its short-link id |
| `rooms` | room | 6-character code, name, the budget-desk level it plays | only its starter; others open it by its code |
| `room_members` | member per room | joined time and the member's latest plan for the room's level (cards, stars) | only that member |
| `share_counts` | day × kind of link × channel | how many shares were made and shared links opened (no identities) | nobody directly; written and read only through functions |
| `push_subscriptions` | device that turned on Daily Dollar reminders | its push address and keys (no name or email), the hour and time zone picked, the last day a reminder went out | only that player; the sender reads it with the service key |
| `reminder_counts` | day | how many reminders were sent (no identities) | nobody directly; read through `reminder_stats()` |
| `challenge_steps` | day × step | how many friends took a challenge, met the goal, and sent a plan back (no identities) | nobody directly; written and read only through functions |
| `peoples_moves` | player per day | today's People's Budget move: one card, pushed in (+1) or out (-1) | only that player; only today's move can be changed or taken back |

Everyone can read totals through functions that return counts only: `ballot_totals()`,
`player_totals()`, `card_rankings(level)`, `state_rankings()` (states with 5+ players),
`ballot_area_totals()` (votes on ballots that carry a ZIP, grouped by state and by 3-digit ZIP
area, only for groups of 10 or more; never a ZIP), and
`get_plan(id)`, `peoples_budget(window_days)` (each card's net pushes over the last 30 days) and
`peoples_recent(n)` (the latest moves, with no identity), `get_room(code)` and `room_totals(code)`
(cards in members' plans, levels finished, and, once 3 have joined, how members voted), and
`share_stats(window_days)` (shares, opened links, and new players by channel and kind of link,
and the friend-challenge funnel; `count_share()`, `count_arrival()` and `count_challenge_step()`
add to it), and `reminder_stats(window_days)` (devices with Daily Dollar reminders on, reminders sent). Players sign in anonymously: no email,
no name, no password.

## Setup (about 10 minutes)

1. **Create the project.** At [supabase.com](https://supabase.com), sign in, then **New project**.
   Name it `help-uncle-sam`, set a database password (keep it in a password manager; nobody else
   needs it), pick the region **East US (North Virginia)**, and start on the **Free** plan.
2. **Allow anonymous sign-ins.** In the project: **Authentication → Sign In / Providers →
   Allow anonymous sign-ins**, then save.
3. **Create the tables.** Open **SQL Editor → New query**, paste each file in
   [`migrations/`](migrations/) in order, and **Run** each one:
   [`20261106000000_init.sql`](migrations/20261106000000_init.sql), then
   [`20261106010000_rankings.sql`](migrations/20261106010000_rankings.sql), then
   [`20261107000000_peoples_budget.sql`](migrations/20261107000000_peoples_budget.sql), then
   [`20261108000000_rooms.sql`](migrations/20261108000000_rooms.sql), then
   [`20261109000000_share_stats.sql`](migrations/20261109000000_share_stats.sql), then
   [`20261110000000_challenge_funnel.sql`](migrations/20261110000000_challenge_funnel.sql), then
   [`20261111000000_daily_reminders.sql`](migrations/20261111000000_daily_reminders.sql), then
   [`20261112000000_ballot_zip.sql`](migrations/20261112000000_ballot_zip.sql). Each is safe to
   run again. (The game already saves an opted-in ZIP inside the ballot, so the last one only adds
   format checks and the area totals; until it runs, the game says area results come later.)
4. **Copy two public values** from **Connect** (top of the dashboard) or **Settings → API Keys**:
   - the **Project URL**, like `https://abcdefghijklmnop.supabase.co`
   - the **publishable key**, starting `sb_publishable_`

   Both are meant to be public: they go in the website, and row-level security decides what
   each visitor can do. **Never share or commit the secret key (`sb_secret_…`) or the database
   password.**
5. **Turn on CAPTCHA (Cloudflare Turnstile).** Supabase recommends it with anonymous sign-ins,
   because otherwise a script could create accounts in bulk.
   1. The widget exists (site key `0x4AAAAAAF1rV7BXsS9-nG51`, domain `balancethebudget.us`); the
      game already sends a fresh token with every anonymous sign-in
      ([`src/lib/turnstile.ts`](../src/lib/turnstile.ts)).
   2. In the Cloudflare dashboard, open **Turnstile**, select the widget, and copy its
      **secret key**.
   3. In Supabase: **Authentication → Attack Protection → Enable CAPTCHA protection**, choose
      **Turnstile**, paste the secret key, and save. Supabase Auth then calls Cloudflare's
      siteverify on the server for each sign-in and refuses any without a valid, unused token.
      The secret lives only there: never in this repository, the site, or a chat.

   Supabase also limits anonymous sign-ins per IP address; the limit is under
   **Authentication → Rate Limits**. Copies of the game away from the real domain use
   Cloudflare's test site key, so they can't sign in once CAPTCHA is on; that is intended.

## Daily Dollar reminders (Web Push)

Players can turn on one notification a day, at an hour they pick, when a new Daily Dollar is
ready (settings, or the Daily Dollar's finished screen). No new server: the sender is a Supabase
Edge Function, [`functions/daily-reminders/index.ts`](functions/daily-reminders/index.ts) (one file,
no dependencies; it encrypts and signs each message itself with Web Crypto), and Supabase Cron runs
it every hour. On iPhone and iPad, notifications work only after the game is added to the home
screen (iOS 16.4 or later); on Android and desktop they work in the browser.

The game hides the reminder switch until the function answers, so nothing changes for players
until these steps are done. About 15 minutes:

1. **Create the table.** In **SQL Editor → New query**, paste
   [`migrations/20261111000000_daily_reminders.sql`](migrations/20261111000000_daily_reminders.sql)
   and **Run**.
2. **Make the keys, on your computer** (needs [Node.js](https://nodejs.org)):
   ```bash
   npx web-push generate-vapid-keys
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   The first prints a **Public Key** and a **Private Key** (the site's Web Push keys, called VAPID
   keys); the second prints a random **cron secret**. Keep all three in your password manager.
   Never paste the private key or the cron secret into a chat, an issue, or the repository.
3. **Save four secrets for the function.** Open **Edge Functions → Secrets**
   ([direct link](https://supabase.com/dashboard/project/ygphfbeqgguypvmiundz/functions/secrets)),
   enter each **Key** and **Value**, then **Save**:

   | Key | Value |
   | --- | --- |
   | `VAPID_PUBLIC_KEY` | the Public Key from step 2 |
   | `VAPID_PRIVATE_KEY` | the Private Key from step 2 |
   | `VAPID_SUBJECT` | `https://balancethebudget.us` (push services contact this site if there's a problem) |
   | `CRON_SECRET` | the cron secret from step 2 |

   The function finds the project's own URL and secret key by itself; don't add any `SUPABASE_`
   secrets (Supabase reserves that prefix).
4. **Create the function.** **Edge Functions → Deploy a new function → Via Editor.** Name it
   exactly `daily-reminders`. Replace all of the template's code with the whole of
   [`functions/daily-reminders/index.ts`](https://raw.githubusercontent.com/richnguyen/help-uncle-sam-balance-the-budget/main/supabase/functions/daily-reminders/index.ts),
   then click **Deploy function**.
5. **Let the site and Cron call it without a sign-in token.** On the function's page, open its
   settings and switch off **JWT verification** (the "Verify JWT" switch). The function checks its
   own callers instead: the hourly run must carry the cron secret, and a browser can only fetch the
   public key or ask for one "reminders are on" message for a device that opted in minutes ago.
   With the CLI instead of the dashboard:
   `supabase functions deploy daily-reminders --no-verify-jwt --project-ref ygphfbeqgguypvmiundz`.

   **Check:** open <https://ygphfbeqgguypvmiundz.supabase.co/functions/v1/daily-reminders> in a
   browser. You should see `{"publicKey":"B…"}` with your public key. A 401 or "missing
   authorization" message means step 5 isn't done yet; `{"error":"not set up"}` means a secret from
   step 3 is missing or misspelled.
6. **Schedule it.** In **SQL Editor → New query**, paste
   [`setup/daily-reminders-schedule.sql`](setup/daily-reminders-schedule.sql), replace
   `PASTE-THE-SAME-CRON-SECRET` with your cron secret, and **Run** it once. It turns on the
   scheduler (pg_cron) and the database's HTTP client (pg_net) if they're off, keeps the secret in
   Vault, and schedules the job `daily-dollar-reminders` at five past every hour. You can see it
   and its runs under **Integrations → Cron**.
7. **Try it on your phone.** Open balancethebudget.us (on iPhone: **Download the game** at the top
   of the settings menu first, then open the game from the home screen). In settings, turn on
   **Remind me about the Daily Dollar** and allow notifications. Within a few seconds you should get
   **"Reminders are on"**: that one message proves the keys, the function, and the database all
   work. To see the daily one without waiting, pick the current hour in the same menu, then run the
   hourly call yourself in the SQL Editor:
   ```sql
   select net.http_post(
     url := 'https://ygphfbeqgguypvmiundz.supabase.co/functions/v1/daily-reminders',
     headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret',
       (select decrypted_secret from vault.decrypted_secrets where name = 'daily_reminders_cron_secret')),
     body := '{}'::jsonb, timeout_milliseconds := 60000);
   -- a few seconds later:
   select status_code, content from net._http_response order by created desc limit 1;
   ```
   The answer looks like `{"due":1,"sent":1,"gone":0,"failed":0}`, and the reminder arrives.

**If something's off:** the function's **Logs** tab shows each run; **Integrations → Cron** shows
each hourly call; `net._http_response` holds the function's answers. **To pause reminders:**
`select cron.unschedule('daily-dollar-reminders');` (players keep their settings; run step 6's
`cron.schedule` part again to resume). The share stats page shows devices with reminders on,
reminders sent, and how many were opened.

**Limits:** at most one reminder a day per device; up to 2,000 devices per hourly run (well within
the Free plan's Edge Function and database limits); a device the push service reports as gone is
removed. The sender is tested locally under Deno against stand-ins for the database and the push
services, with every message decrypted by an independent Web Push library.

## Checking the schema locally

`npm run test:db` runs the migration in PGlite (Postgres compiled to WebAssembly) with stand-ins
for Supabase's auth schema, and checks the row-level security rules and every totals function.

## Costs and limits

The Free plan covers 500 MB of database, 50,000 monthly active users (each anonymous player counts),
and two projects; a Free project pauses after a week without activity. Pro is $25 a month when
the game outgrows that. Check [supabase.com/pricing](https://supabase.com/pricing) for current
numbers. Each player's rows are small (well under 10 KB), so 500 MB holds tens of thousands of
players. At larger scale, the totals functions should read from a summary table refreshed every
few minutes instead of counting every row on each call.

## Short links

A finished budget-desk plan is stored once (cards, across-the-board changes, phase-in, stars) and
gets a 12-character id, so shared links read `balancethebudget.us/?plan=58c5dc193efb&by=Sam`. The
sharer's first name and their answers to the big questions stay in the link (`by=`, `b=`) and are
never stored. Each player's latest plan on a level feeds "the cards players reach for". If the
database can't be reached, links fall back to the long form, which carries the whole plan and
works with no server.
