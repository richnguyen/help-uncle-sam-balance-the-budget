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

- **The main menu** (`#journey`, the first screen) is a hub, and a screen of its own: no top
  bar and no action bar. The scene of the Mall behind; the title; in the top-right corner, Build
  the Mall (a marble-and-gold Capitol button with the stars left to spend), the Settings gear
  (music and sound switches are inside Settings) and the player's record (rank, missions,
  medals); and Uncle Sam close up, with a plain speech bubble, standing on this year's deficit,
  running. The choices are the tab bar along the bottom.
- **The tab bar** (`src/game/TabBar.tsx`), along the bottom of every screen outside a mission,
  like an app's, five tabs alike: Mission (the next mission to play, or the road map once every
  mission is done), Daily (the Daily Dollar), Feed in the middle (the main menu and its feed),
  Together (Play together) and You (your record, then the field guide; a person icon; once
  the player has given a first name, the tab and its page title say that name instead). Each is the main menu's own icon with a short
  name. The tab for the screen you're on is lit, with a bar above it: the road map counts as
  Mission's, Rooms, chains and duels as Together's, every field-guide chapter, the glossary and
  Sources & methods as You's. It stays in missions and at the budget desk too, with the
  step's own Back / Continue bar right on top of it, as is a screen's own action bar (Build,
  Higher / Lower). The Feed tab is the way back to the main menu.
- **Official news** (`scripts/fetch-news.mjs` → `src/data/generated/news.json`, `src/game/news.ts`):
  the White House's presidential actions about taxes, tariffs, spending, the budget or the debt,
  CBO's latest cost estimates and reports, and spending and tax bills on the Senate and House
  floors. It ran along the main menu's headline line, which gave way to the tab bar; the Pages
  workflow still fetches it every three hours, ready for a new home, and the browser no longer
  reads Congress.gov's feeds live. `npm run news` refreshes the file locally.
- **This year's deficit, running** (`DeficitClock.tsx`, on the main menu): the federal deficit
  for the fiscal year so far in red, with spending (blue) and revenue (green) beside it. It
  starts from what the Treasury has counted this year: the Monthly Treasury Statement for each
  month it has published, then the Treasury's daily figures (`scripts/fetch-dts.mjs`, refreshed
  with every scheduled deploy and again in the visitor's browser). A deficit is paid for by
  borrowing, so the daily deficit is the new borrowing from the public since the starting day
  (Debt to the Penny) less the cash it added to the Treasury's account (Daily Treasury
  Statement); tried on fiscal 2026, it came within $15 to $27 billion of the official count at
  each month's end. Revenue is the cash deposited without borrowing, on the official footing
  via last year's totals. From the end of the count it adds the past twelve months' pace,
  second by second, labeled as an estimate. (Spreading last year's total evenly over the
  calendar would badly miss a lopsided month: about $346 billion of fiscal 2027's deficit came in
  October alone.) Under it, a year at a time, two numbers: every person's share of the deficit (the
  past twelve months' deficit divided by the population) and the year's interest cost (the Treasury's gross interest expense
  on the public debt, not the budget's net interest). The debt clock (`#clock`) uses the same
  annual figures. One short line closes the card: "Treasury daily figures through" the last
  day counted, and a link to the debt clock.
- **The main menu's scene and sound.** Behind the menu is an illustrated National Mall
  (`MenuScene.tsx`, drawn for the game): the Washington Monument with its ring of flags, the
  Capitol and its reflecting pool, a golden morning in the light theme and a floodlit night in
  the dark. Clouds drift, birds cross, flags wave, the pool shimmers, people stroll, and the
  layers shift a few pixels with the pointer; it holds still for people who ask for less motion,
  and stops when the tab is hidden or the scene is off screen. **Music** (`music.ts`): an
  original, synthesized loop (16 bars in F major at 72 beats a minute: a warm pad, a soft bass,
  a music-box melody, a quiet arpeggio and an echo), on unless switched off, starting with the
  first tap or key, ducking under Uncle Sam's voice. **Sounds of the Mall** (`ambience.ts`):
  wind and birdsong, or crickets at night, off until switched on. Both play only on the menu,
  are remembered, and have switches in Settings too. On phones the scene is a banner with the
  title in its sky, and the choices follow. The road map is a page of its own (`#levels`); Your record and Settings are on the You tab
  (`#record` and `#settings` go there).
- **Your record, on top of the You tab** (`RecordTop` in `src/game/Journey.tsx`): one card with
  your name and title, your missions by campaign (a bar each, filled as you finish), Continue and
  the road map, and six numbers (stars won, stars to spend, medals, polls, bills, quick checks).
  Then Settings (your first name, text size, theme, Uncle Sam's voice, vibration, free roam,
  install, and the main menu's music and sounds; the main menu's gear and `#settings` scroll
  here). Then every mission as a badge, its seal once finished (a dashed outline until then); tap one
  for a sheet with what it taught, Share and Play again. Your ballot, briefly: a bar of the
  questions answered, then one line per vote with your answer as a mark and how many players
  agreed. *How everyone played*: players, those who finished, votes on budget ideas, and a link
  to the full results and votes. Then medals, saved posts, and the final certificate.
- **The field guide** (`#guide`, from the main menu): every chapter in full, each with the level
  it goes with (read chapters are marked), and Sources & methods and the glossary inside it.
  Every chapter's banner links back to the field guide and to Sources & methods.
- **Uncle Sam lives in the top bar.** Every line, the level-complete pop-up's cheer included,
  comes from him in the middle of the top bar, and nothing pops up over the page: a step's
  Continue always moves on, and Back always goes back. (The pop-up opens under the bar, so he
  cheers from his usual place.)
- **Three campaigns, twenty-one missions.** Each campaign has one goal and ends at a budget desk:
  (1) stop the debt from outgrowing the economy (9 missions), (2) cut the deficit to 3% of GDP
  (7 missions), (3) balance the budget (5 missions). Missions are numbered Campaign · Mission
  ("Mission 1.5"), go from easy to hard, and unlock in order (`CAMPAIGNS` and `STOPS` in
  `src/game/levels.tsx`). Learning missions explain one idea each: his paycheck, his bills, back
  home, the structural gap, the credit card (debt), who writes the budget, and keeping his
  promises (Social Security), plus six concept missions (`src/game/concepts.tsx`) that teach how
  the desk scores a plan: how a policy hits the economy (CBO's output ranges by kind of change,
  and the same $100 billion saved four ways), gentle, moderate and steep (each year's new
  squeeze, all at once or phased in), who pays (the cards that reach current retirees,
  low-income families and public investment), growing the pie (long-run growth), cutting
  public investment (non-defense discretionary spending since 1962), and who pays later
  (interest against defense, per person). Every number in them comes from the same data and CBO
  ranges the desk uses. The internal codes stay stable (`level-1` … `level-10`, the desks at 5, 8
  and 10, the new missions at 11–16), so old share links, rooms and duels keep working.
- **The budget desks** (the final missions 1.9, 2.7 and 3.5) are the hard "wall" missions, where
  the player fixes the budget with CBO-priced options. Each keeps a thin scoreboard pinned at the
  top while the player scrolls through policy cards, each linked to the closest real proposal in
  Congress. Only the first desk has a hint, to ease the jump: Uncle Sam marks one card that would
  help (the gentlest one that would finish the job on its own), or, once the goal is met, says
  what earns the next star; the player still plays it. The first desk also opens on a starter
  deck: the three biggest tax and three biggest spending cards (more if those can't reach the goal),
  with a link to show the whole deck; the 2.7 and 3.5 desks open on the full deck. Elsewhere the star tips say what earns each
  star, never which card to play; when the cards alone can't reach the goal, the across-the-board
  changes sit right under them.
- **Two-way cards** (in `src/data/curated/options.json`, `savings10` below zero): two cards that
  add to deficits, each with an official estimate on the card. *Bring back the larger ACA premium
  tax credits, permanently* (CBO, September 2025: $349.8 billion over 2026 to 2035) and *Make the
  2025 law's temporary tax breaks permanent* (JCT's estimate in CBO's August 2025 letter: about
  $0.8 trillion over 2025 to 2034, before interest). They sit last in the deck, say "adds to
  deficits", widen the gap when played, and are left out of the who-pays split, the plan's
  economic cost, the 1.9 starter deck, hints and the Daily puzzles; share links give them new codes
  (`u`, `v`), so older links keep their meaning. Caveats are on each card: both were scored against
  CBO's baseline at the time, and the desk's projection is OMB's, which assumes the President's
  proposals; if those already make the tax breaks permanent, that card counts them twice.
- **State flags beside lawmakers** (`scripts/fetch-flags.mjs` → `public/flags/XX.png`,
  `src/data/generated/flags.json`): every lawmaker the game names (a bill's sponsor, each member in a
  floor vote) gets the same marker, the flag of the state or territory they represent, as plain
  geography. 56 flags (50 states, DC, five territories) from Wikimedia Commons at 72 px wide (about
  250 KB in all); each file's license and author are listed on the Sources page (55 public domain,
  Mississippi's "copyrighted free use"). Rerun the script when a state adopts a new flag.
- **Quick play posts** (`src/game/feed/items.ts`, `src/game/quickplay.ts`): the feed's Lessons
  carry one post per mission with a game: the game's name and goal, its rounds, and "up to 2
  stars". One tap opens the mission straight into Quick play; a locked mission's post says what
  unlocks it instead.
- **Sharing a post** (`src/game/feed/sharePost.ts`): every post has a Share button beside Save. It
  opens the phone's share sheet (or copies the link) and the social networks, with the post in a
  line: a bill's number, title and status; a poll's option and CBO's estimate; a quick check's
  question, never its answer. The link (`?post=<id>`) opens the feed with that post first, marked
  "Shared with you", once; a malformed id is ignored. The Daily Dollar's post links to `?daily`.
- **Sponsors and floor votes** (`scripts/rollcall.mjs`, `src/game/feed/votes.tsx`): a bill's sponsor
  reads exactly as Congress.gov lists them ("Rep. Arrington, Jodey C. [R-TX-19]"), with no colors
  or scores. For bills past introduction, `fetch-bills.mjs` follows the recorded votes Congress.gov
  lists for the bill to the official records (the House Clerk's and the Senate's roll-call XML) and
  keeps, for each, the question, the result, the yeas and nays, a link to the record, and every
  member's vote with party and state as the record lists them. Bill cards in the feed and followed
  bills in Your record show them, and if the player saved a ZIP code in mission 1.4, how that
  state's members voted. Each roll call also shows the sponsor's own vote (found by chamber,
  state and last name; nothing is shown when the match is ambiguous) and, for a Senate tie, the
  Vice President's tie-breaking vote. Votes that decided the bill (passage, concurring, conference
  reports, veto overrides) are kept ahead of procedural ones, so a bill with many cloture votes
  still shows how it passed, and a passage with no roll call (voice vote, unanimous consent) says
  so, from Congress.gov's actions. Facts only: no ratings of members. `npm run test:rollcall` checks the
  parser on records in each chamber's format.
