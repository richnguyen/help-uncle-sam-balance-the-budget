import { useState } from 'react';
import { Seg } from '../components/ui';
import { cbo, POP } from '../data';
import { CTX } from '../lib/assess';
import { dollars, money, moneyWords, pct } from '../lib/format';
import { MULT, mid, optionPath } from '../lib/plan';
import { OPTIONS_DATA } from '../lib/planData';
import type { Level, Quiz } from './levels';
import { BridgeSim, Dial, PieSim, Ripple, WaitSim, waitShares } from './sims';
import type { Done } from './minigame';
import { OrderRound } from './rounds';
import type { SortGuess } from './guesses';

// The six concept missions that come before each campaign's budget desk: how a policy hits the
// economy, how fast is too fast, who a change reaches, what grows the economy, why public
// investment is different, and who pays later. Every number comes from the same data and CBO
// ranges the budget desk scores plans with, so what a player learns here is how the desk works.

const opt = (id: string) => CTX.options.find((o) => o.id === id)!;
const principle = (id: string) => OPTIONS_DATA.principles.find((p) => p.id === id);
const base = cbo.baseline;
const FIRST = base[0], LAST = base.at(-1)!;
const hist = cbo.history.filter((h) => h.actual);
const ndShare = (fy: number) => { const h = hist.find((x) => x.fy === fy); return h ? h.nondefense / h.gdp : 0; };
const ND_1980 = ndShare(1980), ND_NOW = ndShare(hist.at(-1)!.fy), ND_FY = hist.at(-1)!.fy;
const fmtMult = (v: number) => `$${v.toFixed(2)}`;

// ---------- Same savings, different drag ----------
const SAME = [
  { id: 'limit-itemized-15pct', label: 'Limit deductions for high earners' },
  { id: 'income-tax-rates-1pt', label: 'Raise every income tax rate' },
  { id: 'medicare-advantage-benchmarks', label: 'Pay Medicare insurers less' },
  { id: 'cut-defense-budget', label: 'Cut the defense budget' },
];
function SameSavings() {
  const [pick, setPick] = useState(SAME[0].id);
  const [where, setWhere] = useState(50);
  const o = opt(pick);
  const m = MULT[o.econ.cls];
  const per = 100; // $100 billion saved in a year
  const mult = m.lo + ((m.hi - m.lo) * where) / 100;
  const hit = Math.round(per * mult);
  const pos = where === 50 ? 'the middle of CBO’s range, which the game uses' : where < 50 ? 'toward CBO’s low estimate' : 'toward CBO’s high estimate';
  return (
    <div className="concept-try">
      <Seg label="Save $100 billion this way" value={pick} onChange={setPick} options={SAME.map((s) => ({ value: s.id, label: s.label }))} />
      <div className="sim-gauge-row">
        <Ripple value={hit} max={250} base={per} label={`Saving $100 billion by ${o.name.toLowerCase()}: the economy shrinks by about $${hit} billion at first`} />
        <div className="concept-result" aria-live="polite">
          <span className="stat-label">Save $100 billion in a year by: {o.name.toLowerCase()}</span>
          <strong className="concept-big">The economy shrinks by about ${hit} billion at first</strong>
          <span className="small muted">That’s {pos}. CBO’s range for {m.label.toLowerCase()}: ${Math.round(per * m.lo)} to ${Math.round(per * m.hi)} billion. {o.econ.why}</span>
        </div>
      </div>
      <label className="sim-slider">
        <span className="sim-k">Where in CBO’s range</span>
        <strong className="sim-v num">{fmtMult(mult)} per dollar</strong>
        <input type="range" min={0} max={100} step={5} value={where} onChange={(e) => setWhere(Number(e.target.value))} aria-valuetext={`${fmtMult(mult)} per dollar saved`} />
        <span className="sim-scale" aria-hidden="true"><span>CBO’s low estimate</span><span>CBO’s high estimate</span></span>
      </label>
      <p className="small muted">The ripple’s area grows with the effect. The dashed ring is dollar for dollar: inside it, the economy shrinks by less than the money saved.</p>
    </div>
  );
}

