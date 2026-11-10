import { TimeChart, hundredths } from '../components/charts';
import { ChartFrame, Legend, Term } from '../components/ui';
import { cbo } from '../data';
import { moneyWords } from '../lib/format';
import type { Level, Quiz } from './levels';

// 3.4 "Compared to what?": the same budget gap reads two ways, depending on the yardstick. One
// yardstick is history (spending and revenue near their 1946–2000 averages); the other is today's
// needs (a budget that rises with an older country, and taxes set to pay for it). The two-yardstick
// framing comes from Michael Linden's October 2026 paper for the Washington Center for Equitable
// Growth, which lays out both views and then argues for the second; the game teaches both and
// takes neither. Every number here is computed from OMB's Historical Tables (Table 1.2 for the
// long history, and the program detail behind the site's other long-run charts).

const PAPER = {
  title: 'Michael Linden, “The deeper argument at the heart of the federal budget debate,” Washington Center for Equitable Growth, October 2026 (the source of the two-yardstick framing; it argues for the second yardstick)',
  url: 'https://equitablegrowth.org/research-paper/the-deeper-argument-at-the-heart-of-the-federal-budget-debate/',
};

const LONG = cbo.long;
const year = (fy: number) => LONG.find((r) => r.fy === fy)!;
const NOW = LONG[LONG.length - 1];
const mean = (from: number, to: number, k: 'rev' | 'out') => {
  const rows = LONG.filter((r) => r.fy >= from && r.fy <= to);
  return rows.reduce((s, r) => s + r[k], 0) / rows.length;
};
/** Yardstick one: the 1946–2000 averages. */
const HIST = { out: mean(1946, 2000, 'out'), rev: mean(1946, 2000, 'rev') };
const Y2000 = year(2000);
const Y2019 = year(2019);
const TWENTY = LONG.filter((r) => r.rev >= 20);
const p1 = (v: number) => `${v.toFixed(1)}%`;

// What grew from FY2000 to the latest year, as shares of GDP.
const H0 = cbo.history.find((h) => h.fy === 2000)!;
const H1 = cbo.history[cbo.history.length - 1];
const share = (h: typeof H0, v: number) => (v / h.gdp) * 100;
const big3 = (h: typeof H0) => share(h, h.socialSecurity + h.medicare + h.medicaid);
const interest = (h: typeof H0) => share(h, h.netInterest);
const total = (h: typeof H0) => share(h, h.outlays);
const rest = (h: typeof H0) => total(h) - big3(h) - interest(h);
const GROWTH = { big3: big3(H1) - big3(H0), interest: interest(H1) - interest(H0), rest: rest(H1) - rest(H0), total: total(H1) - total(H0) };
const GROWTH_SPLIT = hundredths([GROWTH.big3, GROWTH.interest, GROWTH.rest]);

const ORDINARY: Quiz = {
  id: 'ydordinary', question: 'In FY2019 there was no war and no recession. How big was the deficit, as a share of the economy?',
  choices: [`${p1(-Y2019.def)} of GDP`], correct: 0,
  estimate: {
    min: 0, max: 16, step: 0.1, start: 2, answer: -Y2019.def, spot: 0.5, close: 1.5,
    format: (v) => `${v.toFixed(1)}% of GDP`, diff: (d) => `${d.toFixed(1)} points`, prompt: 'Drag to the deficit',
    marks: [{ at: -year(2009).def, label: '2009 crisis' }, { at: -year(2020).def, label: '2020 pandemic' }],
  },
  explain: <>Emergencies run deeper: {p1(-year(2009).def)} of GDP in FY2009, {p1(-year(2020).def)} in FY2020, and {p1(-year(1943).def)} in FY1943, during World War II. Those deficits shrank once the emergency passed. The FY2019 deficit came in ordinary times, and in FY{NOW.fy} it was {p1(-NOW.def)}. A gap that lasts in ordinary times is <Term id="structural-deficit">structural</Term>: it won’t close on its own.</>,
};