- **Play counts for the playtest** (`supabase/migrations/20261115000000_play_counts.sql`,
  `countPlay` in `src/lib/backend.ts`): anonymous daily totals, never who did what: each budget desk
  opened, started (a first card) and finished (desk abandonment is started minus finished), the
  time spent on mission 1.6's ripple round (in buckets), the feed's polls seen and answered, free
  roam switched on, missions opened ahead of order, and Quick play started and finished. Only a
  metric and a key are sent, from a fixed list the database enforces; most are counted once per
  browser per day. The stats page (`#stats`) has a "How people play" section with the totals and a
  CSV of the daily counts. `docs/playtest-sessions.md` is the guide for moderated sessions: who to
  recruit for each of the five personas, the consent note to read aloud, a 40-minute script, the
  questions afterwards, and how to read the results next to these counts.
- **Desk twists** (`src/lib/twists.ts`): each later desk differs in kind. Mission 2.7 adds a rate
  shock: the average rate on the debt is higher by the largest one-year rise in the Treasury's
  average rate since 2001 (0.90 points, September 2022 to 2023), on top of the projection, so
  interest eats more of the budget and early savings count for more. Mission 3.5 adds a recession
  in the first projection year: revenue falls by as much as it did from FY2001 to FY2002 (6.9%),
  half that the next year, and tightening in that year counts double on the economy gauge
  (multipliers are larger in a slump), so phasing in pays. Both are computed from the game's data;
  the desk states the twist in one line with a "How the twist works" panel, Uncle Sam says it, and
  the goal, stars and least-cost plan are judged with it, in shared plans, challenges and duels too
  (`assess(goal, …)` applies the goal's twist). A 2021-to-2024-sized rise made 2.7 all but
  unwinnable within the game's protections, which is why it uses the largest single year.
- **Tap-to-define** (`src/components/Terms.tsx`, `src/data/curated/glossary.json`): `<Terms>` wraps
  mission text, game explanations, takeaways, vote context, the desk's card details and the feed's
  bill summaries, and turns the first use of each glossary term in a block (by the phrases in the
  term's `aka` list) into a tappable `<Term>`. It rewrites only plain text inside ordinary elements,
  never links, buttons, headings or other components, and plain words like "deficit" are left
  alone. A term opens as a toggletip: tap to open, tap elsewhere or press Escape to close; keyboard
  focus alone doesn't open it, and the definition goes into a live region so screen readers read
  it. Every definition names its source (GAO's budget glossary, Congress.gov's legislative glossary,
  CRS, Treasury, SSA, IRS or CBO).
- **How this is rated** (`src/game/Rated.tsx`): every number the game rates on its own opens its
  method in place: the desk's economy gauge and mission 1.7 (gentle, moderate, steep), mission
  1.6's ripple ranking, the interest saved on the player's card, and the rules of thumb in missions
  2.5 and 2.6. Each says how it's figured, what it leaves out, and its official sources, and notes
  that CBO's option estimates are conventional: the game shows a dynamic estimate only where CBO or
  JCT published one, and none of the options in the game has one.
- **The desk on a phone**: the scoreboard is one slim band, full width like the top bar, pinned
  under it while the cards scroll: progress and stars, then horizontal economy and who-pays gauges
  (an "i" beside the economy gauge opens how it's rated as a sheet), then phase-in, the desk's
  twist as a chip (its "i" opens the full line and method), Hint and start over. The bottom bar
  only appears once there's a next step, so progress isn't shown twice. Policy cards are made like
  a card game's: the front shows the kind of card, its art, its name and traits (drag, growth,
  who it reaches); flip it (↻) for the back, the same size, with what it does, who pays, who
  benefits, the official estimate and the bill in Congress. What a card does to the gap shows only
  once it's played. A card's height is worked out from the space between the pinned scoreboard and
  the bottom bars, so a whole card fits on screen, down to an iPhone SE. Plan ideas are combo cards
  in the same format: a fanned hand of the cards in the plan, its stars, and what it does to the
  deficit and to debt held by the public in the last projection year; flip one for the idea, every
  card in it and who pays.
- **Plan ideas** (`src/game/ideas.tsx`), on every desk, in two tabs kept apart: "Plans that work
  well", built for that desk's goal around one idea each (stop overpaying, make prices tell the
  truth, two big moves, ask the top and pay fairly for care; for the balanced budget, everyone
  chips in, protect Social Security and health care, mostly taxes), and "Proposals in Congress",
  real plans from members of Congress, each with the game's closest version in cards. Every idea
  is scored live by the same engine as the player's plan (stars, the economy, who pays) and flags
  what it cuts; none is presented as advice. Ideas can be read any time and loaded with one tap
  once the player has met that desk's goal on their own (or in free roam); a loaded plan is the
  player's to change. They are hidden during a friend's challenge or a duel.
- **Every lesson mission is a game** (`src/game/minigame.tsx`, a `game` step). The 13 lesson
  missions each run: Uncle Sam's setup line, one scored game, a step to explore (your tax
  receipt, your state, the laws, the ripple, the pie, the bridge and so on), and one vote on a
  real policy choice. A game is 2–5 short rounds worth up to 100 points each, with a one-line
  score bar that stays in view: the round dots (the current one carries its name, finished ones
  their points; a check on phones), the points, a meter toward three stars, and the stars. After each round a banner
  shows the points and why; at the end, the final score, stars (three at 85% of the points, two
  at 60%, one for finishing) and what the game showed (the mission's takeaways), with Play again.
  **Quick play** (for players who skip text): each lesson mission's first screen offers "Quick play
  · about a minute", which goes straight to the mission's game, then shows its first takeaway in
  one line and finishes the mission. It earns up to two stars, however well the game went
  (`QUICK_MAX` in `src/game/LevelPage.tsx`); the whole mission is how to earn the third, so the
  three-star medals still mean the whole thing. The record marks the mission done, keeps the
  game's score, and notes `quick:<mission>`; the completion screen says how to earn the third star.
  The points each star takes are shown under the first round and again on the replay screen
  (with the ones already earned marked), so a replay is about mastery, not guessing the rules.
  The best score is kept, sets the mission's stars, and greets the player on a return visit.
  Continue waits until the game has been played once.
  - The games: 1.1 Fill the piggy bank (the total, split the $100, your pay stub); 1.2 Size the
    bills (size the four biggest, which is bigger, Congress's share); 1.3 Higher or lower (eight
    states against the national average per person); 1.4 Fill the tank (the last surplus, pour
    the bills on autopilot in first); 1.5 Ripple ranking (rank four ways to save $100 billion by
    their ripple); 1.6 Keep it gentle (the gentle limit, the biggest plan without a steep year);
    1.7 Who pays (sort six cards, the biggest bite); 2.1 Rate shock (the interest bill, stop the
    rate where interest passes defense); 2.2 Beat the deadline (the last on-time year, the budget
    calendar, then October 1); 2.3 Grow the pie (what debt does, cards that help or hold back
    growth); 2.4 Bridge inspector (how far public investment fell, investment or not, by OMB's
    definition); 3.1 Close the gap (what's still paid, close Social Security's gap now and after
    waiting); 3.2 Wait and see (interest ahead, how much bigger the fix gets by waiting).
  - Scoring: a slider guess earns 100 spot on, 60 close and 20 for trying; a split loses 3 points
    per misplaced dollar; sized bars earn half for making the biggest one biggest and half for
    closeness; sorts, orders, pairs and higher-or-lower score the share right; each mission's old
    quick check is now a bonus round (100 on the first try, 50 on the second). Simulation rounds
    score how close the player lands (the crossover rate, the gap closed, the plan's size and
    pace). Every round works from the same official numbers as the rest of the game.
  - Answers to every question still count toward the community's first-try rates on "How
    everyone played".
- **How Congress really budgets: four missions from the Congressional Research Service**
  (`src/game/process.tsx`, new round types in `src/game/rounds2.tsx`), built on CRS's
  "Introduction to the Federal Budget Process" (R46240, updated January 10, 2023). They're
  spread through the campaigns, and the mission codes after each one shift by one (stable `n`
  codes 17–20, so links, rooms and saved progress keep working):
  - 1.3 Paying the bills: sort each step as budget authority, an obligation or an outlay; run a
    made-up agency's year month by month so payroll is always covered (run out and it's an
    Antideficiency Act violation; leave money unused and it lapses on September 30); sort what
    keeps going in a shutdown; and a bonus on transfers vs. reprogramming. Then the four things
    the Antideficiency Act forbids.
  - 2.2 Who's who in the budget: a memory match of eight players and their jobs (the President,
    OMB, CBO, the Budget, Appropriations and tax committees, the Joint Committee on Taxation, GAO),
    the President's budget in order, and the official calendar from Section 300 of the
    Congressional Budget Act.
  - 2.4 Rules of the road: referee six bills against a subcommittee's $50 billion limit (call a
    point of order, or let it through; 60 votes waive one in the Senate), strike what the Byrd
    rule would strike from a reconciliation bill, the 20-hour debate cap, cut or increase? (a
    made-up program at $100 billion last year, $110 billion in CBO's baseline, $105 billion in the
    bill: an increase over last year, a cut against the baseline, and CBO scores it as the cut),
    and a table of Senate math.
  - 3.3 Brakes and the debt limit: sort what's on budget, off budget by law, or outside it; clear
    both Statutory PAYGO scorecards (5-year and 10-year) with at most two more laws or face a
    sequester; the 4% cap on a PAYGO sequester's cut to Medicare; and the debt limit today, from
    the Daily Treasury Statement.
  - Games that practice a rule with a made-up example (the agency, the bills, the reconciliation
    bill, the PAYGO laws, the baseline program) say so on screen; the rules and every real number
    come from the report.