// ---------- Speed: each year's tightening, all at once or phased in ----------
const DEMO = ['limit-itemized-15pct', 'cut-defense-budget'];
function steps(ids: string[], gradual: boolean, scale: number) {
  const tight = base.map(() => 0);
  for (const id of ids) optionPath(opt(id), base, gradual).forEach((v, i) => { tight[i] += v * scale; });
  return base.map((b, i) => (tight[i] - (i ? tight[i - 1] : 0)) / b.gdp);
}
const band = (s: number) => (s <= 0.005 ? 'gentle' : s <= 0.01 ? 'moderate' : 'steep');
/** In the game: the bigger the plan the better, as long as it isn't steep; gentle counts most. */
const ZONE_WORTH = { gentle: 1, moderate: 0.6, steep: 0.1 } as const;
const planWorth = (size: number, gradual: boolean) => size * ZONE_WORTH[band(Math.max(...steps(DEMO, gradual, size)))];
const BEST_PLAN = Math.max(...[1, 2, 3].flatMap((z) => [planWorth(z, false), planWorth(z, true)]));
export function PhaseDemo({ game }: { game?: { done: Done } } = {}) {
  const [gradual, setGradual] = useState(false);
  const [size, setSize] = useState<'1' | '2' | '3'>('2');
  const [locked, setLocked] = useState(false);
  const st = steps(DEMO, gradual, Number(size));
  const peak = Math.max(...st);
  const r = band(peak);
  const max = 0.025;
  const lock = () => {
    if (!game || locked) return;
    setLocked(true);
    game.done((100 * planWorth(Number(size), gradual)) / BEST_PLAN, `A ${['small', 'bigger', 'biggest'][Number(size) - 1]} plan${gradual ? ', phased in,' : ''} with its steepest year ${r}.`);
  };
  return (
    <div className="concept-try">
      <div className="concept-controls">
        <Seg label="How big a plan" value={size} onChange={(v) => { if (!locked) setSize(v); }} options={[{ value: '1', label: 'Small' }, { value: '2', label: 'Bigger' }, { value: '3', label: 'Biggest' }]} />
        <label className="switch"><input type="checkbox" checked={gradual} disabled={locked} onChange={(e) => setGradual(e.target.checked)} /> Phase in over 3 years</label>
      </div>
      {game && !locked && <p className="small">The goal: save as much as you can without a steep year. Gentle earns the most.</p>}
      <Dial value={peak * 100} max={2.5} label="The steepest year’s squeeze on the economy" readout={`${(peak * 100).toFixed(1)}% of GDP`}
        zones={[{ to: 0.5, label: 'gentle', tone: 'good' }, { to: 1, label: 'moderate', tone: 'warning' }, { to: 2.5, label: 'steep', tone: 'critical' }]} note="the steepest year" />
      <figure className="phase" aria-label={`Each year's new tightening, as a share of GDP. Steepest year: ${pct(peak, 1)}, ${r}.`}>
        <div className="phase-bands" aria-hidden="true">
          <span className="phase-band" data-b="steep" style={{ bottom: `${(0.01 / max) * 100}%`, top: 0 }}><em>Steep</em></span>
          <span className="phase-band" data-b="moderate" style={{ bottom: `${(0.005 / max) * 100}%`, height: `${(0.005 / max) * 100}%` }}><em>Moderate</em></span>
          <span className="phase-band" data-b="gentle" style={{ bottom: 0, height: `${(0.005 / max) * 100}%` }}><em>Gentle</em></span>
        </div>
        <div className="phase-cols">
          {st.map((s, i) => (
            <span key={base[i].fy} className="phase-col" title={`FY${base[i].fy}: ${pct(Math.max(0, s), 2)} of GDP`}>
              <span className="phase-bar" data-b={band(s)} style={{ height: `${Math.min(1, Math.max(0, s) / max) * 100}%` }} />
              <span className="phase-x">FY{String(base[i].fy).slice(2)}</span>
            </span>
          ))}
        </div>
        <figcaption className="small"><strong>Steepest year: {pct(peak, 1)} of GDP, {r}.</strong> Each bar is how much more the plan saves that year than the year before: the new squeeze the economy feels.</figcaption>
      </figure>
      {game && !locked && <button type="button" className="btn btn-primary estimate-lock sim-lock" onClick={lock}>Lock in this plan</button>}
    </div>
  );
}

// ---------- Who each card reaches ----------
type Who = 'retirees' | 'lowIncome' | 'investment' | 'none';
const WHO: { value: Who; label: string }[] = [{ value: 'retirees', label: 'Current retirees' }, { value: 'lowIncome', label: 'Low-income families' }, { value: 'investment', label: 'Public investment' }, { value: 'none', label: 'None of these' }];
function WhoItTouches() {
  const [who, setWho] = useState<Who>('retirees');
  const cards = CTX.options.filter((o) => (who === 'none' ? !o.econ.tags.some((t) => t === 'retirees' || t === 'lowIncome' || t === 'investment') : o.econ.tags.includes(who)));
  return (
    <div className="concept-try">
      <Seg label="Which cards reach…" value={who} onChange={setWho} options={WHO} />
      <p className="small muted">{cards.length} of {CTX.options.length} cards{who === 'none' ? ' reach none of the three groups the game protects' : ` reach ${WHO.find((w) => w.value === who)!.label.toLowerCase()}`}.</p>
      <ul className="concept-cards">
        {cards.map((o) => <li key={o.id} className="concept-card" data-side={o.side}><span className="rcard-kind" data-side={o.side}>{o.side === 'revenue' ? 'Tax' : 'Cut'}</span><span><strong>{o.name}</strong><span className="small muted"> {o.econ.why}</span></span></li>)}
      </ul>
    </div>
  );
}

