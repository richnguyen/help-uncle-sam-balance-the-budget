import { Term } from '../components/ui';
import { debt } from '../data';
import { dateLabel, moneyWords } from '../lib/format';
import type { Level, Quiz } from './levels';
import { OrderRound } from './rounds';
import { ApportionRound, BalanceRound, MemoryRound, RefereeRound, StrikeRound } from './rounds2';

// Four missions on how Congress actually budgets, from the Congressional Research Service's
// "Introduction to the Federal Budget Process" (R46240, updated January 10, 2023): how a dollar
// becomes a check, who does what, the rules Congress referees itself by, and the brakes built into
// the budget. Where a game uses a made-up example to practice a real rule, it says so on screen.

const CRS = { title: 'CRS, Introduction to the Federal Budget Process (R46240), updated January 10, 2023', url: 'https://www.congress.gov/crs-product/R46240' };

// ---------- 1.3 Paying the bills ----------
const FLOW: Quiz = {
  id: 'pbflow', question: 'Is each step permission to spend, a promise to pay, or the payment?',
  choices: ['the appropriation as budget authority; the contract, hiring, and purchase order as obligations; and the check and electronic payment as outlays'], correct: 0,
  sort: {
    bins: [{ id: 'ba', label: 'Budget authority: permission to spend' }, { id: 'ob', label: 'Obligation: a promise to pay' }, { id: 'out', label: 'Outlay: the payment' }],
    items: [
      { id: 'approp', label: 'Congress passes an appropriation', bin: 'ba' },
      { id: 'contract', label: 'An agency signs a contract', bin: 'ob' },
      { id: 'eft', label: 'The Treasury sends an electronic payment', bin: 'out' },
      { id: 'hire', label: 'An agency hires an employee', bin: 'ob' },
      { id: 'check', label: 'A check goes out', bin: 'out' },
      { id: 'order', label: 'An agency places a purchase order', bin: 'ob' },
    ],
    prompt: 'Drag each step where it belongs, or tap it and then a group.',
  },
  explain: <>Congress controls spending at the first step, when it provides <Term id="appropriations">budget authority</Term>. Agencies then make <Term id="obligation">obligations</Term>: they sign contracts, place orders, and hire people. The Treasury’s payments are <Term id="outlays">outlays</Term>, which can come years later.</>,
};
export const MONTHS: { month: string; label: string; cost: number }[] = [
  { month: 'Oct', label: 'New laptops', cost: 4 }, { month: 'Nov', label: 'Fix the roof', cost: 9 }, { month: 'Dec', label: 'Staff training', cost: 3 },
  { month: 'Jan', label: 'Upgrade the website', cost: 6 }, { month: 'Feb', label: 'Emergency repairs', cost: 5 }, { month: 'Mar', label: 'New vehicles', cost: 8 },
  { month: 'Apr', label: 'Translation services', cost: 2 }, { month: 'May', label: 'Lab equipment', cost: 7 }, { month: 'Jun', label: 'Summer interns', cost: 3 },
  { month: 'Jul', label: 'A security upgrade', cost: 6 }, { month: 'Aug', label: 'Restock supplies', cost: 4 }, { month: 'Sep', label: 'Year-end purchases', cost: 10 },
];
const SHUTDOWN: Quiz = {
  id: 'pbshut', question: 'Funding lapses. Which of these keep going, and which stop until it returns?',
  choices: ['Social Security checks, air traffic control, and guarding federal buildings keep going; new grants, new contracts, and routine office work stop'], correct: 0,
  sort: {
    bins: [{ id: 'go', label: 'Keeps going' }, { id: 'stop', label: 'Stops until funding returns' }],
    items: [
      { id: 'ss', label: 'Social Security checks, paid under permanent law', bin: 'go' },
      { id: 'grant', label: 'Starting a new grant this year', bin: 'stop' },
      { id: 'atc', label: 'Air traffic control, which protects human life', bin: 'go' },
      { id: 'office', label: 'Routine office work funded by this year’s spending bills', bin: 'stop' },
      { id: 'guard', label: 'Guarding federal buildings, which protects property', bin: 'go' },
      { id: 'contract', label: 'Signing new contracts for that routine work', bin: 'stop' },
    ],
    prompt: 'Drag each one to where it belongs, or tap it and then a group.',
  },
  explain: <>In a <Term id="shutdown">funding lapse</Term>, the Antideficiency Act bars new obligations except as authorized by law. Under the Justice Department’s Civiletti opinions of 1980 and 1981, agencies keep only work that protects human life or property; programs paid under permanent law, like Social Security, keep paying. Other employees are furloughed until funding returns.</>,
};
const TRANSFER: Quiz = {
  id: 'pbmove', question: 'An agency wants to move money from one of its appropriation accounts to another. What does it need?',
  choices: ['Specific authority in law: that’s a transfer', 'Nothing: agencies can move money freely', 'Only a note to its own staff'], correct: 0,
  explain: <>Moving money between accounts is a transfer, allowed only where a law says so, and Congress is told. Shifting money within one account is reprogramming: usually allowed without new law, often with notice to the committees. Either way, the original restrictions follow the money.</>,
};