- **3.4 Compared to what?** (`src/game/yardstick.tsx`, stable code `level-yardstick`, `n` 21): the
  same budget gap read against two yardsticks, history (spending and revenue near their
  1946–2000 averages, 19.0% and 17.4% of GDP) and today's needs (a budget that rises with an
  older country, with taxes set to pay for it). The game: size the FY2019 deficit, a year with
  no war or recession (4.6% of GDP, next to 2009 and 2020); sort seven true statements by the
  yardstick each uses (or "both sides agree"); split the growth in spending from FY2000 to
  FY2025 (Social Security, Medicare and Medicaid about two-thirds, interest, everything else);
  and a bonus on how often revenue has reached 20% of GDP since 1930 (twice: 1944 and 2000). Then
  a chart of spending and revenue since FY1930 with the 1946–2000 averages dashed, and a vote on
  which yardstick fits best, with what each costs. Every number comes from OMB's Historical
  Tables (Table 1.2 for FY1930 on, added to `cbo.json` as `long`; Table 8.1 for the programs).
  The two-yardstick framing comes from Michael Linden's October 2026 paper for the Washington
  Center for Equitable Growth, linked from the mission; the paper argues for the second
  yardstick, and the mission teaches both and takes neither. A round on checking CBO's 2000
  forecasts was left out: cbo.gov refuses automated downloads, so those figures couldn't be
  checked against CBO's own reports.
- **Guesses by slider** (`EstimateGuess` in `guesses.tsx`, the `estimate` field on a quiz): the
  number rounds (the last surplus year, the "gentle" limit, the interest bill next to defense,
  the last year every spending bill was on time, non-defense spending's share of the economy, the
  share of benefits still payable, interest in FY2031, how much bigger waiting makes the fix).
  Lock it in, and the real number appears on the track with how far off you were.
- **Guesses by hand** (`src/game/guesses.tsx`, the `split`, `sizes` and `sort` fields on a quiz):
  - 1.1, split the $100: drag three dividers to share out each $100 of revenue among income,
    payroll, corporate and other taxes; the real split slides in below, scored by how many
    dollars were in the wrong place.
  - 1.2, size the bills: drag Social Security, Medicare, defense and interest to how big you
    think they are; the real amounts appear as dashed lines, and the grade asks whether you made
    the biggest one the biggest.
  - 1.7, sort the cards: drag (or tap, then tap a group) six deficit-cutting options into the
    group each reaches first: current retirees, low-income families, or higher-income people.
  - Every divider and bar works from the keyboard too (arrow keys; Shift or Page Up for bigger
    steps).
