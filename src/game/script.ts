// Uncle Sam's lines outside the level content, in one place. Keeping them here means every
// sentence he can say can be listed ahead of time and recorded (see scripts/voice/).
import optionsJson from '../data/curated/options.json';

export const QUIZ_LINES = {
  ask: (question: string) => `Quick check. ${question}`,
  prompt: 'Quick check. Take your best guess; there’s no penalty.',
  wrong: 'Not quite. Want to try again?',
  right: 'That’s right!',
  rightLater: 'You got it. Nice work sticking with it.',
  reveal: 'That one’s tricky. Here’s the answer.',
  revealSay: (answer: string) => `That one’s tricky. Here’s the answer. It’s ${answer}.`,
  // A guess comes before the answer is shown: one pick, then the answer, and no effect on stars.
  guessPrompt: 'Take a guess. There’s no wrong answer, and guesses don’t count toward stars.',
  guessAsk: (question: string) => `Take a guess. ${question}`,
  guessRight: 'Good guess!',
  guessReveal: 'Good try. Here’s the answer.',
  guessRevealSay: (answer: string) => `Good try. It’s ${answer}.`,
};

export const lockedLine = (unlock: string) => `We’ll get there. This mission builds on the one before it. ${unlock}.`;

export const CHEER: Record<number, string> = {
  3: 'Well done, partner! Three stars. You have a real head for this.',
  2: 'Nicely done! That’s another mission in the books.',
  1: 'We made it through that one together. On to the next!',
  0: 'We made it through that one together. On to the next!',
};

export const DESK_PARTY: Record<number, string> = {
  3: 'Three stars! We fixed it without knocking the economy flat, and both taxes and spending pitched in. Well done, partner!',
  2: 'We did it, partner! That plan meets the goal. Replay any time to go for three stars.',
  1: 'We did it! The goal is met. There are more stars to earn if you go easier on the economy and share the load.',
  0: 'We did it! The goal is met. There are more stars to earn if you go easier on the economy and share the load.',
};

export const COACH = {
  met3: 'Three stars! That’s a plan I could take to Congress.',
  met: 'We did it! Now, can we earn the other stars too?',
  startStabilize: 'My debt is still outgrowing the economy. Pick a card to get us started.',
  start: 'We haven’t made a dent yet. Pick a card to get us started.',
  steep: 'Whoa, easy now. That’s a steep hit to the economy in a single year. Try phasing it in, or swap a card for a gentler one.',
  cardsShort: 'The cards alone won’t get us all the way. We’ll need some across-the-board changes too. They’re right under the cards.',
  almost: 'Almost there! One more card should do it.',
  partway: 'Good progress. We’re partway there.',
  begun: 'That’s a start. Keep going.',
};

// Level 5's hint: one card to try (by name), or what earns the next star once the goal is met.
export const HINT_LINES = {
  card: (name: string) => `Here’s a hint: try “${name}.”`,
  finishes: 'On its own, it would finish the job, and gently.',
  bigShare: 'It closes a big share of what’s left.',
  gentle: 'We met the goal. For another star, go easier on the economy: phase it in, or swap a card for a gentler one.',
  addTax: 'For another star, share the load: add a tax card, so spending cuts aren’t doing all the work.',
  addCut: 'For another star, share the load: add a spending cut, so taxes aren’t doing all the work.',
  done: 'Three stars. I wouldn’t change a thing.',
  stuck: 'Stuck? Tap Hint, and I’ll point you to a card.',
};

export const VOICE_TEST = 'Howdy, partner. This is Uncle Sam. Let’s get my books in order.';

export const JOURNEY_LINES = {
  fresh: (tookIn: string) => `Howdy. I’m Uncle Sam. I took in ${tookIn} last year, and I still spent more than I made. I need a level-headed adviser to help me understand my books and decide what to do. Got a few minutes?`,
  finished: 'We did it, partner. You’ve seen where every dollar comes from and goes, and you’ve weighed in on the big choices. That makes you an informed budget voter.',
  hardNext: (rank: string) => `Welcome back, ${rank}. Next up is a hard one: this campaign’s final mission, where we try to fix my budget ourselves. Take your time.`,
  back: (rank: string) => `Welcome back. You’re my ${rank} now. Let’s pick up where we left off.`,
};

// The level 1 card ("my share of Uncle Sam"), and asking the player's name.
export const ME_LINES = {
  celebrate: 'Your card is ready, partner. It shows what your taxes do for the whole country. Put your name on it and show your friends.',
  page: 'Here’s your share of my household, partner. Put your name on your card and see what your friends chip in.',
};