// ---------- 2.2 Who’s who ----------
export const PLAYERS = [
  { id: 'pres', who: 'The President', what: 'Sends Congress a budget request by the first Monday in February' },
  { id: 'omb', who: 'OMB, the White House budget office', what: 'Reviews agencies’ requests and sends back the “passback”' },
  { id: 'cbo', who: 'CBO', what: 'Estimates what bills cost and projects the baseline' },
  { id: 'budget', who: 'The Budget Committees', what: 'Write the budget resolution' },
  { id: 'approps', who: 'The Appropriations Committees', what: 'Write the 12 yearly spending bills' },
  { id: 'tax', who: 'Ways and Means, and Senate Finance', what: 'Write tax laws and the debt limit' },
  { id: 'jct', who: 'The Joint Committee on Taxation', what: 'Estimates what tax bills will raise or cost' },
  { id: 'gao', who: 'GAO', what: 'Audits federal spending and polices impoundments' },
];
export const PRES_BUDGET = [
  { id: 'agencies', label: 'Agencies send their requests to OMB', detail: 'late summer or early fall' },
  { id: 'passback', label: 'OMB sends back its “passback,” and agencies can appeal', detail: 'after OMB reviews the requests' },
  { id: 'submit', label: 'The President submits the budget to Congress', detail: 'by the first Monday in February' },
  { id: 'cbo', label: 'CBO reports on the budget and economic outlook', detail: 'February 15' },
  { id: 'views', label: 'Committees send their views and estimates to the Budget Committees', detail: 'within 6 weeks of the President’s budget' },
  { id: 'msr', label: 'The President sends a Mid-Session Review', detail: 'before July 16' },
];
const REQUEST: Quiz = {
  id: 'wwreq', question: 'The President’s budget is…',
  choices: ['A request: Congress decides what becomes law', 'Law as soon as the President signs it', 'Binding on Congress unless it votes the budget down'], correct: 0,
  explain: <>It shows the President’s priorities and often shapes what Congress does, but nothing in it takes effect unless Congress passes it into law. The requirement dates to the Budget and Accounting Act of 1921, which also created what is now <Term id="omb">OMB</Term>.</>,
};
const TIMETABLE = [
  ['First Monday in February', 'The President submits the budget.'],
  ['February 15', 'CBO reports on the economic and budget outlook.'],
  ['Within 6 weeks of the President’s budget', 'Committees send views and estimates to the Budget Committees.'],
  ['April 1', 'The Senate Budget Committee reports a budget resolution.'],
  ['April 15', 'Congress finishes the budget resolution.'],
  ['May 15', 'The House may begin the yearly spending bills.'],
  ['June 10', 'House Appropriations reports its last spending bill.'],
  ['June 15', 'Congress finishes any reconciliation bill.'],
  ['June 30', 'The House finishes the yearly spending bills.'],
  ['October 1', 'The fiscal year begins.'],
];

