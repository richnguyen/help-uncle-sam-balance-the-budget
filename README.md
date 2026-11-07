# Help Uncle Sam Balance the Budget

A plain-language web app that shows average voters where U.S. federal tax money goes: spending by
purpose and by every agency account, revenue by source, the structural gap between autopilot
spending and revenue, the debt and interest, the laws that changed deficits, how Congress actually
budgets, federal money in each state and congressional district, Social Security's trust fund
timeline, a personal tax receipt, and a balance-the-budget sandbox.

Every number comes from an official U.S. government source and every chart links to its dataset.

**Play it:** https://balancethebudget.us/
(repository: [richnguyen/help-uncle-sam-balance-the-budget](https://github.com/richnguyen/help-uncle-sam-balance-the-budget);
the old address, richnguyen.github.io/help-uncle-sam-balance-the-budget, forwards there)

## The game

The site opens as a civic game: **Help Uncle Sam balance the budget.** Uncle Sam is an everyday
American with a very big household who spends more than he brings in. The player is his
budget adviser.

- **Ten levels on one road map.** Chapters explain one part of the budget each: his paycheck,
  his bills, back home, the structural gap, the credit card (debt), who writes the budget
  (Congress and the laws that moved deficits), and keeping his promises (Social Security).
  Three **budget-desk levels** (5, 8 and 10) are the hard "wall" levels, where the player fixes
  the budget with CBO-priced options. Each keeps a thin scoreboard pinned at the top while the
  player scrolls through policy cards, each linked to the closest real proposal in Congress.
  There are no plans to copy: the player works the plan out. Only the first desk level (5) has a
  hint, to ease the jump from the easy levels: Uncle Sam marks one card that would help (the
  gentlest one that would finish the job on its own), or, once the goal is met, says what earns
  the next star; the player still plays it. Elsewhere the star tips say what earns each star,
  never which card to play; when the cards alone can't reach the goal, the across-the-board
  changes sit right under them. There are no ready-made plans to load or pick
  from; a finished plan is matched to the closest real budget proposal on a shared plan's page and
  in the Budget Story. Difficulty runs in a rhythm: easy, easy, easy, medium, hard, then a
  breather, and so on up to a final super-hard level.
- **Guesses, steps, checks and votes.** Each chapter is 4–6 short steps (at most about 80 words
  each) with a segmented progress bar. Most chapters open with a guess, asked before the step
  that shows the answer: one pick, then the answer and why, and it never counts toward stars.
  Quick checks come after the lesson, give explanatory feedback, and reveal the answer after two
  tries; stars count only those (three for right the first time, two for right on the second try).
  Each chapter ends with one vote on a real policy choice. Level 7 lists the major laws, and
  tapping one explains what it did and why its official estimate came out so large.
- **Uncle Sam talks and reacts.** His lines are pre-recorded with Kokoro, an open-weight
  neural voice model, so he sounds natural and the same on every device; his pace follows his
  mood. Visitors can switch to one of their device's voices in settings. His face,
  hat and arms change with his mood, and he nods and talks while speaking. At the budget desk
  he coaches in real time as the plan changes. Speech is on by default and can be switched off
  from the top bar or in settings.
- **Rewards.**
  - Up to three stars per level (all questions right on the first try, or the budget-desk
    star rules).
  - A celebration card on finishing a level, with the certificate earned, a quote from American
    history on citizenship, responsibility, the future or the economy, and a preview of the next
    level.
  - Adviser titles and a copyable "budget ballot".
- **One top bar, no side panel.** Left: "Your journey" (the road map). Middle: the current level
  and the ten-level track; hovering it lists every level to jump to, plus the field-guide
  chapters. Then stars and accomplishments (medals and budget-desk badges). Right: Continue,
  Uncle Sam's voice switch, Glossary, Methods (sources & methods) and Settings.
- **Settings** (top bar): text size, light/dark theme, voice choice, vibration, and free roam to
  unlock everything.
- **The fine print:** each level's full field-guide chapter and original government documents
  are gathered on Sources & methods ("By level"), one link from every level. The field guide
  (all earlier pages) is listed in the top bar's level menu and in every page's footer.

### Design notes: five UX lessons from Royal Match, without the pressure tactics

1. **Keep colors simple.** Game chrome uses four bold, high-contrast fills by difficulty (green
   easy, blue medium, red hard, purple super hard), always paired with a distinct icon
   silhouette per level, so levels read by shape as well as color. Charts keep their validated
   data palette.
2. **Don't slow down.** Nothing waits for an animation or for Uncle Sam to finish speaking.
   Keyboard play: 1–4 or A–D to answer, Enter or → to continue, ← to go back. The celebration
   card closes with one tap or Escape, and Continue in the top bar jumps straight back in
   (it hides on pages that already have their own main button, so each screen has one).
3. **Feedback you can feel and hear.** On phones that support vibration: a tick for a right
   answer, a soft double tap for a miss, a short flourish for a finished level or a medal. Every
   one of those moments also plays a short, quiet sound, synthesized in the browser with no files
   to download, so iPhones (which can't vibrate from a web page) get feedback too. Each has its
   own switch in settings, and buttons and answers respond to the press.
4. **Be generous with rewards.** Stars, certificates, adviser titles, fact cards from every
   chapter, and medals that reward taking part (voting, reading the original documents,
   exploring the field guide, sharing) as much as winning. Every level can be finished by hand,
   with only a gentle hint on level 5. The article's other tactic, levels tuned to be
   "almost winnable" to sell boosters, is deliberately left out: there are no timers, lives,
   streak penalties, leaderboards, ads or purchases.
5. **Make it easy to share.** Share buttons on the celebration card, fact cards, ballot and
   certificate use the phone's share sheet, falling back to the clipboard. On the public site,
   "Save image" makes a 1200×630 card with the level, stars, a fact and Uncle Sam.

### Built for phones

Most players are on a phone, often for a few minutes at a time. The game was measured on an
emulated iPhone 13 (390×664) and tuned to the usual mobile-game principles:

- **One action bar.** Every screen's forward actions sit in one bar
  (`src/components/ActionBar.tsx`), fixed to the bottom of the screen at every width so players
  always know where to look: Back and Continue on a level step,
  the next level after one, Higher and Lower on the Daily Dollar, Take the challenge on a friend's
  plan, the hint or the next steps (with the stars and progress) on the budget desk, Share on the
  People's Budget and the Budget Story, and, on pages with no action of their own, the chapter's
  level or the next level to play. One bar per screen; a button the bar holds isn't repeated in the
  page. On phones its buttons fill the bar, in reach of a thumb; on wide screens they line up with
  the right edge of the page's column. The celebration opens as a sheet from the bottom with its
  next step pinned in reach.
- **Uncle Sam in one place.** He always speaks from the same spot: standing on the action bar at
  the bottom left, on a full-width band of frosted glass that blurs the page behind him so it doesn't compete
  with his words (`src/game/samdock.tsx`; pages say his lines with `<SamSays>`, which hands them
  to the dock). Each new line slides him in from the left. On a level
  step with something to see or do (a chart, a quiz, a slider, a vote), the main button reads
  **Skip this narrative** while he speaks and slides him out of view; then it reads Continue and
  moves on. On a step that is only his words, Skip this narrative moves straight on in one tap.
  Back brings him back first, then goes to the previous step. A new line, such as a quiz answer,
  a reaction on the budget desk or a Daily Dollar result, slides him back in; tapping him or
  anywhere else slides him away, and a small handle at the left edge brings him back. Only the
  level-complete pop-up keeps him inside it.
- **Uncle Sam acts.** He is the main character, so he is never a still picture: he breathes,
  blinks and glances around while he waits, and looks toward his words while he speaks. Each mood
  has its own hands (a wave hello, then a hand that talks along with him; a hand on his heart when
  proud; wringing hands when worried; hands up in surprise; a hand at his chin when thinking; both
  arms up when cheering), and each new line starts with a small reaction (a nod, a jump, a
  bounce). His mouth follows his recorded voice: `scripts/voice/synth.py` stores how loud every
  1/15 of a second of each recording is, and the narrator opens his mouth to match (with a device
  voice, it opens on each word). With reduced motion he holds still.
- **Thumb-friendly.** Every control is at least 44 × 44 px on a touch screen.
- **Less on screen.** Five controls in the top bar on phones (Glossary and Methods move into the
  settings menu), and the top bar's Continue moves down to the action bar at every width; the footer is one line, with the field guide
  and the note about the figures in Sources & methods; on the desk, the scoreboard and cards come straight after the title. Medal and badge
  messages share one stack under the top bar.
- **Interruptions.** A call, a locked screen, or a closed tab loses nothing: level steps,
  answers, and the plan in progress on the desk (for each level, and for each friend's challenge)
  are saved as they happen, and Uncle Sam stops talking when the app goes to the background.
- **Fast return visits, and offline.** On the public site a service worker (`public/sw.js`)
  keeps the game's files: the page itself comes from the network first (so a release shows up at
  once), built files and fingerprinted voice recordings come from the saved copy. A return visit
  opens in about 0.2 s, and the game plays with no connection at all; the shared database,
  CAPTCHA and live Treasury data always go to the network.
- **Install it.** **Download the game**, at the top of the settings menu, adds it to the home
  screen: it opens the browser's own install prompt where there is one (Chrome, Edge, Samsung
  Internet) and shows the two taps on iPhone and iPad (Share, then Add to Home Screen). A web app
  manifest and home-screen icons (`public/manifest.webmanifest`, `public/icons/`, drawn by
  `scripts/make-icons.mjs`) make that possible; opened from the home screen, the game returns to
  the level the player was in.
- **Daily Dollar reminders.** An opt-in notification, at most once a day, at the hour the player
  picks (in settings, or on the Daily Dollar's finished screen). Sent with Web Push by a Supabase
  Edge Function that Cron runs hourly; no account or email. On iPhone it needs the game on the home
  screen first. Setup: [`supabase/README.md`](supabase/README.md#daily-dollar-reminders-web-push).
- **Something new each day.** Returning players see a "Today" card on the road map: today's
  Daily Dollar (or when the next one is ready) and, on the public site, their People's Budget
  move.

### Sharing and coming back

Built from the Mambo.io list of 108 gamification elements, keeping the white-hat ones (meaning,
accomplishment, creativity, friendly rivalry) and leaving out the pressure tactics (timers,
expiring rewards, streaks that punish a missed day, public ranking of people).

- **Your name.** The game asks for a first name once (on level 1's card, in the challenge pop-up,
  or in settings), keeps it on the device, and uses it where it makes things personal: the card,
  challenge links and their message ("Rich here. I balanced Uncle Sam's budget…"), the Budget
  Story, chains, and Uncle Sam's greeting on screen (his recorded voice says the line without it).
- **"My share of Uncle Sam"** (`#me`), the card at the end of level 1: what the player's salary
  pays in federal taxes, how much interest Uncle Sam would save if ten straight years of it paid
  down the debt (compounding at the Treasury's average interest rate on its debt; about $22,900
  for a $65,000 salary), and where the dollars go, as a 1080×1350 image with their name. It is about the player, not a position, so it is safe to post anywhere
  (`src/game/MyShare.tsx`).
- **The tax receipt as a pop-up.** Level 1's "Your share" step shows the total and "Print my
  receipt"; the full receipt prints out of the top of a pop-up sheet.
- **Certificates that give nothing away.** A chapter level's share says the stars, how long it
  took (active time only, `src/game/levelTime.ts`), and one fact chosen never to be the answer to
  any quick check in the game (each level's `shareFact`), so friends still get to guess.
- **Safe by default.** Shares say how you did, not where you stand: the Budget Story's tax-and-cut
  split and "my part of the fix" card are added only when the player switches them on.
- **Challenge a friend** (`?p=…`): a finished budget-desk plan travels inside the link itself,
  with an optional first name and, if the player chooses, their answers to the big questions. The friend's first screen (`#plan`) is a short
  summary of the plan and one "Take the challenge" button that opens the same level right away,
  with no sign-up and nothing to read first.
- **Challenge mode** on the desk: a banner shows the plan to beat; the scoreboard comes first on
  phones; and when the cards alone can't reach the goal, the
  across-the-board changes sit right under them. Meeting the goal opens a live head-to-head
  (stars, steepest year for the economy, cards used) with no pop-up, so the friend can keep improving. A win or a tie ends on "Send it back to <name>"; a loss
  ends on "Try again". Newcomers are pointed to level 1 at the end, and Uncle Sam's voice starts
  downloading only after the first tap. The share stats count each step: took the challenge, met
  the goal, sent a plan back.
- **Your Budget Story** (`#story`): phone-story cards (1080×1920) drawn as SVG and saved as
  PNG: a budget personality, the biggest move, the debt path against current law, and the
  closest real proposal; and, if the player chooses, how the plan splits taxes and cuts and their
  part of the fix. The six personalities are about how a plan works, never which way it leans:
  whether one card does most of the work or many share it, and whether it goes easy on the
  economy (The Precision Planner, The Big Mover, The Steady Hand, The Dealmaker, The Patient
  Builder, The Overhauler; `archetype()` in `src/game/plans.ts`).
- **A 10-second clip** of the plan bending the debt curve, with Uncle Sam's recorded voice, made
  in the browser with a canvas and MediaRecorder (MP4 where supported, else WebM).
- **The Daily Dollar** (`#daily`, `?daily`): five higher-or-lower calls a day on real federal
  numbers, the same puzzle for everyone on a date, with a spoiler-free result grid to post.
  **Themed weeks** twice a year: **Budget Week**, the seven days from the first Monday in
  February (when the law asks the President to send Congress a budget request), with spending by
  budget function, deficits since FY1962, and agency spending; and **Tax Week**, the seven days
  ending on Tax Day (April 15, moved past weekends and Washington, D.C.'s Emancipation Day as the
  IRS does), with monthly collections, each tax's take since FY2015, CBO's tax options, and, on
  Tax Day itself, what a paycheck pays. The page, Uncle Sam, the share text, the road map's Today
  card ("Coming up: Tax Week, April 9–15" three weeks ahead) and the reminder notification all say
  which week it is. `#daily?d=2027-04-15` previews any day's puzzle without saving it.
  **Deadline editions** for news the whole country is watching: **Shutdown Watch**, the seven
  days up to the last day current law funds the government (what Washington spends, stopgap bills
  by year, and what Congress approves each year), ending on "Deadline day"; and **Debt Limit
  Watch**, the week before a Treasury X-date (the debt through the years, interest, and the debt
  next to the economy). The dates live in `src/data/curated/deadlines.json` (now: Dec. 11, 2026,
  under P.L. 119-103, and Sept. 30, 2027), repeated in `public/sw.js`; update both when Congress
  passes a new stopgap. The road map's Today card counts down to the next funding deadline, and
  shows a **debt limit watch** when the room left under the limit is under six months at the
  past year's pace.
- **The debt clock** (`#clock`, on the road map, and on the debt chapter): the Treasury's Debt to
  the Penny, carried forward second by second at the pace of the past twelve months, each
  person's and household's share, the interest cost per second, what has been added since the
  page opened, and the legal debt limit with the room left (Daily Treasury Statement, Table
  III-C). The site fetches the latest figures from the Treasury's Fiscal Data API when it opens
  and every half hour after that; the ticking part is labeled as an estimate. (Other debt clocks,
  such as usdebtclock.org, publish their own estimates with no data feed; this one uses only the
  Treasury's published figures.) `node scripts/fetch-debt-limit.mjs` refreshes the baked-in
  limit between full data runs.
- **Your part of the fix**, on the budget desk (a one-line summary there, the details in a
  pop-up): what the plan changes in the player's own federal
  taxes, per year and per day, next to what it buys (the yearly borrowing it stops and the
  interest it saves, per household), and the interest every household already pays. A tax
  increase is still called one, line by line.
- **Uncle Sam reacts** the first time each policy card is played, with one true fact from CBO's
  data.
- **Play together** (`#together`, and on the road map): the three ways to play with other
  people, each with who it's for, how long it takes, and one button: a room for a class, club,
  or office; the Daily Dollar as a group-chat habit ("Invite the group"); and pass the budget.
  Each chapter level's last screen points to them too.
- **For teachers** (`#teach`, linked from Rooms): a ready 45-minute class (Daily Dollar warm-up,
  levels 1 and 2, a room on level 5, discussion), five discussion questions that don't take
  sides, what students need, "Copy the lesson plan", and "Send this to a teacher".
- Shared links carry a channel tag (`?s=x`, `wh`, `sh`…), saved with the player's anonymous
  record so first visits can be counted by channel.
- Short links (`?plan=<id>`) for finished plans, and rankings of policy cards and states (never of
  people) on "How everyone played".
- **The People's Budget** (`#peoples`, `?peoples`): one shared budget built by everyone. Each
  player gets one move a day (push one card in or out, changeable that day), a card is in when
  more moves pushed it in than out over the last 30 days, and the result is scored on all three
  desk goals with the same model. Moves are anonymous; a "latest moves" feed shows only the card,
  direction, and time.
- **Rooms** (`#rooms`, `?room=CODE`): a class, an office, or a family plays one budget-desk level
  together. The starter gets a 6-character code; members join, the level opens for them, and each
  member's plan that meets the goal joins the room's (a card is in when more than half the plans
  use it). The room sees totals only, and vote breakdowns once 3 have joined.
- **Pass the budget** (`#chain`): each person adds one card or takes one out, then passes the link
  on; the chain lives entirely in the link (goal, turns, optional first names), so it needs no
  server. Every link can branch.
- **Share stats** (`#stats`, linked from "How everyone played"): shares made, shared links opened,
  and new players whose first visit came through a shared link, by channel and kind of link, with
  the viral coefficient K = shares per player × new players per share, and the friend-challenge
  funnel (opened → took the challenge → met the goal → sent a plan back). Counts are anonymous
  daily tallies; a player's channel is the first tagged link that brought them.
- **Link previews that match the plan.** Crawlers ignore the query string, so a shared link goes
  through one of 54 small static pages, `/p/<level>-<stars>-<personality>/`, each with its own
  1200×630 card ("Can you beat The Steady Hand's 3-star plan?"); people are forwarded to the plan
  at once. Pages for links shared under the earlier, lean-based personalities
  (`/p/10-3-revenue-bold/`) still work, with the matching neutral preview. No server is involved. Regenerate the pages and cards with `npm run previews` (dev
  server running) after changing their wording in `src/game/previews.ts` or the card's look in
  `src/game/OgCard.tsx`.

Progress is saved in the browser. The game also keeps one anonymous record per player (levels
finished, stars, first-try answers, medals) and one ballot per person, and "How everyone played"
(`#results`, offered at the end of level 10) totals them: on balancethebudget.us in the site's
Supabase database ([`supabase/`](supabase/README.md): row-level security, count-only totals),
and on the claude.ai artifact in the artifact's shared database. Any other copy (a local build, a
fork) stays offline and shows only the player's own results.

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # standalone site in dist/ (refreshes debt and latest month live from Treasury)
npm run build:artifact # one self-contained HTML page in dist-artifact/ (data baked in)
```

The standalone build is static and can be hosted anywhere (GitHub Pages, Netlify, Vercel, S3).
Routes are hash-based (`#spending`, `#state-ca`), so no server configuration is needed.

### Deployment

`.github/workflows/deploy-pages.yml` builds the site and publishes it to GitHub Pages on every
push to `main` (or on demand from the Actions tab). In the repository's **Settings → Pages**,
**Source** must be set to **GitHub Actions**, and **Custom domain** is `balancethebudget.us`
(DNS: A/AAAA records for the apex pointing at GitHub Pages, and `www` as a CNAME to
`richnguyen.github.io`). With an Actions deployment the domain lives in that setting, not in a
CNAME file. To update the data, run `npm run data` locally, commit `src/data/generated/`, and push.

Shared voting totals and "How everyone played" need a shared database, so they work on the
claude.ai copy of the site; on the public site the game shows each player's own results. Badges,
stars and progress are saved in each visitor's browser.

## Re-record Uncle Sam's voice

Uncle Sam's lines are recorded ahead of time with [Kokoro](https://github.com/hexgrad/kokoro)
(Apache 2.0) via [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx), voice `am_michael`.
After changing any of his lines:

```sh
python3 -m venv .venv && .venv/bin/pip install kokoro-onnx soundfile   # once; also needs ffmpeg
mkdir -p .kokoro && cd .kokoro && curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx \
  -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin && cd ..
npm run dev &                      # the collector reads the lines from the running app (needs Playwright)
npm run voice:collect              # writes scripts/voice/lines.json
PATH=.venv/bin:$PATH npm run voice:synth   # writes public/voice/*.mp3 and src/data/generated/voice.json
```

Lines without a recording fall back to the browser's own speech, so nothing breaks in between.

## Refresh the data

```bash
npm run data           # fetch every source (cached in data/raw/) and rebuild src/data/generated/
npm run data:build     # rebuild from the cache only
node scripts/fetch-all.mjs --refresh   # ignore the cache
```

`scripts/check-hosts.mjs` reports which source hosts are reachable. Behind an HTTP proxy, Node's
`fetch` needs `NODE_USE_ENV_PROXY=1` (the npm scripts set it).

| Data | Official source | How it's obtained |
|---|---|---|
| Receipts, outlays, deficit (monthly and by fiscal year), outlays by budget function and by agency/account, receipts by source, payroll taxes by trust fund, customs collections and refunds, trust fund balances | U.S. Treasury, Monthly Treasury Statement Tables 1, 4, 5, 8, 9 | Fiscal Data API (`scripts/fetch-treasury.mjs`) |
| Debt to the Penny, historical debt, interest expense, average interest rates | U.S. Treasury, Fiscal Data | Fiscal Data API |
| FY1962–FY2025 mandatory / discretionary / net interest, revenue history, debt held by the public, GDP; projections | OMB Historical Tables, FY2027 Budget (Tables 1.1, 2.1, 7.1, 8.1, 10.1) | XLSX from whitehouse.gov (`scripts/build-cbo.mjs`) |
| Federal awards by state and congressional district, top agencies and programs | USAspending.gov | USAspending API (`scripts/fetch-usaspending.mjs`) |
| Population, households | Census Bureau (Vintage 2025 estimate; Housing Vacancy Survey) | census.gov releases (`scripts/fetch-census.mjs`) |
| 2026 tax brackets, standard deduction, payroll tax parameters | IRS Rev. Proc. 2025-32, Publication 15, Topic 560 | irs.gov documents, recorded in `src/data/curated/tax.json` |
| Social Security and Medicare trust fund projections | 2026 Social Security and Medicare Trustees Reports | `src/data/curated/trustees.json` (cited) |
| Laws' deficit effects; budget-process history; who benefits | CBO/JCT cost estimates; CRS reports; agency statistics | `src/data/curated/*.json` (each entry cites its official URL) |

CBO's projections are the preferred benchmark for the gap chart and the sandbox. The pipeline uses
them automatically when `data/raw/cbo/baseline.parsed.json` exists; otherwise it uses OMB's
estimates and labels them as the President's budget.

## Code map

- `src/game/` the game layer: `levels.tsx` (level content; every figure and quiz answer is computed
  from the data), `LevelPage.tsx` (step wizard), `Journey.tsx` (road map), `Celebrate.tsx`
  (level-complete card), `StatusBar.tsx`, `LawExplorer.tsx`, `quotes.ts`, `state.tsx` (progress
  and settings), `voice.tsx` (speech: voice choice, mood prosody), `UncleSam.tsx` (character),
  `haptics.ts` and `sfx.ts` (vibration and sound feedback), `resume.ts` (reopening the installed
  app where the player left off).
- `src/pages/` one file per field-guide section; `src/components/charts.tsx` the D3-based charts;
  `src/components/USMap.tsx` the state map; `src/lib/` formatting, categories, tax and sandbox math.
- `src/data/types.ts` is the contract between the pipeline and the app.
- Chart colors are a validated categorical palette (colorblind-safe order, both themes).
