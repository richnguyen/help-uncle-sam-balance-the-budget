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
  bar and no action bar. Each choice leads to its own page, and every page leads back with one
  tap ("Main menu", top left; in a level, the top bar's Main menu button). The layout follows how
  people scan a screen: the big choices on the left, biggest first (Continue or Start the game,
  then the Daily Dollar, Play together, the field guide, Settings), each with an icon, a title and
  one line. The three campaigns sit inside Continue ("Campaign 1", "Campaign 2",
  "Campaign 3"); a tap opens the road map (`#levels`) at that campaign; in the top-right corner, the music and sound switches and the player's
  record (rank, stars, missions, medals), with this year's deficit running under them. Nothing
  else: no corner links and no data line. Choices light up, slide and show an arrow under the
  pointer or keyboard focus, and press in on a tap. Uncle Sam greets the player close up, standing
  right on top of the menu buttons at the right with a plain speech bubble (no glass pane). At the
  bottom runs the **Headlines line**: a single-line news crawl (shutdown
  watch, debt-limit watch, official announcements about spending and taxes, the Daily Dollar,
  the People's Budget, and what's new in the game) that runs right to left without a seam, pauses under the pointer, on focus or with its pause
  button, and holds still (scrollable by hand) for people who ask for less motion.
- **Official news on the Headlines line** (`scripts/fetch-news.mjs` → `src/data/generated/news.json`,
  `src/game/news.ts`): the White House's presidential actions about taxes, tariffs, spending, the
  budget or the debt; CBO's latest cost estimates and reports; and, from Congress.gov, spending
  and tax bills on the Senate and House floors that day and bills sent to the President. Each
  item carries its source, its time in Eastern time ("3 hr ago", "Yesterday, 4:12 PM ET", "Fri,
  Nov 6, 2:00 PM ET"), the source's own headline, and a link to the official page. Other White
  House releases are left out, because many are political messaging and the game doesn't take
  sides. The Pages workflow fetches the feeds and redeploys every three hours (a failed fetch
  keeps the news in the repo); on the public site the browser also reads Congress.gov's floor
  feeds live. Items older than three weeks drop off. `npm run news` refreshes the file locally.
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
  October alone.) Under it, a year at a time: the past twelve months' deficit (all of the last
  fiscal year, once its September is counted), every person's share of it (the past twelve
  months' deficit divided by the population), how much the debt grows in a year, and the year's interest cost (the Treasury's gross interest expense
  on the public debt, not the budget's net interest). The debt clock (`#clock`) uses the same
  annual figures.
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
  title in its sky, and the choices follow. The road map, the record (fact cards, ballot,
  medals, certificates) and Settings are pages of their own (`#levels`, `#record`, `#settings`).
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
  what earns the next star; the player still plays it. Elsewhere the star tips say what earns each
  star, never which card to play; when the cards alone can't reach the goal, the across-the-board
  changes sit right under them.
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
- **Your county** (mission 1.4's next step; `src/game/county.tsx`): who paid the federal income
  tax in the player's county, by income, next to the whole country. The county comes from the ZIP
  typed a step earlier (kept for that visit only; this step saves nothing) or from this step's own
  ZIP box, and a picker lists every county in the state, plus "All of" the state. A ZIP that
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
  Line one, in larger text: the current mission and its name ("Mission 2.4 · Rules of the road",
  truncated to fit on phones) and your title, which opens the list of every mission by campaign
  plus the field-guide chapters; then stars, accomplishments (medals and budget-desk badges), and
  Main menu. Line two: Sound on/off (his voice; an icon on phones) at the start of his strip, then
  his words, running right to left beside him, the word he's saying at the left end next to him. The glossary and Sources & methods are in the
  field guide and the footer; Settings is the gear on the main menu.
- **A mission page wastes no room on repeats** (`src/game/LevelPage.tsx`): one compact line
  with the mission's title, its difficulty, its time and your best stars (no campaign eyebrow,
  since the top bar has the mission's code); then one line of steps, as tabs (done ones filled
  and checked, the current one ringed; tap one to go back). On phones only the current step keeps
  its name. "Step 2 of 4" is kept for screen readers. The intro step shows the mission's one-line
  brief while Uncle Sam tells the story in the top bar. Then comes the step itself.
- **Settings** (the gear on the main menu, `#settings`): text size, light/dark theme, voice choice, vibration, and
  free roam to unlock everything.
- **The fine print:** each level's full field-guide chapter and original government documents
  are gathered on Sources & methods ("By mission"), one link from every mission. The field guide
  (all earlier pages) is listed in the top bar's level menu and in every page's footer.

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
- **Every job teaches one true thing,** said by Uncle Sam as it goes up: where work stopped on the
  Washington Monument in 1854 and why the marble changes color, why the Lincoln Memorial has 36
  columns, how Philip Reid, an enslaved worker at the foundry, worked out how to cast the Statue
  of Freedom. Each fact was checked against the National Park Service, the Architect of the
  Capitol, the Senate, the White House Historical Association or the Treasury, and each landmark
  lists its sources. A finished landmark sends a postcard with three more facts.
- **Accomplishments unlock the finishing touches:** medals and budget-desk badges unlock each
  landmark's decoration (the ring of 50 flags, Lincoln lit at night, the cherry trees on the
  Tidal Basin, Hamilton's statue, the South Lawn fountain, fireworks over the Capitol).
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
  Mall is the menu's second choice, with the stars to spend; Settings is the gear beside the
  music and sound switches.
- A sunny day in the light theme, a floodlit night with lit windows in the dark.

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
- **Thumb-friendly.** Every control is at least 44 × 44 px on a touch screen.
- **Less on screen.** On phones the top bar holds the mission, stars, accomplishments and the
  main menu, with the sound switch at the start of Uncle Sam's strip, and the top bar's Continue moves down to the action bar at every width; the footer is one line, with the field guide
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
- **Something new each day.** Players see a "Today" card on the main menu: today's
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
- **The budget duel** (`/p/duel/?duel=…`, `#duel`, `#duels`): the final mission (3.5) shares a duel instead of a
  challenge. The host's plan travels sealed in the invite (`hp`, `hlv`, `hph`, `hby`); the friend
  sees only that it exists and whether it balances the budget, plays level 10 on their own from
  a fresh plan (level 10 opens straight away, with no celebration pop-up), and taps "Reveal the
  duel". Both plans then go head to head in three rounds, best of three: **the debt** (debt held
  by the public as a share of GDP in the last projection year, lower wins), **the economy** (the
  steepest single-year tightening, gentler wins), and **the balance** (new taxes against spending
  cuts over the projection, cards and across-the-board changes alike, closer to half and half
  wins). Even after three rounds, the tie-breaker: the plan with fewer policy cards wins; the
  same number is a true tie. The reveal shows what each plan does on its own and the cards they share. The friend
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