// The debt clock: Treasury's own figure, ticking at the pace of the past year.
export const CLOCK_LINES = {
  intro: 'That’s my debt, ticking up as we speak. It starts from the Treasury’s own count, and it grows every second.',
  limit: 'There’s a legal limit on how much I can borrow. When I get close to it, Congress has to act.',
};

// Playing together: rooms for a class or club, the Daily Dollar with a group, pass the budget.
export const TOGETHER_LINES = {
  intro: 'Budgets are better with company. Pick a way to play together: with your class, your group chat, or a few friends.',
  teach: 'Teachers, this one’s for your class. Everybody plays on their own phone, and the class builds one plan together. No accounts, no sign-ups.',
};

// The level 10 duel: two plans built blind, then compared in three rounds.
export const DUEL_LINES = {
  invite: 'A friend wants a duel, partner! You each balance my budget on your own, then we compare three rounds: the debt, the economy, and the balance.',
  playing: 'Their plan is sealed until you reveal yours. Balance my budget your way, then tap Reveal the duel.',
  host: 'Your plan is sealed in this link. Send it to as many friends as you like, and each reply gets its own head-to-head.',
  won: 'Your plan takes the duel, partner! Send it back to your friend, then see who else wants a go.',
  tied: 'An even duel! Two good plans, built different ways. Send yours back and compare notes.',
  lost: 'Their plan takes this one. Want a rematch? Every round can swing with a card or two.',
  list: 'Here’s every duel on this device: your plan next to each friend’s. Plans get compared, never people.',
  broken: 'Hmm, this duel link looks incomplete, partner. Ask your friend to send it again.',
};

export const PLAN_LINES = {
  intro: 'A friend sent you their plan for my budget. Have a look, then see if you can do better.',
  played: 'You’ve played this mission too. Here’s how your plan stacks up against theirs.',
  broken: 'Hmm, this link looks incomplete, partner. Ask your friend to send it again.',
};

export const CHALLENGE_LINES = {
  won: 'You beat their plan! Send yours back and see if they can top it.',
  tied: 'Dead even. Great minds think alike, partner.',
  lost: 'Goal met, but their plan still edges out yours. Fancy another go?',
  start: 'Your move, partner. Pick cards below to get going.',
};

export const STORY_LINES = {
  ready: 'Here’s your Budget Story, partner: a few cards about how you’d run my books. Share the ones you like.',
  locked: 'Your story unlocks when you finish your first campaign. Its final mission is at the budget desk.',
};

export const DAILY_LINES = {
  intro: 'Here’s today’s Daily Dollar. Five quick calls: is the next number higher or lower?',
  // Themed weeks (see daily.ts): said before "Five quick calls…".
  budgetWeek: 'It’s Budget Week, partner. My budget request is due to Congress, so all week the Daily Dollar is about my budget.',
  taxWeek: 'It’s Tax Week. Returns are due on Tax Day, so all week the Daily Dollar is about taxes.',
  taxDay: 'It’s Tax Day! Returns are due today, so today’s numbers are all about taxes.',
  // Deadline editions (see daily.ts): the week before a funding deadline or a debt-limit date.
  shutdownWeek: 'It’s Shutdown Watch, partner. My funding runs out soon unless Congress acts, so all week the Daily Dollar is about what Congress pays for each year.',
  shutdownDay: 'Today’s the deadline. If Congress doesn’t act, my funding runs out at midnight, and parts of my government shut down.',
  debtWeek: 'It’s Debt Limit Watch. I’m close to the legal limit on what I can borrow, so all week the Daily Dollar is about my debt.',
  debtDay: 'Today’s the day I hit the legal limit on what I can borrow. The Daily Dollar is all about my debt.',
  calls: 'Five quick calls: is the next number higher or lower?',
  done: 'You’ve played today’s. A new one is ready tomorrow, partner.',
  score: [
    'Zero today, but now you know five new things about my budget.',
    'One out of five. These numbers surprise just about everyone.',
    'Two out of five. Tricky ones today.',
    'Three out of five. Not bad at all.',
    'Four out of five. Sharp work, partner.',
    'A perfect five! You really know my books.',
  ],
};