- **Simulations: move a cause, watch the effect** (`src/game/sims.tsx`), each from the game's own
  official numbers and saying where it simplifies:
  - 1.4, the revenue tank: tap or drag each bill into a tank the size of a year's revenue, the
    ones on autopilot first; mandatory programs and interest nearly fill it, and the rest spills
    over as the deficit (OMB Historical Tables).
  - 1.6, a speedometer on the pace demo: the steepest year's squeeze swings the needle across
    gentle, moderate and steep.
  - 2.1, the interest rate: slide the average rate from 1% to 7% and watch the interest bill
    (debt held by the public times the rate) pass defense and Medicare; it marks the rate where
    interest overtakes defense, and the actual rate's history sits underneath.
  - 3.1, close Social Security's 75-year gap: a payroll-tax slider and a benefit-cut slider fill
    a gauge, with each fix alone from the 2026 Trustees Report (16.65% or a 25.2% cut) and a switch
    for waiting until 2034 (17.30% or 28.5%); mixing the two is a straight line between them.
  - 3.2, wait and see: pick the year the fix starts, and the game's budget engine works out the
    same yearly savings needed from then on to keep the debt from outgrowing the economy by FY2031,
    growing with every year of waiting, plus the extra interest.
  - 1.3, a per-person gauge: the needle shows your state's federal awards per person against the
    national average (below, near, or above), shaded in one color since more isn't better or worse.
- **Your ZIP code** (mission 1.4, Back home; `src/lib/zip.ts`): the player types a ZIP and the game
  finds their state from its first three digits (with the few exceptions: American Samoa, the
  Northern Mariana Islands; military ZIPs have no state, so the state picker opens instead). A
  state picker stays available for anyone who'd rather not. Saving the ZIP is a separate opt-in,
  off by default, and removable from the same screen. On balancethebudget.us it's saved in the
  player's ballot with their budget votes (`zip` and `state` fields), readable only by that
  player; public results group ballots only by state or by 3-digit ZIP area, for groups of 10 or
  more (`ballot_area_totals()`, in `supabase/migrations/20261112000000_ballot_zip.sql`). In the
  claude.ai copy, where every viewer can read every ballot, a saved ZIP stays in the browser.