// ---------- 2.4 Rules of the road ----------
export const BILLS = [
  { label: 'Highway safety grants', cost: 16 },
  { label: 'Weather satellites', cost: 12 },
  { label: 'Fixing up national parks', cost: 15 },
  { label: 'Wildfire response', cost: 9, waive: 62 },
  { label: 'A new museum wing', cost: 3, waive: 54 },
  { label: 'Ending an outdated program', cost: -4 },
];
export const PROVISIONS = [
  { label: 'Raise the tax rate on very large estates', budget: true },
  { label: 'Rename a federal courthouse', budget: false },
  { label: 'Change the formula for a farm subsidy', budget: true },
  { label: 'Cut Medicare payments to hospitals by 2 percent', budget: true },
  { label: 'Require an agency to write a report on office morale', budget: false },
  { label: 'Expand a tax credit for families', budget: true },
  { label: 'Set new rules for how members file ethics forms', budget: false },
  { label: 'Auction more of the airwaves', budget: true },
];
const HOURS: Quiz = {
  id: 'rrhours', question: 'In the Senate, debate on a reconciliation bill is capped at how many hours?', choices: ['20 hours'], correct: 0,
  estimate: { min: 0, max: 100, step: 1, start: 50, answer: 20, spot: 0, close: 5, format: (v) => `${v} hours`, diff: (d) => `${d} hour${d === 1 ? '' : 's'}`, prompt: 'Drag to the hours', marks: [{ at: 50, label: 'a budget resolution' }] },
  explain: <>Twenty hours, split between the parties; a budget resolution gets 50. When time runs out, amendments can keep coming with no debate: the “vote-a-rama.” Because debate ends on its own, no 60-vote cloture is needed, so a simple majority can pass a <Term id="reconciliation">reconciliation</Term> bill.</>,
};
const VETO: Quiz = {
  id: 'rrveto', question: 'Why can’t the President sign or veto the budget resolution?',
  choices: ['It isn’t a law: it’s Congress’s own plan, a concurrent resolution', 'The Constitution bans vetoes of budgets', 'Because the President writes it'], correct: 0,
  explain: <>A concurrent resolution binds only Congress. The <Term id="budget-resolution">budget resolution</Term> sets the totals that points of order enforce, but raises and spends no money itself.</>,
};

// ---------- 3.3 Brakes and the debt limit ----------
const ONBUDGET: Quiz = {
  id: 'bkon', question: 'Where does each of these sit in the federal budget?',
  choices: ['defense, Medicare, and the Fed’s earnings on budget; Social Security’s trust funds and the Postal Service off budget by law; and the Fed’s own operations outside the budget'], correct: 0,
  sort: {
    bins: [{ id: 'on', label: 'On budget' }, { id: 'off', label: 'Off budget, by law' }, { id: 'out', label: 'Outside the budget' }],
    items: [
      { id: 'def', label: 'National defense', bin: 'on' },
      { id: 'ss', label: 'Social Security’s trust funds', bin: 'off' },
      { id: 'fedops', label: 'The Federal Reserve’s own operations', bin: 'out' },
      { id: 'mcare', label: 'Medicare', bin: 'on' },
      { id: 'usps', label: 'The Postal Service', bin: 'off' },
      { id: 'fedearn', label: 'The Fed’s earnings sent to the Treasury', bin: 'on' },
    ],
    prompt: 'Drag each one where it belongs, or tap it and then a group.',
  },
  explain: <>By law, Social Security’s trust funds and the Postal Service are off budget, so the budget reports two deficits; the “unified” one that includes them is the one most people quote. The Federal Reserve has never gone through appropriations, but the earnings it sends the Treasury count as receipts.</>,
};
export const PAYGO_LAWS = [
  { id: 'credit', label: 'A new tax credit', five: 20, ten: 45 },
  { id: 'benefit', label: 'A bigger benefit', five: 10, ten: 25 },
];
export const PAYGO_OFFSETS = [
  { id: 'loophole', label: 'Close a tax loophole', five: -25, ten: -40 },
  { id: 'subsidy', label: 'Trim a farm subsidy', five: -8, ten: -20 },
  { id: 'fee', label: 'Raise a user fee', five: -12, ten: -22 },
  { id: 'land', label: 'A one-time land sale', five: -30, ten: -30 },
  { id: 'phase', label: 'Phase in a benefit change', five: -2, ten: -35 },
];
const MEDICARE_CAP: Quiz = {
  id: 'bkcap', question: 'A PAYGO sequester spares Social Security and Medicaid. By how much can it cut Medicare, at most?', choices: ['4 percent'], correct: 0,
  estimate: { min: 0, max: 20, step: 1, start: 10, answer: 4, spot: 0, close: 2, format: (v) => `${v}%`, diff: (d) => `${d} point${d === 1 ? '' : 's'}`, prompt: 'Drag to the cap' },
  explain: <>Four percent. A <Term id="sequestration">sequester</Term> is a presidential order that permanently cancels money for programs that aren’t exempt, across the board. Under Statutory PAYGO, many programs are exempt, like Social Security and Medicaid, and the law limits the cut to Medicare.</>,
};
const SUSPEND: Quiz = {
  id: 'bksusp', question: 'In recent years, how has Congress usually handled the debt limit?',
  choices: ['Suspended it for a set time, then reset it to cover the debt issued meanwhile', 'Abolished it', 'Let the Treasury stop paying some bills'], correct: 0,
  explain: <>The <Term id="debt-limit">debt limit</Term> caps how much the Treasury can borrow. Congress has raised it as often as several times in a year and as seldom as once in several years; lately it has often suspended the limit for a set time, and when a suspension ends, the limit is reset to cover the debt issued during it.</>,
};
const LIMIT = debt.limit;