// Uncle Sam's reaction the first time a card is played: one true, surprising fact about it.
// Ten-year amounts come from the same CBO data as the cards.
const TEN = Object.fromEntries((optionsJson as { options: { id: string; savings10: number }[] }).options.map((o) => [o.id, o.savings10]));
const ten = (id: string) => { const b = TEN[id] ?? 0; return b >= 1000 ? `$${(b / 1000).toFixed(1)} trillion` : `$${Math.round(b)} billion`; };
export const REACT: Record<string, string> = {
  'income-tax-rates-1pt': `One point on every income tax rate sounds small. CBO says it brings in about ${ten('income-tax-rates-1pt')} over ten years.`,
  'corp-rate-1pt': `Each point on the corporate tax rate is worth about ${ten('corp-rate-1pt')} over ten years. The rate is 21% today.`,
  'ss-tax-earnings-over-250k': `Right now, Social Security tax stops at a cap on each worker’s earnings. Taxing earnings above $250,000 too raises about ${ten('ss-tax-earnings-over-250k')} over ten years.`,
  'carbon-tax-25': `A carbon tax raises about ${ten('carbon-tax-25')} over ten years. Economists like that it discourages pollution, but without rebates it lands hardest on lower-income families.`,
  'vat-5pct': `That’s the biggest card on the table: about ${ten('vat-5pct')} over ten years. The United States is the only wealthy OECD country without a value-added tax.`,
  'cap-health-exclusion': `The tax break for health insurance through work is the biggest single break in the tax code. Capping it raises about ${ten('cap-health-exclusion')} over ten years.`,
  'limit-itemized-15pct': `Limiting what itemized deductions can save raises about ${ten('limit-itemized-15pct')} over ten years, without changing a single tax rate.`,
  'gas-tax-15c': `The federal gas tax has been 18.4 cents a gallon since 1993. Fifteen cents more brings in about ${ten('gas-tax-15c')} over ten years.`,
  'alcohol-tax': `About ${ten('alcohol-tax')} over ten years. Real money, but only a sliver of the gap.`,
  'carried-interest': `Carried interest gets plenty of headlines, but CBO puts it at about ${ten('carried-interest')} over ten years. It barely moves the bar.`,
  'medicare-advantage-benchmarks': `More than half of people on Medicare now pick a private Medicare Advantage plan. Paying those plans less saves about ${ten('medicare-advantage-benchmarks')} over ten years.`,
  'site-neutral-hospital-outpatient': `Medicare often pays more for the same visit at a hospital-owned clinic than at a doctor’s office. Paying one rate saves about ${ten('site-neutral-hospital-outpatient')} over ten years.`,
  'part-b-premium-35pct': `Part B premiums cover about a quarter of what that part of Medicare costs. Raising that share saves about ${ten('part-b-premium-35pct')} over ten years, paid by people on Medicare.`,
  'medicaid-per-enrollee-caps': `Capping federal Medicaid money per enrollee saves about ${ten('medicaid-per-enrollee-caps')} over ten years, and leaves states to cover the rest or cut back.`,
  'raise-full-retirement-age-70': `Raising the retirement age to 70 sounds huge, but it phases in so slowly that it saves only about ${ten('raise-full-retirement-age-70')} in the first ten years. The big savings come later.`,
  'chained-cpi': `A slower inflation measure trims every yearly raise just a little: about ${ten('chained-cpi')} over ten years, growing over time.`,
  'ss-benefits-high-earners': `This one phases in slowly, so it saves only about ${ten('ss-benefits-high-earners')} in ten years. It matters more in later decades.`,
  'cut-defense-budget': `Defense is the biggest bill Congress votes on each year. This cut saves about ${ten('cut-defense-budget')} over ten years.`,
  'cut-transport-education-grants': `Cutting these grants by a third saves about ${ten('cut-transport-education-grants')} over ten years, and roads, transit, and schools in every state would feel it.`,
  'crop-insurance-subsidies': `Crop insurance subsidies come to about ${ten('crop-insurance-subsidies')} over ten years. Real money, and still small next to the gap.`,
};

export const PEOPLES_LINES = {
  intro: 'This one belongs to everybody. Each of you gets one move a day: push one card in or out. Let’s see what the whole country builds.',
  moved: 'Thanks, partner. That’s your move for today. Come back tomorrow for another.',
  met: 'Look at that! Together, folks have stopped my debt from outgrowing the economy.',
  offline: 'The People’s Budget lives on the public site, balancethebudget.us. Come build it with everyone.',
};

export const ROOM_LINES = {
  start: 'Bring your class, your office, or your family. Everybody plays, and the group builds one plan together.',
  invited: 'You’ve been invited to a room. Join, and your plan counts toward the group’s.',
  welcome: 'Welcome to the room, partner. Play the mission, and your plan joins the group’s.',
  missing: 'I can’t find a room with that code. Check it with whoever shared it.',
  offline: 'Rooms live on the public site, balancethebudget.us. Start one there.',
};

export const CHAIN_LINES = {
  start: 'Here’s one for a group. Each person makes one change to my budget, then passes it along. Let’s see how many hands it takes.',
  turn: 'It’s your turn, partner. Add one card or take one out, then pass it on.',
  passed: 'Nicely done. Now pass it along to the next person.',
  done: 'That did it! Together, your chain fixed my budget.',
};