const WHO_SORT: SortGuess = {
  bins: [{ id: 'retirees', label: 'Current retirees' }, { id: 'lowIncome', label: 'Low-income families' }, { id: 'higher', label: 'Higher-income people' }],
  items: [
    { id: 'chained-cpi', label: 'Slower cost-of-living raises (the chained CPI)', bin: 'retirees' },
    { id: 'carried-interest', label: 'Tax carried interest as ordinary income', bin: 'higher' },
    { id: 'medicaid-per-enrollee-caps', label: 'Cap federal Medicaid spending per enrollee', bin: 'lowIncome' },
    { id: 'part-b-premium-35pct', label: 'Raise Medicare Part B premiums', bin: 'retirees' },
    { id: 'limit-itemized-15pct', label: 'Limit what itemized deductions save', bin: 'higher' },
    { id: 'ss-tax-earnings-over-250k', label: 'Social Security tax on earnings above $250,000', bin: 'higher' },
  ],
  prompt: 'Drag each card into a group, or tap a card and then a group.',
};

/** 1.7: which tax takes the biggest bite from a tight budget. */
const BITE = {
  id: 'cfbite', question: 'Without rebates, which of these takes the biggest share of a lower-income family’s budget?',
  choices: ['A 5 percent value-added tax on purchases', 'Taxing carried interest as ordinary income', 'Limiting what itemized deductions save'], correct: 0,
  explain: <>A tax on what people buy takes a bigger share of income from families who spend nearly all of it. Carried interest reaches investment-fund managers, and itemized deductions are used mostly by higher-income filers. Rebates can offset a sales-style tax, but this card doesn’t include them.</>,
};
/** 2.3: cards that help long-run growth, and cards that hold it back (the budget desk counts these). */
const GROWTH_SORT: SortGuess = {
  bins: [{ id: 'helps', label: 'Helps growth over time' }, { id: 'hurts', label: 'Holds growth back' }],
  items: ['carbon-tax-25', 'income-tax-rates-1pt', 'limit-itemized-15pct', 'corp-rate-1pt', 'crop-insurance-subsidies', 'cut-transport-education-grants']
    .map((id) => opt(id)).map((o) => ({ id: o.id, label: o.name, bin: o.econ.growth > 0 ? 'helps' : 'hurts' })),
  prompt: 'Drag each card to where it belongs, or tap a card and then a group.',
};
/** 2.4: what counts as federal investment (OMB counts physical capital, research, and education and training). */
const INVEST_SORT: SortGuess = {
  bins: [{ id: 'inv', label: 'Investment: builds for later' }, { id: 'now', label: 'Pays for today' }],
  items: [
    { id: 'roads', label: 'Highway grants to states', bin: 'inv' },
    { id: 'ss', label: 'Social Security checks', bin: 'now' },
    { id: 'nih', label: 'Medical research at the National Institutes of Health', bin: 'inv' },
    { id: 'interest', label: 'Interest on the debt', bin: 'now' },
    { id: 'pell', label: 'Pell Grants for college students', bin: 'inv' },
    { id: 'medicare', label: 'Medicare payments to doctors', bin: 'now' },
  ],
  prompt: 'Drag each one to where it belongs, or tap it and then a group.',
};
/** 3.2: how many times bigger the yearly fix is if it waits until the last start year. */
const WAITS = waitShares();
const WAIT_X = WAITS.at(-1)!.share / WAITS[0].share;

const link = (id: string) => { const p = principle(id); return p ? <> <a href={p.source.url} target="_blank" rel="noreferrer">{p.source.title.split(',')[0]}</a></> : null; };
const links = (...ids: string[]) => ids.map((id) => principle(id)).filter(Boolean).map((p) => ({ title: p!.source.title, url: p!.source.url }));
const halfPct = moneyWords(FIRST.gdp * 0.005, 0);
const interestPerPerson = LAST.netInterest / POP;
const purchases = MULT.purchases, high = MULT.taxHigh, people = MULT.transfersPersons;