export const PROCESS_LEVELS: Level[] = [
  {
    id: 'level-spend', n: 17, title: 'Paying the bills', topic: 'How a dollar Congress provides becomes a check, and the rules for every step', difficulty: 'Easy', minutes: 5, icon: 'flow', badge: 'Budget execution',
    steps: [
      { id: 'intro', label: 'Permission first', kind: 'story', mood: 'thinking', sam: <>When Congress votes to spend money, no check goes out that day. First comes permission to spend, then a promise to pay, then the payment. And there are rules for every step, some of them on the books since 1870.</> },
      { id: 'game', label: 'Make it last', kind: 'game', game: {
        id: 'g-spend', title: 'Make it last', goal: 'Follow a dollar from Congress to a check, run an agency’s year without running dry, and see what keeps going in a shutdown.',
        rounds: [
          { kind: 'sort', id: 'flow', label: 'Follow the dollar', sam: <>Round one. Follow a dollar from Congress to a check. Is each step permission, a promise, or the payment?</>, quiz: FLOW },
          { kind: 'custom', id: 'year', label: 'Run the agency', sam: <>Round two. You’re running an agency for a year. Payroll comes first every month. Fund the projects you can, but don’t run out before September.</>,
            play: ({ done, intro }) => <ApportionRound total={120} payroll={7} requests={MONTHS} intro={intro} done={done} prompt="Make the money last all year." /> },
          { kind: 'sort', id: 'shutdown', label: 'Shutdown', sam: <>Round three. Now Congress misses the deadline and funding lapses. What keeps going?</>, quiz: SHUTDOWN },
          { kind: 'choice', id: 'move', label: 'Bonus round', sam: <>Bonus round.</>, quiz: TRANSFER },
        ] } },
      { id: 'rules', label: 'The four rules', kind: 'facts', mood: 'proud', sam: <>Here are the four things the Antideficiency Act forbids. Breaking them can bring penalties, even criminal ones.</>, body: () => (
        <div className="rules-list">
          <ol className="takeaways">
            <li>Spending more than Congress appropriated.</li>
            <li>Spending before Congress appropriates.</li>
            <li>Accepting volunteer work for the government, except in emergencies.</li>
            <li>Spending more than OMB has apportioned: released in installments through the year.</li>
          </ol>
          <p className="small muted">The first rule dates to 1870; laws in 1905 and 1906 added apportionment and criminal penalties. Source: <a href={CRS.url} target="_blank" rel="noreferrer">{CRS.title}</a>.</p>
        </div>
      ) },
      { id: 'vote', label: 'Your vote', kind: 'vote', mood: 'thinking', sam: <>Agencies sometimes ask for more room to move money around during the year. What do you think?</>,
        vote: { kind: 'issue', id: 'transfer-flex', question: 'Should agencies get more freedom to move money between accounts during the year?', choices: [{ value: 'support', label: 'Support' }, { value: 'oppose', label: 'Oppose' }, { value: 'unsure', label: 'Not sure' }], context: (
          <>Supporters say it lets agencies handle surprises without waiting months for Congress. Critics say it weakens Congress’s power of the purse: the Constitution says no money may be drawn from the Treasury except by appropriations made by law. <a href={CRS.url} target="_blank" rel="noreferrer">CRS</a></>
        ) } },
    ],
    takeaways: ['Congress controls spending when it provides budget authority; agencies then obligate it, and the Treasury’s payments are outlays.', 'The Antideficiency Act, dating to 1870, bars spending more than Congress provided, or before it provides it; money for one year lapses if it isn’t used by September 30.', 'In a shutdown, only work that protects life or property, or is paid under permanent law, keeps going.'],
    shareFact: 'Since 1870, it has been against the law for a federal agency to spend more in a year than Congress appropriated.',
    deepDive: [{ route: 'process', label: 'How Congress budgets' }],
    sources: ['crs-r46240'],
    links: [CRS],
  },
  {
    id: 'level-roles', n: 18, title: 'Who’s who in the budget', topic: 'The President, OMB, CBO, and the committees: who does what, and when', difficulty: 'Medium', minutes: 5, icon: 'people', badge: 'The budget players',
    steps: [
      { id: 'intro', label: 'Many cooks', kind: 'story', mood: 'happy', sam: <>My budget has a lot of cooks. The President proposes, Congress decides, and a few offices you may never have heard of keep everyone’s numbers honest. Let’s meet them.</> },
      { id: 'game', label: 'Meet the players', kind: 'game', game: {
        id: 'g-roles', title: 'Meet the players', goal: 'Match each player to its job, then put the President’s budget together in order.',
        rounds: [
          { kind: 'custom', id: 'memory', label: 'Who does what', sam: <>Round one: a memory game. Each turn, flip one card that says who, and one that says what. Find the pairs in as few turns as you can.</>,
            play: ({ done, intro }) => <MemoryRound pairs={PLAYERS} intro={intro} done={done} prompt="Match each player to its job." /> },
          { kind: 'custom', id: 'order', label: 'The President’s budget', sam: <>Round two. Building the President’s budget takes most of a year. Put the steps in order.</>,
            play: ({ done, intro }) => <OrderRound items={PRES_BUDGET} start={['submit', 'views', 'agencies', 'msr', 'passback', 'cbo']} intro={intro} done={done} prompt="Put the President’s budget in order, first to last." /> },
          { kind: 'choice', id: 'request', label: 'Bonus round', sam: <>Bonus round.</>, quiz: REQUEST },
        ] } },
      { id: 'calendar', label: 'The official calendar', kind: 'facts', mood: 'thinking', sam: <>Here’s the calendar the law sets for Congress. As you saw in the last mission, it rarely runs on time.</>, body: () => (
        <div className="timetable">
          <table className="data">
            <thead><tr><th scope="col">On or before</th><th scope="col">What happens</th></tr></thead>
            <tbody>{TIMETABLE.map(([d, w]) => <tr key={d}><td>{d}</td><td>{w}</td></tr>)}</tbody>
          </table>
          <p className="small muted">Section 300 of the Congressional Budget Act of 1974, as listed in <a href={CRS.url} target="_blank" rel="noreferrer">{CRS.title}</a>.</p>
        </div>
      ) },
      { id: 'vote', label: 'Your vote', kind: 'vote', mood: 'thinking', sam: <>Here’s a change some lawmakers have proposed for the budget resolution. Where do you stand?</>,
        vote: { kind: 'issue', id: 'joint-resolution', question: 'Should the budget resolution become a law the President signs?', choices: [{ value: 'support', label: 'Support' }, { value: 'oppose', label: 'Oppose' }, { value: 'unsure', label: 'Not sure' }], context: (
          <>Today it’s Congress’s own plan, which the President can’t sign or veto, so it raises and spends no money. Supporters of making it a joint resolution say both branches would agree on totals early. Critics say it would add one more bill that can stall, and one more chance for a veto. <a href={CRS.url} target="_blank" rel="noreferrer">CRS</a></>
        ) } },
    ],
    takeaways: ['The President’s budget is a request; Congress decides.', 'OMB builds the President’s budget; CBO and the Joint Committee on Taxation give Congress its own numbers.', 'Twelve appropriations subcommittees in each chamber write the yearly spending bills.'],
    shareFact: 'The President has been required by law to send Congress a budget since 1921, the same law that created what is now OMB.',
    deepDive: [{ route: 'process', label: 'How Congress budgets' }],
    sources: ['crs-r46240'],
    links: [CRS],
  },
  {
    id: 'level-rules', n: 19, title: 'Rules of the road', topic: 'The budget resolution, points of order, and reconciliation', difficulty: 'Medium', minutes: 6, icon: 'whistle', badge: 'Budget rules',
    steps: [
      { id: 'intro', label: 'Its own referee', kind: 'story', mood: 'thinking', sam: <>Congress writes its own budget rules, then referees itself. The budget resolution sets limits. Any member can blow the whistle on a bill that breaks them. And one special process lets some bills pass the Senate with a simple majority.</> },
      { id: 'game', label: 'Blow the whistle', kind: 'game', game: {
        id: 'g-rules', title: 'Blow the whistle', goal: 'Referee bills against their spending limit, strike what doesn’t belong in a reconciliation bill, and count the hours of debate.',
        rounds: [
          { kind: 'custom', id: 'ref', label: 'Point of order!', sam: <>Round one: you’re the referee. Each bill comes with its cost. If it would push the subcommittee past its limit, call a point of order. If it fits, let it through.</>,
            play: ({ done, intro }) => <RefereeRound limit={50} bills={BILLS} intro={intro} done={done} prompt="Call each bill against the $50 billion limit." /> },
          { kind: 'custom', id: 'byrd', label: 'Strike it out', sam: <>Round two. Here’s a reconciliation bill. Under the Byrd rule, anything that doesn’t change spending or revenue gets struck. Tap what goes.</>,
            play: ({ done, intro }) => <StrikeRound provisions={PROVISIONS} intro={intro} done={done} prompt="Tap each provision the Byrd rule would strike." /> },
          { kind: 'estimate', id: 'hours', label: 'The clock', sam: <>Round three. Reconciliation is fast because Senate debate on it is capped.</>, quiz: HOURS },
          { kind: 'choice', id: 'veto', label: 'Bonus round', sam: <>Bonus round.</>, quiz: VETO },
        ] } },
      { id: 'senate', label: 'Senate math', kind: 'facts', mood: 'thinking', sam: <>Here’s why these rules matter so much in the Senate, where most bills need 60 votes just to end debate.</>, body: () => (
        <div className="timetable">
          <table className="data">
            <thead><tr><th scope="col">In the Senate</th><th scope="col">Debate limit</th><th scope="col">Votes to pass</th></tr></thead>
            <tbody>
              <tr><td>Most bills</td><td>None, unless 60 senators vote to end debate (cloture)</td><td>60 to end debate, then a majority</td></tr>
              <tr><td>A budget resolution</td><td>50 hours</td><td>A simple majority</td></tr>
              <tr><td>A reconciliation bill</td><td>20 hours</td><td>A simple majority</td></tr>
              <tr><td>Waiving a budget point of order</td><td>—</td><td>Three-fifths: 60 if no seats are vacant</td></tr>
            </tbody>
          </table>
          <p className="small muted">From <a href={CRS.url} target="_blank" rel="noreferrer">{CRS.title}</a>.</p>
        </div>
      ) },
      { id: 'vote', label: 'Your vote', kind: 'vote', mood: 'thinking', sam: <>Here’s an idea that comes up whenever the calendar slips. What do you think?</>,
        vote: { kind: 'issue', id: 'biennial', question: 'Should Congress budget every two years instead of every year?', choices: [{ value: 'support', label: 'Support' }, { value: 'oppose', label: 'Oppose' }, { value: 'unsure', label: 'Not sure' }], context: (
          <>Supporters say a two-year budget would leave more time for oversight and fewer last-minute stopgaps. Critics say forecasts two years out are less reliable, so Congress would likely end up passing more mid-course changes.</>
        ) } },
    ],
    takeaways: ['The budget resolution is Congress’s own plan: it sets limits but isn’t a law.', 'A member must raise a point of order to stop a bill that breaks the limits; in the Senate, 60 votes can waive it.', 'Reconciliation bills get 20 hours of Senate debate, so a simple majority can pass them; the Byrd rule strikes provisions with no budget effect.'],
    shareFact: 'When debate time on a budget bill runs out in the Senate, amendments can keep coming with no debate at all: the “vote-a-rama.”',
    deepDive: [{ route: 'process', label: 'How Congress budgets' }],
    sources: ['crs-r46240'],
    links: [CRS],
  },
  {
    id: 'level-brakes', n: 20, title: 'Brakes and the debt limit', topic: 'PAYGO, automatic cuts, the debt limit, and what counts in the budget', difficulty: 'Hard', minutes: 6, icon: 'brake', badge: 'Budget brakes',
    steps: [
      { id: 'intro', label: 'The brakes', kind: 'story', mood: 'worried', sam: <>Congress has built a few brakes into my budget. One cancels spending automatically if new laws add to the deficit. And there’s a cap on how much I can borrow, which Congress raises or suspends again and again.</> },
      { id: 'game', label: 'Pump the brakes', kind: 'game', game: {
        id: 'g-brakes', title: 'Pump the brakes', goal: 'Find what counts in the budget, balance the PAYGO scorecards, and see what a sequester spares.',
        rounds: [
          { kind: 'sort', id: 'onbudget', label: 'What counts', sam: <>Round one. Not everything the government does is in the budget totals. Sort these out.</>, quiz: ONBUDGET },
          { kind: 'custom', id: 'paygo', label: 'The scorecards', sam: <>Round two. This session, Congress passed two laws that add to the deficit. Pass up to two more that pay for them, on both scorecards, or an automatic cut kicks in.</>,
            play: ({ done, intro }) => <BalanceRound laws={PAYGO_LAWS} offsets={PAYGO_OFFSETS} pick={2} intro={intro} done={done} prompt="Clear both PAYGO scorecards before the session ends." /> },
          { kind: 'estimate', id: 'cap', label: 'The sequester', sam: <>Round three. When a sequester hits, some programs are spared, and one gets a cap.</>, quiz: MEDICARE_CAP },
          { kind: 'choice', id: 'limit', label: 'Bonus round', sam: <>Bonus round, on the debt limit.</>, quiz: SUSPEND },
        ] } },
      { id: 'limit', label: 'The limit today', kind: 'facts', mood: 'thinking', sam: <>Here’s where my borrowing stands against the limit right now, from the Treasury’s own daily statement.</>, body: () => (
        LIMIT ? (
          <div className="concept-result">
            <span className="stat-label">The debt limit, as of {dateLabel(LIMIT.date)}</span>
            <strong className="concept-big">{moneyWords(LIMIT.limit, 2)}, with {moneyWords(LIMIT.limit - LIMIT.subject, 2)} of room left</strong>
            <span className="small muted">Debt subject to the limit: {moneyWords(LIMIT.subject, 2)}. Trust fund surpluses are held as federal debt, so the debt can rise even in a year the budget shows a surplus. <a href="#clock">See the live debt clock</a>.</span>
          </div>
        ) : <p className="small muted">The Treasury’s latest figures aren’t available right now. <a href="#clock">See the debt clock</a>.</p>
      ) },
      { id: 'vote', label: 'Your vote', kind: 'vote', mood: 'thinking', sam: <>One more question for Congress, about that borrowing limit.</>,
        vote: { kind: 'issue', id: 'gephardt', question: 'Should the debt limit rise automatically when Congress adopts its budget?', choices: [{ value: 'support', label: 'Support' }, { value: 'oppose', label: 'Oppose' }, { value: 'unsure', label: 'Not sure' }], context: (
          <>The House has used a rule like this, the Gephardt Rule, on and off since 1979, repealing and restoring it several times. Supporters say borrowing for spending Congress already approved shouldn’t need a second vote. Critics say a separate vote is a useful moment to weigh the debt. <a href={CRS.url} target="_blank" rel="noreferrer">CRS</a></>
        ) } },
    ],
    takeaways: ['Under Statutory PAYGO, new tax and mandatory spending laws can’t add to the deficit on the 5-year or 10-year scorecard, or an automatic across-the-board cut follows.', 'A PAYGO sequester spares Social Security and Medicaid, and can cut Medicare by no more than 4%.', 'Social Security and the Postal Service are off budget by law; the Federal Reserve is outside the budget, but its earnings count as receipts.'],
    shareFact: 'Trust fund surpluses are held as federal debt, so the national debt can rise even in a year when the budget shows a surplus.',
    deepDive: [{ route: 'debt', label: 'Debt & interest' }],
    sources: ['crs-r46240', 'dts-limit'],
    links: [CRS],
  },
];