- **Your county** (mission 1.4's first look at home, before "Your state"; `src/game/county.tsx`):
  the ZIP box is here, and what it finds is shown most local first ("ZIP 22301 is in Alexandria
  city › Virginia › United States"), then who paid the federal income tax in that county, by
  income, next to the whole country; the next step zooms out to the state's federal money. The ZIP
  is kept for that visit only unless the player opts to save it with their votes, and a picker lists every county in the state, plus "All of" the state. A ZIP that
  crosses county lines starts with the county holding most of its land and offers the others as
  chips. It shows the county's federal income tax and its average per return against the U.S.
  average, a sentence on the $200,000-and-up group's share of returns and of the tax (here and
  nationally), and two 100% bars (tax returns, income tax) split into five income groups, each
  over a thin U.S. bar, with hover details and a table view. Odd cases say what they are: groups
  the IRS folded together for privacy show as one, the IRS leaves out counties with fewer than 20
  returns (Kalawao County, HI), its county data leaves out Puerto Rico and the territories, and
  single-address ZIPs (no area of their own) fall back to the whole state. The figures are the
  IRS Statistics of Income county data for tax year 2023, one small file per state in
  `public/county/` (about 760 KB in all, loaded only for the player's state). The state page
  (`#state-va` and so on) has the same view in a "Who pays the federal income tax" section: the
  page's state picker sets the state, a county picker sets the county, and it opens on the
  player's own county when their ZIP (typed this visit, or saved) is in that state. The Revenue
  page has it too ("Who pays the income tax where you live"), with a state picker first: it starts
  with the state of the player's ZIP, or the state they last picked, and browsing there doesn't
  change the state the game remembers.
  - 1.5, the ripple: save $100 billion four ways and watch the ripple it sends through the
    economy, its area sized by CBO's estimate; a slider walks from CBO's low estimate to its high
    one, and a dashed ring marks dollar for dollar.
  - 2.2, the budget calendar: put the four steps in order (the President's request, the budget
    resolution, the 12 spending bills, October 1), then choose what happens when the bills
    aren't done: a stopgap or a shutdown, each told from the record since FY1998.
  - 2.3, debt and your income: slide debt in 2055 from 100% to 200% of GDP and watch the slice
    it takes out of income per person. A labeled rule of thumb: a straight line through CBO's May
    2025 comparison (debt held near 100% instead of rising to 156% leaves income per person about
    4% higher); past 156% it's the game's extension.
  - 2.4, the bridge: cut grants for roads, transit and schools and watch the bridge wear down.
    Hit one: the savings (CBO's estimate for the card) and the first year's drag on the economy.
    Hit two: about 5 cents a year of lost output for every dollar not invested, CBO's average
    return on federal investment (2016), simplified to leave out wear and delays.
- **Uncle Sam talks and reacts.** His lines are pre-recorded with Kokoro, an open-weight
  neural voice model, so he sounds natural and the same on every device; his pace follows his
  mood. Visitors can switch to one of their device's voices in settings. His face,
  hat and arms change with his mood, and he nods and talks while speaking. At the budget desk
  he coaches in real time as the plan changes. Speech is on by default and can be switched off
  with the top bar's Sound button or in Settings.
- **Rewards.**
  - Up to three stars per level (the mission game's best score, or the budget-desk star rules).
  - A celebration card on finishing a level, with the certificate earned, a quote from American
    history on citizenship, responsibility, the future or the economy, and a preview of the next
    level.
  - Adviser titles and a copyable "budget ballot".
- **One top bar, laid out like a game HUD** (`src/game/StatusBar.tsx`): Uncle Sam stands at the
  left, always there, across the bar's two lines: half his body showing, right on its bottom edge.
  Line one, in large display type (24px on phones, up to 32px): the page's title ("The Daily
  Dollar", "You"; in a mission, its number, "Mission 2.4 ▾", since the mission's name heads the
  page). In a mission the number opens the road map right there: every mission by campaign,
  this one marked, locked ones greyed, stars earned, and a link to the full road map. Each page's own heading is
  kept for screen readers only, so the title isn't said twice, and there is no small title above
  it. Then stars and accomplishments (medals and budget-desk badges); there's no Main menu button, as
  the tab bar's Feed tab is the way back. Progress
  through the missions is in Your record, not the top bar. Line two: Sound on/off (his voice; an icon on phones) at the start of his strip, then
  his words, running right to left beside him, the word he's saying at the left end next to him. The glossary and Sources & methods are in the
  field guide and the footer; Settings is the gear on the main menu.
- **A mission page wastes no room on repeats** (`src/game/LevelPage.tsx`): one compact line
  with the mission's title, its difficulty, its time and your best stars (no campaign eyebrow,
  since the top bar has the mission's code); then one line of steps, as tabs (done ones filled
  and checked, the current one ringed; tap one to go back). On phones only the current step keeps
  its name. "Step 2 of 4" is kept for screen readers. The intro step shows the mission's one-line
  brief while Uncle Sam tells the story in the top bar. Then comes the step itself.
- **Settings** (on the You tab, under Your record; the gear on the main menu goes there): text size, light/dark theme, voice choice, vibration, and
  free roam to unlock everything.
- **The fine print:** each level's full field-guide chapter and original government documents
  are gathered on Sources & methods ("By mission"), one link from every mission. The field guide
  (all earlier pages) is on the You tab, under Your record.

### The feed: every post the game has, official ones first

Below Uncle Sam and the deficit, the main menu is a feed (`src/game/feed/`): one column of posts,
like a civic briefing, built for a phone and a thumb.

- **Six kinds of post, each with its own look and its own one action.**
  - *Bills in Congress* (`scripts/fetch-bills.mjs` → `bills.json`): spending and tax bills whose
    Congressional Research Service summary was written or updated in the last 60 days. Each card
    shows where the bill stands (Introduced … Became law), its number and any twin bill, the
    sponsor (initials on a plain disc, not party colors), CRS's summary cut to three lines with
    *Read summary* to open it, *What it costs* (CBO's cost estimate, or that there isn't one yet),
    the latest action, and *Would you support this bill?* (Support · Oppose · Not sure).
  - *Budget lessons*: one surprising number, a small chart (a donut or a run of bars) and three
    cards to swipe, all computed from the Treasury data the game uses (where the money went and
    came from, the deficits, the interest bill, the debt per person, tariffs), plus every law in
    *Laws that moved the needle* with its scored effect on deficits.
  - *Polls*: each of the CBO's budget options, *Would you include this in your plan?*, with the
    deficit effect stated as a plain fact (CBO's ten-year number) and three tabs: *What it does*,
    *Who pays* and *Who benefits* (`affects` and `benefits` in `src/data/curated/options.json`;
    *who benefits* is our short summary of the case CBO lays out for the option, beyond the lower
    borrowing every saving brings). The desk's cards and the ballot show *who pays* and *who
    benefits* side by side too. *Include it / Leave it out* is the same vote as the
    game's policy cards, so the answer counts in both places.
  - *Civic lessons*: every mission as a lesson (steps, minutes, difficulty; *What you'll do* opens
    the steps; *Start the lesson*), quick checks from the missions answered right in the feed with
    the explanation, field-guide chapters, and words from the glossary.
  - *Announcements*: the official news the main menu has always carried (White House actions on
    taxes and spending, CBO, the House and Senate floors, bills sent to the President) in compact
    cards with an amber edge, and deadlines within two months (the funding deadline) with *Save to
    calendar* (a .ics file; left out of the claude.ai copy, whose viewer can't hand over files).
  - *Fun facts*: budget history and surprising numbers, each with its official source
    (`src/data/curated/facts.json`): the Treasury's founding, the first income tax, the 16th
    Amendment, where the debt limit came from, the first monthly Social Security check ($22.54),
    Medicare card No. 1, the year with an extra quarter, the longest shutdown, the last penny and
    what it cost to make; plus facts worked out from the game's data (spending per second, a day of
    interest, the debt in 1790 and in 1835, the last surplus, defense's share in 1962). Dated
    events show as *On this day* or *This week in budget history* near their anniversary, at the
    top of the feed, and as a timeline to swipe, year by year.
  - *The Daily Dollar*, today's puzzle.
- **Source and date on every post** (Congress.gov · CRS summary · Updated Nov 10, 2026; CBO; U.S.
  Treasury), and **Save** on every post; saved posts are listed in Your record, which also counts
  polls answered, bills weighed in on, and quick checks right.
- **Who it's from, at a glance.** Each post opens with a small round mark for its source, drawn
  for the game (a monogram for CBO, JCT, CRS, GAO, OMB, SSA, CMS and the National Archives; a
  dome for Congress, a portico for the White House, a columned building for the Treasury, a 1¢
  for the Mint; Uncle Sam's hat for the game's own posts). They are deliberately not the
  offices' logos or seals, which would suggest an office stands behind the game.
- **A picture on every post** (`src/game/feed/art.tsx`): a band in the topic's color with a fine
  engraved pattern, as on a banknote, a large icon on a white disc and the post's one big figure.
  A bill shows its number and policy area; a poll, its ten-year savings; a law, what it added to or
  cut from deficits; a fun fact, its year or number with a fitting picture (a penny, a Social
  Security check, a Medicare card, an hourglass for the 1976 transition quarter); a mission, its
  seal (grey until earned) with steps and minutes; a deadline, the days left; the Daily Dollar,
  its number and five rounds. A quick check's "?" turns into "Right!" with a burst of stars, or
  "Not quite"; a word to know gets its first letter, large. All drawn for the game; no photos.
- **Visual aids.** A bill shows its road to law as six dots (introduced, committee, one chamber,
  both, the President, law) with where it stands and what's next; a poll shows the option's
  ten-year savings as a bar against the biggest of the CBO's options in the game; a law, its
  effect against the biggest in the game.
- **Follow a bill.** *Follow this bill* on any bill card remembers the stage it was at. When the
  bills fetched on the next deploy show it at a new stage, its card says *Moved since you last
  looked: Introduced → Passed Senate*, the Feed tab counts it, a toast says so on the visit, and
  *Bills you follow* on the You tab lists every followed bill with where it stands (a moved one
  marked until seen; Unfollow there). With notifications on (the Daily Dollar reminder switch),
  the game also sends a notification when a followed bill moves (see `supabase/README.md`).
- **New since your last visit.** The game remembers when the feed was last open. Bills and
  announcements that arrived since then lead the feed with a *New* mark (the marks hold for the
  whole visit), the Feed tab shows how many are waiting from any other screen, and the caught-up
  line says how many were new and when the last visit was. A first visit marks nothing.
- **Neutral by design.** Summaries are CRS's; the arguments come from CBO; nothing is ranked but
  plans and ideas. Players' answers show only after you answer, as bars labeled "players of this
  game, not a scientific poll". Bill answers are saved in the site's database (`feed_votes`, one
  answer per player per bill, counts only); elsewhere they stay on the device.
- **The mix.** Fresh official posts (the last two weeks) come first, newest first, then a "You're
  all caught up" line, then the rest in a steady daily shuffle. The rhythm is three posts to
  glance at, one to tap, one to dig into (3-1-1), never three of the same kind in a row, with a
  row to swipe sideways (field-guide chapters, budget history, missions) every dozen posts.
- **Getting around.** A row of topics (All, Bills, Budget, Polls, Lessons, Fun facts, News) stays pinned at
  the top; a *Top* button appears after two screens; open a post and press Back, and the feed is
  where you left it (same posts, same place). On a wide screen, the topics and links sit in a left
  column, the posts in a 640-pixel column, and *Coming up* (deadlines, tax day) and the
  most-answered polls on the right.
- **Light on the phone.** Posts load ten at a time from a cursor (the next batch when you're about
  70% through), with skeleton cards while they load; only the posts near the screen are in the
  page (the rest are measured spacers); the end is a card that says so, with a way to start over
  in a new order and the links a footer would hold.

### Build the Mall: stars that build something

A home base in the manner of a match-3 game's building areas, without the pressure tactics
(`src/game/build/`). The stars won in missions pay for rebuilding six landmarks of the National
Mall, one piece at a time: the Washington Monument, the Lincoln Memorial and its Reflecting Pool,
the Jefferson Memorial, the Treasury Building, the White House and the Capitol (`#mall`, and each
landmark's site at `#mall-monument`, `#mall-lincoln` …).

- **Each landmark is a chapter of its own,** with its jobs in a fixed order (the ground and the
  foundation before the walls, the walls before the roof, the dome before its statue), costs that
  grow from the first landmark (one star a job) to the last (up to three), and the big pieces paid
  for in stages (Lincoln's 36 columns in two halves, the Capitol's dome as a drum, then the dome,
  then the Statue of Freedom). A landmark opens when the one before it is finished. The whole Mall
  takes 49 stars of the 63 there are, so finishing it takes some replays for three stars.
- **Stars are never lost.** The balance is the stars won (the best on every mission) less the
  stars spent; save them up or spend them as you go. There is nothing to buy, no timer, and no
  way to lose what is built.
- **The top bar shows the stars left to spend** (tap it for the Mall); Your record keeps the
  ledger: stars earned (of 63), spent on the Mall, and left to spend.
- **Every job teaches one true thing,** said by Uncle Sam as it goes up: where work stopped on the
  Washington Monument in 1854 and why the marble changes color, why the Lincoln Memorial has 36
  columns, how Philip Reid, an enslaved worker at the foundry, worked out how to cast the Statue
  of Freedom. Each fact was checked against the National Park Service, the Architect of the
  Capitol, the Senate, the White House Historical Association or the Treasury, and each landmark
  lists its sources. A finished landmark sends a postcard with three more facts.
- **A Daily Dollar streak unlocks the finishing touches:** each landmark's decoration (the ring
  of 50 flags, Lincoln lit at night, the cherry trees on the Tidal Basin, Hamilton's statue, the
  South Lawn fountain, fireworks over the Capitol) needs a streak as long as the landmark's place
  on the Mall: 1 day for the Washington Monument, up to 6 for the Capitol (🔥1 … 🔥6 in the list
  of jobs). The best run counts, so a missed day never takes back what was unlocked. A finished
  landmark whose decoration is still locked points to the Daily Dollar, and the decoration
  unlocks the moment the streak is long enough.
- **The streak in the top bar** (`src/game/streak.ts`): 🔥 and the days in a row, left of the
  stars, linking to the Daily Dollar; grey until today's or yesterday's puzzle is played, with the
  best run in its label. It comes from the results kept in the browser, and updates as soon as a
  puzzle is finished.
- **Watching it go up is the reward.** Pieces not yet built are drawn as blueprints, the next job
  glowing, so the player sees what is coming. Building plays on the drawing itself (Web
  Animations, `anim.ts`): a star flies from the button to the site, scaffolding goes up, then the
  piece rises course by course, pops up column by column, is lowered by a crane, fills like water,
  or is painted on in a sweep, and dust puffs at its base while sparkles catch the light. Two jobs
  have a scene of their own: Bulfinch's low copper dome comes down before the cast-iron dome goes
  up, and the White House burns in 1814 before it is rebuilt. Sounds and vibration mark the star,
  the landing and a finished landmark. People who ask for less motion get a short fade.
- **The whole Mall, in one view** (`mall.tsx`): a three-quarter aerial from over the Potomac,
  looking northeast, so nothing hides anything: the Lincoln Memorial up close, the Reflecting Pool
  running to the Washington Monument, the White House and the Treasury to the north, the Jefferson
  Memorial across the Tidal Basin to the south, and the Capitol on its hill at the far end. Each
  landmark wears a sign with its progress and opens its site; a crane stands at the one going up.
  On phones the view scrolls sideways, starting at the landmark being built.
- **The main menu shows it too:** its skyline's Washington Monument and Capitol are pale
  blueprints until the player has built them, with a crane beside the one going up. Build the
  Mall is the Capitol button at the top right, beside the Settings gear and Your record.
- A sunny day in the light theme, a floodlit night with lit windows in the dark.

### A seal for every mission

A finished mission's card shows its seal, not Uncle Sam (he's already in the top bar):
a scalloped rosette like the one on a certificate, in the mission's difficulty color, with the
mission's icon on an engraved disc, "MISSION 2.4 · COMPLETE" around the rim, the stars earned,
and two ribbon tails (`src/game/Seal.tsx`). It lands like a stamp and catches the light once
(not for people who ask for less motion). The final certificate in Your record, for finishing
all 21 missions, has the gold grand seal.

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

- **No zooming by gesture, like an app.** On a touch screen a pinch or a double tap doesn't zoom
  the page (`src/lib/nozoom.ts`): the viewport tag says so (Android browsers follow it, and
  `maximum-scale=1` also stops iPhones zooming into a text field), `touch-action: pan-x pan-y`
  leaves scrolling as the only touch gesture, and Safari's pinch gestures, which ignore the
  viewport tag, are cancelled. One-finger scrolling, the Mall view's sideways scroll and every
  drag in the games still work. Computers keep their zoom. Anyone who needs larger text has
  Settings → Text size.
- **One action bar.** Every screen's forward actions sit in one bar
  (`src/components/ActionBar.tsx`), fixed to the bottom of the screen at every width so players
  always know where to look: Back and Continue on a level step,
  the next mission after one, Higher and Lower on the Daily Dollar, Take the challenge on a friend's
  plan, the hint or the next steps (with the stars and progress) on the budget desk, Share on the
  People's Budget and the Budget Story, and, on pages with no action of their own, the chapter's
  level or the next level to play. One bar per screen; a button the bar holds isn't repeated in the
  page. On phones its buttons fill the bar, in reach of a thumb; on wide screens they line up with
  the right edge of the page's column. The celebration opens as a sheet from the bottom with its
  next step pinned in reach.
- **Uncle Sam's speech strip** (`src/game/samhud.tsx`). When he speaks, his line runs right to
  left across the top bar's second line, beside him, at the pace he speaks it, so the word he is
  saying sits at the strip's left end next to him; words he has said dim, words to come stay
  bright. With his voice on, the strip follows the recording word for word (the narrator reports
  how far into the line he is, from the clip's own clock); with it off, it runs at his usual pace,
  timed from the same recordings. Then the line settles in place, and a tap on the strip or on him
  runs it again (and says it, when his voice is on). On a page with no line of his own, the strip
  names where you are. Pages say his lines with `<SamSays>`, which hands them to him
  (`src/game/samdock.tsx`); screen readers hear each line once. With less motion asked for, the
  line simply sits still.
- **Uncle Sam reacts, and has habits.** Every player action that gives feedback (`useHaptics`)
  makes him react from the top bar: a nod for a card or a step, a thumbs-up for a right answer, a
  scratch of the head and a question mark for a miss, a hat tip for a vote, a jump with his hat in
  the air for a win, a salute for a medal. While he waits (every 9 to 17 seconds, never while he
  speaks) he does one of his American habits: waves a little flag, tips his hat, checks his
  pocket watch, flips a quarter, whistles a tune, or salutes. With less motion asked for, he
  holds still.
- **Uncle Sam acts.** He is the main character, so he is never a still picture: he breathes,
  blinks and glances around while he waits, and looks toward his words while he speaks. Each mood
  has its own hands (a wave hello, then a hand that talks along with him; a hand on his heart when
  proud; wringing hands when worried; hands up in surprise; a hand at his chin when thinking; both
  arms up when cheering), and each new line starts with a small reaction (a nod, a jump, a
  bounce). His mouth follows his recorded voice: `scripts/voice/synth.py` stores how loud every
  1/15 of a second of each recording is, and the narrator opens his mouth to match (with a device
  voice, it opens on each word). With reduced motion he holds still.
- **One decision per screen.** Missions are audited step by step (words on screen, things to tap,
  rows): steps aim for about 80 words and no more than four or five things to handle at once.
  Sorting rounds deal one card at a time, already picked up ("Card 3 of 6"), so each card is one
  tap on a group. Mission 2.2 plays its memory game as two rounds of four pairs and the
  President's budget as two ordering rounds of three, with the official calendar in two steps
  (spring, summer); 2.4's Byrd-rule round is two rounds of four provisions; 1.2's "Every $100"
  is two steps of four categories, each with the full chart; vote introductions keep to the facts
  needed to vote.
- **Thumb-friendly.** Every control is at least 44 × 44 px on a touch screen.
- **Less on screen.** On phones the top bar holds the mission, stars, accomplishments and the
  main menu, with the sound switch at the start of Uncle Sam's strip, and the top bar's Continue moves down to the action bar at every width; the footer is one line, with the field guide
  and the note about the figures in Sources & methods; on the desk, the scoreboard and cards come straight after the title. Medal and badge
  messages share one stack under the top bar. The project note ("Independent civic education
  project. Not affiliated with any government agency.") appears only, quietly, at the foot of the
  You tab (Your record and the field guide): never on the main menu or during play.
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
- **Installed, it behaves like an app** (`public/manifest.webmanifest`, `index.html`,
  `src/lib/appmode.ts`):
  - its own window (`display: standalone`), held upright on phones (`orientation: natural`);
  - reopening it, a shortcut or a reminder brings back the window already open
    (`launch_handler: focus-existing`) and goes to the page asked for, without a reload;
  - a long press on the icon offers four shortcuts: Continue, the Daily Dollar, Build the Mall,
    Play together (their icons are drawn by `scripts/make-app-images.mjs`);
  - Chrome's richer install dialog shows a description and screenshots, four for phones and three
    for computers (`public/screens/`, by the same script);
  - the status bar matches the page, light or dark (`theme-color` per color scheme, following the
    theme picked in Settings), and the page paints dark from the first frame in dark mode
    (`color-scheme`);
  - iPhones don't turn the big dollar figures into phone-number links (`format-detection`);
  - on a touch screen there is no grey flash on a tap, and the app's controls and drawings aren't
    selected or given the long-press menu by a held finger, while reading text stays selectable;
  - installed, there is no pull-to-refresh or rubber-band bounce at the ends of the page.
  - on iPhone, a launch screen while it opens: the main menu's own scene with the whole Mall
    built (a golden morning in light, a floodlit night in dark), the title, and Uncle Sam waving
    hello. iOS picks one image per screen at its exact pixel size, so there are 26: 13 iPhone
    screens from the first iPhone SE to the iPhone 17 Pro Max and iPhone Air, light and dark,
    portrait (`public/launch/`, drawn by `scripts/make-launch-images.mjs`, which also writes the
    `apple-touch-startup-image` tags into `index.html`). Each phone downloads only its own
    (about 100 KB). Launched sideways, iOS shows the app's background color instead.
  On iPhone and iPad, iOS 26 opens any site added to the Home Screen as a web app; the
  `apple-touch-icon` and `apple-mobile-web-app-title` give it its icon and name.
- **Daily Dollar reminders.** An opt-in notification, at most once a day, at the hour the player
  picks (in settings, or on the Daily Dollar's finished screen). Sent with Web Push by a Supabase
  Edge Function that Cron runs hourly; no account or email. On iPhone it needs the game on the home
  screen first. Setup: [`supabase/README.md`](supabase/README.md#daily-dollar-reminders-web-push).
- **Something new each day.** Players see a "Today" card on the main menu: today's
  Daily Dollar (or when the next one is ready) and, on the public site, their People's Budget
  move.

### Sharing and coming back

Built from the Mambo.io list of 108 gamification elements, keeping the white-hat ones (meaning,
accomplishment, creativity, friendly rivalry) and leaving out the pressure tactics (timers,
expiring rewards, streaks that punish a missed day, public ranking of people).

- **Your name.** The game asks for a first name once (on level 1's card, in the challenge pop-up,
  or in settings), keeps it on the device, and uses it where it makes things personal: the card,
  challenge links and their message ("Ruth here. I balanced Uncle Sam's budget…"), the Budget
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
- **The budget duel** (`/p/duel/?duel=…`, `#duel`, `#duels`): the final mission (3.5) shares a duel instead of a
  challenge. The host's plan travels sealed in the invite (`hp`, `hlv`, `hph`, `hby`); the friend
  sees only that it exists and whether it balances the budget, plays level 10 on their own from
  a fresh plan (level 10 opens straight away, with no celebration pop-up), and taps "Reveal the
  duel". Both plans then go head to head in three rounds, best of three: **the debt** (debt held
  by the public as a share of GDP in the last projection year, lower wins), **the economy** (the
  steepest single-year tightening, gentler wins), and **the balance** (new taxes against spending
  cuts over the projection, cards and across-the-board changes alike, closer to half and half
  wins). Even after three rounds, the tie-breakers, in order: the gentler steepest year, then
  fewer policy cards; even on both is a true tie. The economy comes first so the scoring never
  rewards a steeper plan just for using fewer cards. The reveal shows what each plan does on its own and the cards they share. The friend
  sends a reply link (`/p/duel-back/?duelr=…`, both plans) back; the host sees the same rounds
  from their side. One invite goes to many friends: each reply is its own head-to-head, and the
  Duels page lists every one next to your plan, with "See the rounds" and "Rematch". Everything
  is in links and this browser's storage, with no accounts; plans are compared, never people.
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
  **The crowd** (`src/game/dailyCrowd.ts`, `supabase/migrations/20261117000000_daily_counts.sql`):
  each call, right or wrong, and each finished score is counted anonymously (only the puzzle, the
  call and the result, once per browser), and read back once 20 or more have answered: "61% of
  players got this one" after a call, and on the result screen how many played, the average, how
  many got all five, and the hardest call. **The share**: the text adds a streak ("🔥 5 days in a
  row") and a spoiler-free crowd line ("Call 4 tripped up 69% of players today"); the link goes
  through a preview card for its right/wrong pattern (`/p/daily-11011/`, 32 of them, made by
  `node scripts/make-daily-previews.mjs`) and carries the sharer's puzzle, pattern and first name
  (`?daily&dn=9&vs=11011&by=Ruth`), so a friend who plays the same puzzle sees both results side
  by side, and one from another day says which puzzle it was.
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
- **The debt clock** (`#clock`, and on the debt chapter): the Treasury's Debt to the Penny,
  carried forward second by second at the pace of the past twelve months, with each person's and
  household's share of it; a year at a time, each person's and household's share of the
  deficit, how much the debt grows in a year, and the year's interest cost (gross interest expense
  on the public debt); what has been added since the page opened, and the legal debt limit with the room left (Daily Treasury Statement, Table
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
- **Play together** (`#together`, and on the road map): the ways to play with other
  people, each with who it's for, how long it takes, and one button: a room for a class, club,
  or office; the Daily Dollar as a group-chat habit ("Invite the group"); pass the budget; and
  the level 10 duel.
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
fork) stays offline and shows only the player's own results. The page leads with figures and
charts, few words: four headline figures; columns for how far players got (each level) and for
each quick check right on the first try; a segmented bar for every vote; support and opposition
for each policy card from a center line (the top 10, or all); and a meter for each medal. Every
mark has a tooltip on hover and focus, every chart a table view with the full numbers, and the
player's own levels and answers are marked.

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

## Grow it

Two pieces of plumbing for growing the game without relying on anyone's personal social accounts.

**Partner codes.** Every newsletter, creator, teacher group or press piece gets its own link:
`https://balancethebudget.us/?via=<code>`, to any place in the game (`?via=tangle#daily`) or to a
state page (`/state/oh/?via=tangle`). Codes are 2 to 24 lowercase letters, digits or hyphens, and
any new code counts from its first visit (name known ones in `src/data/curated/partners.json`).
The game (`src/lib/partners.ts`) counts, anonymously and at most once per browser: the arrival,
then whether that player *played* (finished a mission step or a Daily Dollar), *finished* a
mission, *came back* on a later day, and *shared* something. The first code a browser arrives by
keeps the credit; the code is taken out of the address so links shared onward don't carry it.
The stats page (`#stats`, "Partners") lists each code's numbers with a CSV, and makes partner
links. Only a code and a metric are sent; the counts are daily totals
(`supabase/migrations/20261116000000_partner_counts.sql`, which must be run in Supabase once).

**State pages.** The game's own pages are places after a `#` (`#state-oh`), which search engines
treat as one page. `npm run state-pages` (`scripts/make-state-pages.mjs`) writes a real page for
each state and territory (`public/state/oh/`), an index (`public/state/`), a 1200×630 preview card
each (`public/state/img/`, made with Playwright), `sitemap.xml` and `robots.txt`. Each page has
its own title, description and address, the state's federal awards (USAspending.gov: total, per
person against the nation, by kind, top programs and agencies, change from the year before), who
paid federal income tax there (IRS county data, states and DC), its sources, and links into the
game that pass on a partner code from the page's address. Rerun it when the state figures change;
the game's state chapter links to each state's page.

**Daily Dollar posts (dry run).** `npm run social:drafts` (`scripts/social/compose.mjs`) writes the
brand accounts' three daily posts for review, to `social/drafts/<date>.md` (git-ignored), and posts
nothing. The puzzles come from the game's own code (`src/game/daily.ts`, loaded through Vite) and the
crowd's numbers from the public, read-only `daily_stats()`, so the posts match the game:
*morning* (7:30 AM ET), the puzzle's topic and first number; *midday* (1 PM ET), each call's share
right so far, by call number only, once every call has 20 answers (otherwise it's skipped);
*evening* (8 PM ET), yesterday's numbers, its hardest call told the right way round, and the source.
Each platform's version fits its length (Bluesky 300, Mastodon 500), dropping detail before the
source, and its link carries the platform's partner code (`?via=bot-bluesky`). `--date` and
`--days` preview other days; `npm run test:social` checks the rules (no spoilers, lengths, codes,
no party or ideology words; the Bluesky client against a stand-in). `.github/workflows/social-drafts.yml`
runs three times a day and puts the drafts on the run's summary page (Actions tab).

**Posting to Bluesky and Mastodon** (`scripts/social/post.mjs`, `bluesky.mjs`, `mastodon.mjs`) is off until the
repository variable `SOCIAL_POSTING` is `on`. It signs in with the variable `BLUESKY_HANDLE` (the
account's handle, e.g. `dailydollar.bsky.social`) and the secret `BLUE_SKY_APP_KEY` (an app
password, never the account password), and posts the same text the drafts show, with a clickable
link and a link card. A skipped slot isn't posted, and a text already among the account's recent
posts isn't posted again, so re-running is safe. `node scripts/social/post.mjs --slot morning`
prints what it would post. To post one by hand: Actions → Daily Dollar posts → Run workflow, pick
a slot. To stop: set `SOCIAL_POSTING` to anything but `on`. Mastodon posts with the variable `MASTODON_INSTANCE`
(the server, e.g. `https://mastodon.social`) and the secret `MASTODON_ACCESS_TOKEN` (an access
token with `write:statuses`; with `read` too, a text already posted is recognized). The app's
client key and secret aren't needed to post. Each platform posts on its own: one that isn't set
up is skipped with a note, and one that fails doesn't stop the other.

**Bills in the claude.ai copy.** Fresh bills (sponsors, floor votes, summaries) are fetched from
Congress.gov only on the deploy, with the repository's key, and the deploy publishes them as
`/bills-full.json` (not committed). `npm run build:artifact` first runs `scripts/pull-bills.mjs`,
which takes that file from the site when it's newer than the local one, so the claude.ai copy shows
the same bills as the site; if the site can't be reached, it builds with the local file.

**The plan receipt** (`src/game/receipt.ts`): finishing a budget desk shares a receipt instead of a
plain line, previewed on the completion screen exactly as it will be posted, with a matching
1200×630 image: whose plan, the mission and stars, what it achieved; the plan style (🟩 gentle,
🟨 moderate, 🟥 steep, from the hit to the economy), the cards played and the budget personality;
how the savings split between spending cuts and taxes, five blocks each (only while the player
keeps "Show how my plan splits spending cuts and taxes" on; the choice is remembered); the
biggest moves by budget area; and a dare matched to what a friend could still beat (gentler,
three stars, fewer cards). It reports and doesn't judge: no party, ideology or blame words.

## Test it

The browser tests live in `tests/e2e/`: 42 Playwright scripts, one per area of the game, each
driving an emulated phone (or desktop) against the dev server. Every request to Supabase is
intercepted, so nothing reaches the live database. `tests/e2e/run.mjs` starts the dev server on
port 5173 and runs them on three workers, longest first, re-running anything that fails under
load once on its own (reported as "flaky" if it then passes).

```bash
npm run test:e2e        # quick tier: eight smoke tests, about 1.5 minutes
npm run test:e2e:full   # everything, about 8-11 minutes
node tests/e2e/run.mjs --only zip,county   # named tests
node tests/e2e/run.mjs --tier full --plan  # what would run, and what is skipped and why
```

The quick tier (check, cardfit, deskui, feed, zip, quick, seal, voicecheck) is for every change;
the full tier is for before a merge. In a full run, the three slowest tests that guard
slow-changing areas run only if files in their area changed since the last full run that passed
on that machine: `launch` (launch screens), `mgames` (the mission games) and `nohint` (the budget
desks). `--all` runs them anyway. Logs go to `tests/e2e/.runs/` and screenshots to
`tests/e2e/out/` (both git-ignored). The tests need Playwright with Chromium installed
(`require('playwright')` must resolve). The database tests are separate: `npm run test:db`,
`npm run test:rollcall` and `npm run test:alerts`.

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
npm run data:county    # county income tax and ZIP-to-county files, public/county/<ST>.json
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
| Tax returns and income tax after credits by county and income (tax year 2023) | IRS Statistics of Income, county data (`23incyallagi.csv`) | irs.gov file (`scripts/fetch-county-tax.mjs`; the 36 MB download isn't committed) |
| Which county a ZIP is in | Census Bureau 2020 ZCTA relationship files (to counties and, for Connecticut, to towns) and the Connecticut planning-region crosswalk | www2.census.gov files (`scripts/fetch-county-tax.mjs`; Connecticut's nine planning regions replaced its counties in 2022, so its ZIPs go to towns, then regions) |
| 2026 tax brackets, standard deduction, payroll tax parameters | IRS Rev. Proc. 2025-32, Publication 15, Topic 560 | irs.gov documents, recorded in `src/data/curated/tax.json` |
| Social Security and Medicare trust fund projections | 2026 Social Security and Medicare Trustees Reports | `src/data/curated/trustees.json` (cited) |
| Spending and tax bills in the feed: status, sponsor, latest action, CRS summaries, CBO cost estimates | Congress.gov (Library of Congress) | Congress.gov API (`scripts/fetch-bills.mjs`, every few hours in the Pages workflow; a free api.data.gov key in the repository secret `CONGRESS_API_KEY`; the shared DEMO_KEY only for runs by hand) |
| Laws' deficit effects; budget-process history; who benefits | CBO/JCT cost estimates; CRS reports; agency statistics | `src/data/curated/*.json` (each entry cites its official URL) |

CBO's projections are the preferred benchmark for the gap chart and the sandbox. The pipeline uses
them automatically when `data/raw/cbo/baseline.parsed.json` exists; otherwise it uses OMB's
estimates and labels them as the President's budget.

## Code map

- `src/game/` the game layer: `levels.tsx` (level content; every figure and quiz answer is computed
  from the data), `LevelPage.tsx` (step wizard), `Journey.tsx` (the main menu, the road map, your record), `Celebrate.tsx`
  (level-complete card), `StatusBar.tsx`, `LawExplorer.tsx`, `quotes.ts`, `state.tsx` (progress
  and settings), `voice.tsx` (speech: voice choice, mood prosody), `UncleSam.tsx` (character),
  `haptics.ts` and `sfx.ts` (vibration and sound feedback), `resume.ts` (reopening the installed
  app where the player left off), `build/` (Build the Mall: `landmarks.ts` the jobs, facts and the
  star ledger; `art.tsx` the six landmarks, in parts; `anim.ts` the building; `mall.tsx` the view of
  the whole Mall; `BuildPage.tsx` the pages).
- `src/pages/` one file per field-guide section; `src/components/charts.tsx` the D3-based charts;
  `src/components/USMap.tsx` the state map; `src/lib/` formatting, categories, tax and sandbox math.
- `src/data/types.ts` is the contract between the pipeline and the app.
- Chart colors are a validated categorical palette (colorblind-safe order, both themes).