const WHOSE: Quiz = {
  id: 'ydwhose', question: 'Which yardstick is each statement using?',
  choices: ['the averages and keeping to the past use history; FY2000 and paying for promised benefits use today’s needs; and both sides agree on what grew and how big the deficit is'], correct: 0,
  sort: {
    bins: [{ id: 'hist', label: 'Yardstick 1: history' }, { id: 'needs', label: 'Yardstick 2: today’s needs' }, { id: 'both', label: 'Both sides agree' }],
    items: [
      { id: 'out', label: `Spending, ${p1(NOW.out)} of GDP, is well above its 1946–2000 average of ${p1(HIST.out)}.`, bin: 'hist' },
      { id: 'rev', label: `Revenue, ${p1(NOW.rev)} of GDP, is close to its 1946–2000 average of ${p1(HIST.rev)}.`, bin: 'hist' },
      { id: 'keep', label: 'Spending should stay near what the country has spent in the past.', bin: 'hist' },
      { id: 'y2000', label: `Revenue was ${p1(Y2000.rev)} of GDP in FY2000, the last year with a surplus.`, bin: 'needs' },
      { id: 'pay', label: 'With more retirees, taxes should be set to pay for the benefits the law already promises.', bin: 'needs' },
      { id: 'grew', label: 'Most of the rise in spending since 2000 is Social Security, Medicare, and Medicaid.', bin: 'both' },
      { id: 'big', label: `A deficit of ${p1(-NOW.def)} of GDP is large for a time with no war or recession.`, bin: 'both' },
    ],
    prompt: 'Drag each statement to its yardstick, or tap it and then a group.',
  },
  explain: <>Every statement here is true. What differs is the comparison. Against history, spending is the number that’s out of line. Against the budget of FY2000, revenue has fallen too. The numbers can’t tell you which yardstick is right; that’s a judgment about what the budget is for.</>,
};

const GREW: Quiz = {
  id: 'ydgrew', question: `From FY2000 to FY${H1.fy}, spending grew from ${p1(total(H0))} to ${p1(total(H1))} of GDP. Where did the growth come from?`,
  choices: [`Social Security, Medicare, and Medicaid about ${GROWTH_SPLIT[0]} percent; interest on the debt about ${GROWTH_SPLIT[1]} percent; everything else about ${GROWTH_SPLIT[2]} percent`], correct: 0,
  split: {
    parts: [
      { id: 'big3', label: 'Social Security, Medicare, Medicaid', color: 'var(--c-ss)', answer: GROWTH_SPLIT[0] },
      { id: 'interest', label: 'Interest on the debt', color: 'var(--c-interest)', answer: GROWTH_SPLIT[1] },
      { id: 'rest', label: 'Everything else', color: 'var(--c-borrow)', answer: GROWTH_SPLIT[2] },
    ],
    prompt: 'Drag the dividers to split each $100 of growth.', spot: 6, close: 15,
  },
  explain: <>Social Security, Medicare, and Medicaid went from {p1(big3(H0))} to {p1(big3(H1))} of GDP as more people retired and health care costs rose. Interest went from {p1(interest(H0))} to {p1(interest(H1))}. Everything else together, from defense to highways to veterans’ benefits, went from {p1(rest(H0))} to {p1(rest(H1))}. People who use the first yardstick see a spending rise; people who use the second see costs the country knew were coming as its population aged.</>,
};

const TWICE: Quiz = {
  id: 'ydtwenty', question: 'Since 1930, in how many years has federal revenue reached 20% of GDP?',
  choices: [`${TWENTY.length === 2 ? 'Twice' : `${TWENTY.length} times`}, in ${TWENTY.map((r) => r.fy).join(' and ')}`, 'Never', 'About one year in ten', 'Most years since 2000'], correct: 0,
  explain: <>Revenue reached {TWENTY.map((r) => `${p1(r.rev)} in FY${r.fy}`).join(' and ')}. The first yardstick reads this as a ceiling: taxes that high are rare. The second points out that spending has jumped to new levels before, from {p1(year(1930).out)} of GDP in FY1930 to {p1(year(1940).out)} in FY1940, and again after World War II.</>,
};

function LongView() {
  const x = LONG.map((r) => r.fy);
  const within = (fy: number, v: number) => (fy >= 1946 && fy <= 2000 ? v : null);
  return (
    <ChartFrame
      title="Spending and revenue since 1930, as a share of the economy"
      sub="Percent of GDP, fiscal years. The dashed lines are the 1946–2000 averages: yardstick one."
      legend={<Legend items={[{ label: 'Spending', color: 'var(--c-ss)', kind: 'line' }, { label: 'Revenue', color: 'var(--c-health)', kind: 'line' }, { label: '1946–2000 averages', color: 'var(--ink-2)', kind: 'line' }]} />}
      sourceIds={['omb-hist']}
      table={{
        columns: [{ key: 'y', label: 'Fiscal year' }, { key: 'o', label: 'Spending (% of GDP)', align: 'r' }, { key: 'r', label: 'Revenue (% of GDP)', align: 'r' }, { key: 'd', label: 'Surplus or deficit', align: 'r' }],
        rows: [...LONG].reverse().map((r) => ({ y: `FY${r.fy}`, o: p1(r.out), r: p1(r.rev), d: `${r.def < 0 ? '−' : '+'}${p1(Math.abs(r.def))}` })),
      }}
    >
      <TimeChart
        label="Federal spending and revenue as a share of GDP, FY1930 to the latest year"
        x={x}
        height={260}
        yMin={0}
        yFormat={(v) => `${v}%`}
        tipFormat={(v) => p1(v)}
        tipTitle={(fy) => `FY${fy}`}
        xTicks={x.map((fy, i) => (fy % 10 === 0 ? i : -1)).filter((i) => i >= 0)}
        xLabel={(fy) => String(fy)}
        series={[
          { id: 'out', label: 'Spending', color: 'var(--c-ss)', kind: 'line', values: LONG.map((r) => r.out) },
          { id: 'rev', label: 'Revenue', color: 'var(--c-health)', kind: 'line', values: LONG.map((r) => r.rev) },
          { id: 'outAvg', label: 'Spending, 1946–2000 average', color: 'var(--ink-2)', kind: 'line', dash: true, width: 1.5, hideInTip: true, values: LONG.map((r) => within(r.fy, HIST.out)) },
          { id: 'revAvg', label: 'Revenue, 1946–2000 average', color: 'var(--ink-2)', kind: 'line', dash: true, width: 1.5, hideInTip: true, values: LONG.map((r) => within(r.fy, HIST.rev)) },
        ]}
      />
    </ChartFrame>
  );
}