export const CONCEPT_LEVELS: Level[] = [
  {
    id: 'level-economy', n: 11, title: 'How a policy hits the economy', topic: 'Why the same savings can slow the economy a little or a lot', difficulty: 'Medium', minutes: 5, icon: 'wave', badge: 'Economic drag',
    steps: [
      { id: 'intro', label: 'A dollar less', kind: 'story', mood: 'thinking', sam: <>When I save a dollar, somebody somewhere has a dollar less to spend. For a while, that can slow the whole economy down. How much depends on whose dollar it was.</> },
      { id: 'game', label: 'Ripple ranking', kind: 'game', game: {
        id: 'g-econ', title: 'Ripple ranking', goal: 'Rank four ways of saving the same money by how hard each hits the economy at first.',
        rounds: [
          { kind: 'choice', id: 'least', label: 'The gentlest', sam: <>Round one. For each dollar saved, which change slows the economy the least at first?</>, quiz: {
        id: 'ceq1', question: 'For each dollar saved, which change slows the economy the least at first?',
        choices: ['Cutting what the government buys', 'Raising taxes on higher-income people', 'Cutting payments to people'], correct: 1,
        explain: <>CBO estimates a dollar raised from higher-income people shrinks output by {fmtMult(high.lo)} to {fmtMult(high.hi)} at first, because they’d have saved part of it anyway. A dollar less of government purchases: {fmtMult(purchases.lo)} to {fmtMult(purchases.hi)}. Payments to people: {fmtMult(people.lo)} to {fmtMult(people.hi)}.</> } },
          { kind: 'custom', id: 'rank', label: 'Ripple ranking', sam: <>Round two. Here are four ways to save a hundred billion dollars. Rank them from the smallest ripple through the economy to the biggest.</>, play: ({ done, intro }) => <OrderRound items={[...SAME].sort((a, b) => mid(opt(a.id).econ.cls) - mid(opt(b.id).econ.cls)).map((x) => ({ id: x.id, label: x.label, detail: `the economy shrinks about $${Math.round(100 * mid(opt(x.id).econ.cls))} billion at first` }))} start={['cut-defense-budget', 'limit-itemized-15pct', 'medicare-advantage-benchmarks', 'income-tax-rates-1pt']} intro={intro} done={done} prompt="Smallest ripple first: rank the four ways to save $100 billion." /> },
          { kind: 'choice', id: 'why', label: 'Bonus round', sam: <>Bonus round.</>, quiz: {
        id: 'ceq2', question: 'Why does cutting what the government buys hit the economy hardest at first?',
        choices: ['Every dollar not spent is a dollar less of goods and services bought right away', 'Government purchases are taxed twice', 'The Federal Reserve can never respond to it'], correct: 0,
        explain: <>When the government stops buying something, that spending simply disappears. Part of a tax increase or a smaller benefit check would have been saved anyway, so less spending vanishes. The Federal Reserve can soften the blow by lowering rates, one reason CBO’s ranges are wide.</> } },
        ] } },
      { id: 'same', label: 'Same savings', kind: 'try', mood: 'happy', sam: <>Let’s save the same hundred billion dollars four ways. Tap each one and watch the ripple it sends through the economy. Then slide across CBO’s range, from its low estimate to its high one.</>, body: () => <SameSavings /> },
      { id: 'vote', label: 'Your vote', kind: 'vote', mood: 'thinking', sam: <>So here’s a real question for Congress. If the economy is weak, should deficit cuts wait?</>,
        vote: { kind: 'issue', id: 'timing', question: 'When should cuts to the deficit start?', choices: [
          { value: 'now', label: 'Right away, in full' },
          { value: 'gradual', label: 'Right away, but phased in gradually' },
          { value: 'wait', label: 'Once the economy is strong' },
        ], context: <>{principle('gradual')?.claim}{link('gradual')}</> } },

    ],
    takeaways: ['The same savings can slow the economy a little or a lot, depending on whose spending shrinks.', `CBO puts the first-year effect of a dollar of government purchases at ${fmtMult(purchases.lo)} to ${fmtMult(purchases.hi)} of output.`, 'Taxes on higher-income people and businesses slow the economy least at first.'],
    shareFact: `CBO estimates a dollar cut from what the government buys can shrink the economy by as much as ${fmtMult(purchases.hi)} at first, while a dollar raised from business taxes can shrink it by as little as nothing.`,
    deepDive: [{ route: 'sources', label: 'How the game scores a plan' }],
    sources: ['cbo-multiplier-wp', 'principle-multipliers', 'principle-gradual'],
    links: links('multipliers', 'gradual'),
  },
  {
    id: 'level-drag', n: 12, title: 'Gentle, moderate, steep', topic: 'How fast a plan squeezes the economy, and why phasing in helps', difficulty: 'Medium', minutes: 4, icon: 'meter', badge: 'Pace',
    steps: [
      { id: 'intro', label: 'Speed', kind: 'story', mood: 'happy', sam: <>The other half of the story is speed. Squeeze the same amount all at once, and the economy feels a jolt. Spread it over a few years, and it hardly notices.</> },
      { id: 'game', label: 'Keep it gentle', kind: 'game', game: {
        id: 'g-pace', title: 'Keep it gentle', goal: 'Find the gentle limit, then save as much as you can without a steep year.',
        rounds: [
          { kind: 'estimate', id: 'limit', label: 'The gentle limit', sam: <>Round one. How much can a plan tighten in a single year and still count as gentle?</>, quiz: {
        id: 'cdq1', question: 'At the budget desk, a plan counts as gentle when no single year tightens by more than…',
        choices: ['half a percent of GDP'], correct: 0,
        estimate: { min: 0, max: 5, step: 0.1, start: 2.5, answer: 0.5, spot: 0.1, close: 0.4, format: (v) => `${v.toFixed(1)}% of GDP`, diff: (d) => `${d.toFixed(1)} points`, prompt: 'Drag to the limit' },
        explain: <>Half a percent of GDP, about {halfPct} this year, is gentle. Up to 1% is moderate; more than that is steep. The steepest year counts, because that’s the jolt the economy has to absorb.</> } },
          { kind: 'custom', id: 'plan', label: 'Keep it gentle', sam: <>Round two. This plan limits deductions for high earners and trims defense. Make it as big as you can, but keep the needle out of steep. Phasing in helps.</>, play: ({ done, intro }) => <PhaseDemo game={{ done }} /> },
          { kind: 'choice', id: 'two', label: 'Bonus round', sam: <>Bonus round.</>, quiz: {
        id: 'cdq2', question: 'Two plans save the same total over ten years. Which is easier on the economy?',
        choices: ['The one that starts in full right away', 'The one phased in over three years', 'There’s no difference'], correct: 1,
        explain: <>Phasing in spreads the squeeze over several years, so no single year’s jolt is as big. The ten-year savings are the same; the game’s phase-in switch only changes the timing.</> } },
        ] } },
      { id: 'vote', label: 'Your vote', kind: 'vote', mood: 'thinking', sam: <>Phasing in is easier on the economy, but it means the savings come later. What would you ask of Congress?</>,
        vote: { kind: 'issue', id: 'phasein', question: 'Should a law that cuts the deficit phase in over several years?', choices: [
          { value: 'phase', label: 'Yes, phase it in' },
          { value: 'full', label: 'No, start in full right away' },
          { value: 'depends', label: 'It depends on the economy' },
        ], context: <>{principle('gradual')?.detail ?? principle('gradual')?.claim}{link('gradual')}</> } },

    ],
    takeaways: ['The budget desk rates a plan by its steepest year: gentle up to 0.5% of GDP, moderate up to 1%, steep above.', 'Phasing a plan in over three years keeps its savings but softens its biggest jolt.', 'Bigger plans squeeze harder, so the size of the goal decides how gentle a plan can be.'],
    shareFact: `Squeezing the economy by more than 1% of GDP in a single year counts as steep at the budget desk: about ${moneyWords(FIRST.gdp * 0.01, 0)} this year.`,
    deepDive: [{ route: 'sources', label: 'How the game scores a plan' }],
    sources: ['principle-gradual', 'cbo-multiplier-wp'],
    links: links('gradual'),
  },
  {
    id: 'level-fairness', n: 13, title: 'Who pays: retirees and low-income families', topic: 'The people a change reaches first, and the game’s ground rules', difficulty: 'Medium', minutes: 5, icon: 'hands', badge: 'Who pays',
    steps: [
      { id: 'intro', label: 'Someone pays', kind: 'story', mood: 'thinking', sam: <>Every card asks something of somebody. Some reach the folks who can least afford it: families getting by on very little, and retirees who can’t go back to work.</> },
      { id: 'game', label: 'Who pays', kind: 'game', game: {
        id: 'g-fair', title: 'Who pays', goal: 'Sort six cards by who they reach first, then spot the tax that bites tight budgets hardest.',
        rounds: [
          { kind: 'sort', id: 'sort', label: 'Sort the cards', sam: <>Round one. Sort these six cards by who they reach first.</>, quiz: {
        id: 'cfq1', question: 'Who would each of these cards reach first?',
        choices: ['retirees for the chained CPI and Part B premiums, low-income families for the Medicaid cap, and higher-income people for the three taxes'], correct: 0, sort: WHO_SORT,
        explain: <>The chained CPI slows the yearly raise in Social Security benefits for everyone already collecting, and higher Part B premiums cost Medicare enrollees more. A Medicaid cap shifts costs to states, which would likely cut coverage for low-income people. The three taxes fall mostly on higher-income people: fund managers, households with big itemized deductions, and earnings above $250,000.</> } },
          { kind: 'choice', id: 'bite', label: 'The biggest bite', sam: <>Round two. Taxes can land unevenly too.</>, quiz: BITE as Quiz },
          { kind: 'choice', id: 'rules', label: 'Bonus round', sam: <>Bonus round.</>, quiz: {
        id: 'cfq2', question: 'At the budget desk, the Promise keeper badge goes to a plan that avoids which cards?',
        choices: ['Any tax increase at all', 'Cuts to current retirees’ benefits, low-income programs, and public investment', 'Any cut to defense'], correct: 1,
        explain: <>Those are the game’s ground rules, the same ones many budget economists use: protect people who can’t adjust, and protect the investments the economy grows on. Every other card is fair game.</> } },
        ] } },
      { id: 'who', label: 'Who it reaches', kind: 'try', mood: 'thinking', sam: <>Here’s every card, sorted by who it reaches. The budget desk watches three groups closely: current retirees, programs for low-income families, and public investment.</>, body: () => <WhoItTouches /> },
      { id: 'vote', label: 'Your vote', kind: 'vote', mood: 'thinking', sam: <>So who would you protect, if it were up to you?</>,
        vote: { kind: 'issue', id: 'protect', question: 'Should a deficit plan protect current retirees and programs for low-income families?', choices: [
          { value: 'both', label: 'Yes, protect both' },
          { value: 'retirees', label: 'Protect current retirees only' },
          { value: 'lowIncome', label: 'Protect low-income programs only' },
          { value: 'none', label: 'Everything should be on the table' },
        ], context: <>Current retirees can’t go back to work to make up a cut, and low-income families spend nearly every dollar they get, so cuts there land hard. Others answer that big programs can’t be left out of a serious fix.</> } },

    ],
    takeaways: [`${CTX.options.filter((o) => o.econ.tags.some((t) => t === 'retirees' || t === 'lowIncome' || t === 'investment')).length} of the ${CTX.options.length} cards reach current retirees, low-income families, or public investment.`, 'Taxes on spending, like a carbon tax or a VAT, cost lower-income households a bigger share of income unless rebates are added.', 'The Promise keeper badge rewards a plan that protects all three groups.'],
    shareFact: `Of the ${CTX.options.length} deficit-cutting options in the game, ${CTX.options.filter((o) => !o.econ.tags.some((t) => t === 'retirees' || t === 'lowIncome' || t === 'investment')).length} leave current retirees, low-income families, and public investment alone.`,
    deepDive: [{ route: 'social-security', label: 'Social Security’s future' }],
    sources: ['cbo-options-2024'],
  },
  {
    id: 'level-growth', n: 14, title: 'Growing the pie', topic: 'Long-run growth: what lower debt and better taxes do over time', difficulty: 'Medium', minutes: 5, icon: 'sprout', badge: 'Long-run growth',
    steps: [
      { id: 'intro', label: 'The long run', kind: 'story', mood: 'happy', sam: <>Now some good news. Borrowing less helps the economy in the long run. When I borrow less, more of the country’s savings go into businesses instead, and incomes grow.</> },
      { id: 'game', label: 'Grow the pie', kind: 'game', game: {
        id: 'g-growth', title: 'Grow the pie', goal: 'Show what debt does over time, then sort the cards that help growth from the ones that hold it back.',
        rounds: [
          { kind: 'choice', id: 'debt', label: 'Debt over time', sam: <>Round one. Over the long run, what does borrowing do to the economy?</>, quiz: {
        id: 'cgq1', question: 'Over time, CBO finds that higher federal debt tends to…',
        choices: ['Raise private investment', 'Crowd out private investment and lower incomes', 'Have no effect on the economy'], correct: 1,
        explain: <>{principle('debt-growth')?.claim}</> } },
          { kind: 'sort', id: 'sort', label: 'Help or hold back', sam: <>Round two. Some cards make the economy work better over time; others blunt the reward for working and investing. Sort them.</>, quiz: { id: 'cgsort', question: 'Which cards help long-run growth, and which hold it back?', choices: ['the carbon tax, the deduction limit, and the crop insurance cut as helping growth, and the other three as holding it back'], correct: 0, sort: GROWTH_SORT, explain: <>Trimming tax breaks and subsidies, or pricing pollution, raises money while steering it better. Higher tax rates blunt the reward for working and investing, and cutting roads and schools leaves less to grow on. The budget desk counts these when it ranks cards.</> } },
          { kind: 'choice', id: 'vat', label: 'Bonus round', sam: <>Bonus round.</>, quiz: {
        id: 'cgq2', question: 'Why do many economists see a tax on consumption, like a VAT, as easier on growth than higher income tax rates?',
        choices: ['It taxes spending rather than saving and investment', 'It raises less money', 'Businesses never pay it'], correct: 0,
        explain: <>An income tax reaches the return on saving and investing; a consumption tax doesn’t. So it leaves more reward for the things that grow the economy. The catch, as the last campaign showed: it costs lower-income households a bigger share of income.</> } },
        ] } },
      { id: 'pie', label: 'Debt and your income', kind: 'try', mood: 'worried', sam: <>Here’s how CBO sees it. Slide the debt up and watch the slice it takes out of everyone’s income by 2055. The more I borrow, the bigger the slice.</>, body: () => <PieSim /> },
      { id: 'vote', label: 'Your vote', kind: 'vote', mood: 'thinking', sam: <>Here’s one economists like for growth, and many voters don’t. What do you think?</>,
        vote: { kind: 'option', optionId: 'vat-5pct' } },

    ],
    takeaways: ['Lower federal debt leaves more savings for private investment, which raises incomes over time: CBO puts income per person in 2055 about 4% higher if debt is held near today’s share.', 'Trimming tax breaks and pricing harmful activities can raise money while helping growth.', 'Higher tax rates on work and investment raise money but hold growth back a little.'],
    shareFact: `Of the ${CTX.options.length} deficit-cutting options in the game, ${CTX.options.filter((o) => o.econ.growth > 0).length} are expected to help long-run growth while they raise money or save it.`,
    deepDive: [{ route: 'debt', label: 'Debt & interest' }],
    sources: ['principle-debt-growth', 'cbo-crowding-wp', 'cbo-options-2024'],
    links: links('debt-growth'),
  },
  {
    id: 'level-investment', n: 15, title: 'Cutting public investment', topic: 'Roads, research, and schools: saving now, costing later', difficulty: 'Medium', minutes: 4, icon: 'bridge', badge: 'Public investment',
    steps: [
      { id: 'intro', label: 'Investments', kind: 'story', mood: 'thinking', sam: <>Some of what I spend is really an investment: roads and bridges, research, schools. Cutting it saves money today. But it can cost the country more down the road.</> },
      { id: 'game', label: 'Bridge inspector', kind: 'game', game: {
        id: 'g-invest', title: 'Bridge inspector', goal: 'Guess how far public investment has shrunk, then sort what builds for later from what pays for today.',
        rounds: [
          { kind: 'estimate', id: 'share', label: 'How far it fell', sam: <>Round one. Roads, research, schools, and the rest of what Congress votes on outside defense. How big is it now?</>, quiz: {
        id: 'ciq1', question: `Non-defense spending that Congress votes on each year (roads, research, schools and more) was about 5% of the economy in 1980. And in FY${ND_FY}?`,
        choices: [`${pct(ND_NOW, 1)} of GDP`], correct: 0,
        estimate: { min: 0, max: 8, step: 0.1, start: Math.round(ND_1980 * 1000) / 10, answer: ND_NOW * 100, spot: 0.2, close: 0.6, format: (v) => `${v.toFixed(1)}% of GDP`, diff: (d) => `${d.toFixed(1)} points`, prompt: 'Drag to the share', marks: [{ at: ND_1980 * 100, label: '1980' }] },
        explain: <>It fell from {pct(ND_1980, 1)} of GDP in FY1980 to {pct(ND_NOW, 1)} in FY{ND_FY}. It’s the part of the budget that has shrunk the most, because it’s the part Congress has to vote on every year.</> } },
          { kind: 'sort', id: 'sort', label: 'Investment or not', sam: <>Round two. Some spending builds for later; some pays for today. Sort them the way the White House budget office does.</>, quiz: { id: 'cisort', question: 'Which of these does the government count as an investment?', choices: ['highway grants, medical research, and Pell Grants as investments, and the other three as paying for today'], correct: 0, sort: INVEST_SORT,
            explain: <>The White House budget office counts three kinds of federal spending as investment: physical things like roads, research and development, and education and training. Benefits, health care payments, and interest pay for today.</> } },
          { kind: 'choice', id: 'double', label: 'Bonus round', sam: <>Bonus round.</>, quiz: {
        id: 'ciq2', question: 'Why do economists call cutting public investment a double hit?',
        choices: ['It slows the economy now and leaves less to grow on later', 'It raises taxes and cuts benefits at once', 'It only affects the federal government'], correct: 0,
        explain: <>Money for roads and schools is spent quickly, so cutting it slows the economy right away (CBO: {fmtMult(MULT.stateInfra.lo)} to {fmtMult(MULT.stateInfra.hi)} per dollar). And roads, research, and skills keep paying off for decades, so the country grows a little more slowly without them.</> } },
        ] } },
      { id: 'double', label: 'A double hit', kind: 'try', mood: 'worried', sam: <>Cutting it is what economists call a double hit. Slide the cut and watch my bridge wear down. Aid to states for roads and schools slows the economy right away. And it leaves less to grow on later.</>, body: () => <BridgeSim /> },
      { id: 'vote', label: 'Your vote', kind: 'vote', mood: 'thinking', sam: <>Should the things we build for the future be off limits when it’s time to cut?</>,
        vote: { kind: 'issue', id: 'investment', question: 'Should roads, research, and schools be protected from deficit cuts?', choices: [
          { value: 'protect', label: 'Yes, protect them' },
          { value: 'same', label: 'No, cut them like everything else' },
          { value: 'more', label: 'Cut them first: they can wait' },
        ], context: <>Public investment pays off over decades, which is why many economists would protect it; others point out that not every project is worth its cost.</> } },

    ],
    takeaways: [`Non-defense spending Congress votes on fell from ${pct(ND_1980, 1)} of GDP in FY1980 to ${pct(ND_NOW, 1)} in FY${ND_FY}.`, 'Cutting public investment slows the economy now and leaves less to grow on later.', `The transportation-and-education card saves ${moneyWords(opt('cut-transport-education-grants').savings10 * 1e9, 0)} over ten years, at the highest short-run cost of any cut.`],
    shareFact: 'CBO estimates that federal investment in roads, research, and schools earns about 5% a year on average, half the return on private investment.',
    deepDive: [{ route: 'spending', label: 'Where it goes' }],
    sources: ['omb-hist', 'cbo-multiplier-wp', 'cbo-fed-investment'],
  },
  {
    id: 'level-future', n: 16, title: 'Who pays later', topic: 'Interest, waiting, and the generations who inherit the debt', difficulty: 'Medium', minutes: 5, icon: 'hourglass', badge: 'The long term',
    steps: [
      { id: 'intro', label: 'Later', kind: 'story', mood: 'worried', sam: <>Every dollar I borrow today, somebody pays back later, with interest. Often it’s folks too young to vote, or not even born yet.</> },
      { id: 'game', label: 'Wait and see', kind: 'game', game: {
        id: 'g-future', title: 'Wait and see', goal: 'Guess where interest is headed, and how much bigger the fix gets with every year of waiting.',
        rounds: [
          { kind: 'estimate', id: 'interest', label: 'Interest ahead', sam: <>Round one. Where is my interest bill headed?</>, quiz: {
        id: 'cfuq1', question: `By FY${LAST.fy}, the projection puts the government’s net interest bill at about…`,
        choices: [moneyWords(LAST.netInterest, 1)], correct: 0,
        estimate: { min: 400e9, max: 2500e9, step: 10e9, start: Math.round(FIRST.netInterest / 1e10) * 1e10, answer: LAST.netInterest, spot: 0.05, close: 0.15, relative: true, format: (v) => money(v), diff: (d) => money(d), prompt: 'Drag to the interest bill', marks: [{ at: FIRST.netInterest, label: `FY${FIRST.fy}` }] },
        explain: <>About {money(LAST.netInterest)} in FY{LAST.fy}, up from {money(FIRST.netInterest)} in FY{FIRST.fy}: {LAST.netInterest > LAST.defense ? 'more than the whole defense budget' : 'close to the whole defense budget'}.</> } },
          { kind: 'estimate', id: 'wait', label: 'The cost of waiting', sam: <>Round two. Say Congress waits to start fixing the budget. How much bigger does each year’s fix have to be?</>, quiz: { id: 'cfwait', question: `If the fix waits until FY${WAITS.at(-1)!.fy}, how many times bigger must each year’s savings be than starting now?`, choices: [`about ${WAIT_X.toFixed(1)} times as big`], correct: 0,
            estimate: { min: 1, max: 6, step: 0.1, start: 1, answer: WAIT_X, spot: 0.1, close: 0.25, relative: true, format: (v) => `${v.toFixed(1)}×`, diff: (d) => `${d.toFixed(1)}×`, prompt: 'Drag to how many times as big' },
            explain: <>Starting in FY{WAITS[0].fy}, it takes {pct(WAITS[0].share, 1)} of GDP a year to keep the debt from outgrowing the economy by FY{LAST.fy}; starting in FY{WAITS.at(-1)!.fy}, {pct(WAITS.at(-1)!.share, 1)}. Fewer years are left to do the same job, and interest piles up meanwhile.</> } },
          { kind: 'choice', id: 'why', label: 'Bonus round', sam: <>Bonus round.</>, quiz: {
        id: 'cfuq2', question: 'Why does waiting make the fix bigger?',
        choices: ['The debt keeps growing, and interest is charged on the bigger debt', 'Interest rates always fall over time', 'Waiting doesn’t change anything'], correct: 0,
        explain: <>Each year of deficits adds to the debt, and each year’s interest is charged on all of it. So the longer the fix waits, the more of the budget goes to interest, and the bigger the changes needed to catch up.</> } },
        ] } },
      { id: 'chart', label: 'Try waiting', kind: 'try', mood: 'worried', sam: <>Now let’s wait and see. Slide the year the fix starts, and watch how much bigger it gets each year I wait. Interest piles up, and fewer years are left to do the job.</>, body: () => <WaitSim /> },
      { id: 'vote', label: 'Your vote', kind: 'vote', mood: 'thinking', sam: <>Someone will carry the cost. Who do you think it should mostly be?</>,
        vote: { kind: 'issue', id: 'generations', question: 'Who should carry most of the cost of fixing the budget?', choices: [
          { value: 'workers', label: 'People working today' },
          { value: 'retired', label: 'People already retired' },
          { value: 'everyone', label: 'Everyone, a little' },
          { value: 'future', label: 'Future taxpayers, by waiting' },
        ], context: <>{principle('debt-growth')?.claim}{link('debt-growth')}</> } },

    ],
    takeaways: [`Net interest is projected to reach ${money(LAST.netInterest)} by FY${LAST.fy}.`, `That’s about ${dollars(interestPerPerson)} a year for every person in the country.`, 'Waiting makes the fix bigger, because interest is charged on a growing debt.'],
    shareFact: `By FY${LAST.fy}, the interest on Uncle Sam’s debt is projected at about ${dollars(interestPerPerson)} a year for every person in America.`,
    deepDive: [{ route: 'debt', label: 'Debt & interest' }],
    sources: ['omb-hist', 'principle-debt-growth'],
    links: links('debt-growth'),
  },
];