export const YARDSTICK_LEVELS: Level[] = [
  {
    id: 'level-yardstick', n: 21, title: 'Compared to what?', topic: 'Two yardsticks for judging the budget gap', difficulty: 'Medium', minutes: 5, icon: 'ruler', badge: 'Two yardsticks',
    steps: [
      { id: 'intro', label: 'Two readings', kind: 'story', mood: 'thinking', sam: <>Folks argue about whether I spend too much or tax too little. Here’s the thing: a gap between two numbers always has two readings. One number is too high, or the other is too low. The numbers alone can’t say which. It depends on what you compare them to.</> },
      { id: 'game', label: 'Pick the yardstick', kind: 'game', game: {
        id: 'g-yardstick', title: 'Pick the yardstick', goal: 'Size a deficit in ordinary times, sort true statements by the yardstick they use, and find where the growth in spending came from.',
        rounds: [
          { kind: 'estimate', id: 'ordinary', label: 'Ordinary times', sam: <>Round one. Deficits in wars and recessions shrink when the emergency ends. What about an ordinary year?</>, quiz: ORDINARY },
          { kind: 'sort', id: 'whose', label: 'Whose yardstick?', sam: <>Round two. Every statement here is true. Your job: spot which yardstick each one uses.</>, quiz: WHOSE },
          { kind: 'split', id: 'grew', label: 'What grew', sam: <>Round three. Spending has grown since 2000. Where did the growth come from?</>, quiz: GREW },
          { kind: 'choice', id: 'twenty', label: 'Bonus round', sam: <>Bonus round.</>, quiz: TWICE },
        ] } },
      { id: 'long', label: 'The long view', kind: 'facts', mood: 'thinking', sam: <>Here’s the long view. The dashed lines are the 1946 to 2000 averages, the first yardstick. Spending has jumped to new levels before: in the Depression, and again in World War Two.</>, body: () => <LongView /> },
      { id: 'vote', label: 'Your vote', kind: 'vote', mood: 'thinking', sam: <>So, which yardstick do you reach for?</>,
        vote: { kind: 'issue', id: 'yardstick', question: 'When you judge today’s budget gap, which yardstick fits best?', choices: [
          { value: 'history', label: 'History: keep spending and taxes near their long-run averages' },
          { value: 'needs', label: 'Today’s needs: set taxes to cover the benefits the law already promises' },
          { value: 'mix', label: 'Some of each' },
          { value: 'unsure', label: 'Not sure' },
        ], context: (
          <>The history yardstick keeps the government’s share of the economy near what it has been, but bringing spending back to its 1946–2000 average would take cuts of about {Math.round(NOW.out - HIST.out)} points of GDP (about {moneyWords(((NOW.out - HIST.out) / 100) * H1.gdp, 1)} in FY{NOW.fy}), from Social Security, Medicare, and Medicaid or from everything else. The needs yardstick treats the cost of an older country as expected, but it means taxes higher than the country has kept for long: revenue has reached 20% of GDP only twice since 1930.</>
        ) } },
    ],
    takeaways: [
      'A gap between spending and revenue can be read two ways: spending is too high, or revenue is too low. The numbers alone don’t say which.',
      `Against the 1946–2000 averages, spending is up about ${Math.round(NOW.out - HIST.out)} points of GDP and revenue is about the same. Against FY2000, the last surplus, revenue is down about ${Math.round(Y2000.rev - NOW.rev)} points.`,
      'Deficits in wars and recessions shrink when the emergency ends; one that lasts in ordinary times is structural.',
      `Since FY2000, Social Security, Medicare, and Medicaid account for about ${GROWTH_SPLIT[0]}% of the rise in spending as a share of the economy.`,
    ],
    shareFact: `In FY1943, during World War II, the federal deficit was ${p1(-year(1943).def)} of the economy.`,
    deepDive: [{ route: 'gap', label: 'Deficits & the structural gap' }],
    sources: ['omb-hist'],
    links: [PAPER],
  },
];
