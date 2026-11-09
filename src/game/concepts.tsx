import { useState } from 'react';
import { TimeChart } from '../components/charts';
import { ChartFrame, Legend, Seg, TipRow, TipTitle, useTooltip, focusPoint } from '../components/ui';
import { cbo, POP } from '../data';
import { CTX } from '../lib/assess';
import { dollars, money, moneyWords, pct } from '../lib/format';
import { MULT, type MultClass, mid, optionPath } from '../lib/plan';
import { OPTIONS_DATA } from '../lib/planData';
import type { Level } from './levels';

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
const CLASSES = (Object.keys(MULT) as MultClass[]).sort((a, b) => mid(a) - mid(b));

// ---------- 1. CBO's ranges: how much a dollar of savings moves the economy at first ----------
function MultiplierRanges({ highlight }: { highlight?: MultClass[] }) {
  const { show, hide } = useTooltip();
  const max = 2.5;
  return (
    <ChartFrame title="How much the economy shrinks at first, per dollar saved" sub="CBO’s low-to-high estimates by kind of change; the dot is the middle the game uses" sourceIds={['cbo-multiplier-wp']}
      table={{ columns: [{ key: 'k', label: 'Kind of change', wrap: true }, { key: 'lo', label: 'Low', align: 'r' }, { key: 'hi', label: 'High', align: 'r' }, { key: 'm', label: 'Middle', align: 'r' }], rows: CLASSES.map((c) => ({ k: MULT[c].label, lo: fmtMult(MULT[c].lo), hi: fmtMult(MULT[c].hi), m: fmtMult(mid(c)) })) }}>
      <ol className="mranges" aria-label="CBO's ranges of output effects per dollar">
        {CLASSES.map((c) => {
          const m = MULT[c];
          const tip = <><TipTitle>{m.label}</TipTitle><TipRow label="Low to high" value={`${fmtMult(m.lo)} to ${fmtMult(m.hi)}`} /><TipRow color="var(--c-emph)" line={false} label="Middle (the game)" value={fmtMult(mid(c))} /></>;
          return (
            <li key={c} className="mrange" data-hi={highlight?.includes(c) || undefined} tabIndex={0} aria-label={`${m.label}: ${fmtMult(m.lo)} to ${fmtMult(m.hi)} of GDP per dollar`}
              onPointerMove={(e) => show(tip, e.clientX, e.clientY)} onPointerLeave={hide} onFocus={(e) => { const pt = focusPoint(e.currentTarget); show(tip, pt.x, pt.y); }} onBlur={hide}>
              <span className="mrange-label">{m.label}</span>
              <span className="mrange-track" aria-hidden="true">
                <span className="mrange-bar" style={{ left: `${(m.lo / max) * 100}%`, width: `${((m.hi - m.lo) / max) * 100}%` }} />
                <span className="mrange-dot" style={{ left: `${(mid(c) / max) * 100}%` }} />
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mrange-axis" aria-hidden="true"><span /><span className="mrange-ticks">{[0, 0.5, 1, 1.5, 2, 2.5].map((t) => <span key={t} style={{ left: `${(t / max) * 100}%` }}>{fmtMult(t)}</span>)}</span></div>
    </ChartFrame>
  );
}

// ---------- 2. Same savings, different drag ----------
const SAME = [
  { id: 'limit-itemized-15pct', label: 'Limit deductions for high earners' },
  { id: 'income-tax-rates-1pt', label: 'Raise every income tax rate' },
  { id: 'medicare-advantage-benchmarks', label: 'Pay Medicare insurers less' },
  { id: 'cut-defense-budget', label: 'Cut the defense budget' },
];
function SameSavings() {
  const [pick, setPick] = useState(SAME[0].id);
  const o = opt(pick);
  const m = MULT[o.econ.cls];
  const per = 100; // $100 billion saved in a year
  return (
    <div className="concept-try">
      <Seg label="Save $100 billion this way" value={pick} onChange={setPick} options={SAME.map((s) => ({ value: s.id, label: s.label }))} />
      <div className="concept-result" aria-live="polite">
        <span className="stat-label">Save $100 billion in a year by: {o.name.toLowerCase()}</span>
        <strong className="concept-big">The economy shrinks by about ${Math.round(per * mid(o.econ.cls))} billion at first</strong>
        <span className="small muted">CBO’s range for {m.label.toLowerCase()}: ${Math.round(per * m.lo)} to ${Math.round(per * m.hi)} billion. {o.econ.why}</span>
        <span className="concept-meter" aria-hidden="true"><span style={{ width: `${(mid(o.econ.cls) / 2.5) * 100}%` }} /></span>
      </div>
    </div>
  );
}

// ---------- 3. Speed: each year's tightening, all at once or phased in ----------
const DEMO = ['limit-itemized-15pct', 'cut-defense-budget'];
function steps(ids: string[], gradual: boolean, scale: number) {
  const tight = base.map(() => 0);
  for (const id of ids) optionPath(opt(id), base, gradual).forEach((v, i) => { tight[i] += v * scale; });
  return base.map((b, i) => (tight[i] - (i ? tight[i - 1] : 0)) / b.gdp);
}
const band = (s: number) => (s <= 0.005 ? 'gentle' : s <= 0.01 ? 'moderate' : 'steep');
function PhaseDemo() {
  const [gradual, setGradual] = useState(false);
  const [size, setSize] = useState<'1' | '2' | '3'>('2');
  const st = steps(DEMO, gradual, Number(size));
  const peak = Math.max(...st);
  const r = band(peak);
  const max = 0.025;
  return (
    <div className="concept-try">
      <div className="concept-controls">
        <Seg label="How big a plan" value={size} onChange={setSize} options={[{ value: '1', label: 'Small' }, { value: '2', label: 'Bigger' }, { value: '3', label: 'Biggest' }]} />
        <label className="switch"><input type="checkbox" checked={gradual} onChange={(e) => setGradual(e.target.checked)} /> Phase in over 3 years</label>
      </div>
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
    </div>
  );
}

// ---------- 4. Who each card reaches ----------
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

// ---------- 5. What helps or hurts long-run growth ----------
function GrowthSplit() {
  const [side, setSide] = useState<'helps' | 'hurts'>('helps');
  const cards = CTX.options.filter((o) => (side === 'helps' ? o.econ.growth > 0 : o.econ.growth < 0));
  return (
    <div className="concept-try">
      <Seg label="Cards that…" value={side} onChange={setSide} options={[{ value: 'helps', label: 'Help growth over time' }, { value: 'hurts', label: 'Hold growth back' }]} />
      <ul className="concept-cards">
        {cards.map((o) => <li key={o.id} className="concept-card" data-growth={side}><span className="rcard-kind" data-side={o.side}>{o.side === 'revenue' ? 'Tax' : 'Cut'}</span><span><strong>{o.name}</strong><span className="small muted"> {o.econ.why}</span></span></li>)}
      </ul>
      <p className="small muted">The budget desk counts these when it ranks cards: a card that helps growth scores a little better, and one that holds it back a little worse.</p>
    </div>
  );
}

// ---------- 6. Public investment over time ----------
function InvestmentChart() {
  const h = hist.filter((x) => x.fy >= 1962);
  return (
    <ChartFrame title="Non-defense spending Congress votes on each year, as a share of the economy" sub="Roads, research, schools, parks, public health, and the rest of the non-defense discretionary budget" sourceIds={['omb-hist']}>
      <TimeChart label="Non-defense discretionary spending as a share of GDP" x={h.map((r) => r.fy)} height={200} yMin={0} yFormat={(v) => `${(v * 100).toFixed(0)}%`} tipFormat={(v) => `${(v * 100).toFixed(1)}% of GDP`} tipTitle={(y) => `FY${y}`}
        series={[{ id: 'nd', label: 'Non-defense discretionary', color: 'var(--c-other)', kind: 'line', values: h.map((r) => r.nondefense / r.gdp) }]} />
    </ChartFrame>
  );
}

// ---------- 7. The interest bill ahead ----------
function InterestAhead() {
  return (
    <ChartFrame title="Interest against defense, in the years ahead" sub={`The ${cbo.projShort.toLowerCase()} for FY${FIRST.fy}–FY${LAST.fy}`} legend={<Legend items={[{ label: 'Net interest', color: 'var(--c-interest)', kind: 'line' }, { label: 'Defense', color: 'var(--c-defense)', kind: 'line' }]} />}>
      <TimeChart label="Net interest and defense spending, projected" x={base.map((r) => r.fy)} height={200} yMin={0} yFormat={(v) => `$${(v / 1e12).toFixed(1)}T`} tipFormat={(v) => money(v)} tipTitle={(y) => `FY${y}`} endLabels
        series={[{ id: 'i', label: 'Net interest', color: 'var(--c-interest)', kind: 'line', values: base.map((r) => r.netInterest) }, { id: 'd', label: 'Defense', color: 'var(--c-defense)', kind: 'line', values: base.map((r) => r.defense) }]} />
    </ChartFrame>
  );
}

const link = (id: string) => { const p = principle(id); return p ? <> <a href={p.source.url} target="_blank" rel="noreferrer">{p.source.title.split(',')[0]}</a></> : null; };
const links = (...ids: string[]) => ids.map((id) => principle(id)).filter(Boolean).map((p) => ({ title: p!.source.title, url: p!.source.url }));
const steady = <span className="small muted">CBO’s ranges come from its review of the research; the game uses the middle of each.</span>;
const halfPct = moneyWords(FIRST.gdp * 0.005, 0);
const interestPerPerson = LAST.netInterest / POP;
const purchases = MULT.purchases, high = MULT.taxHigh, people = MULT.transfersPersons;

export const CONCEPT_LEVELS: Level[] = [
  {
    id: 'level-economy', n: 11, title: 'How a policy hits the economy', topic: 'Why the same savings can slow the economy a little or a lot', difficulty: 'Medium', minutes: 5, icon: 'wave', badge: 'Economic drag',
    steps: [
      { id: 'intro', label: 'A dollar less', kind: 'story', mood: 'thinking', sam: <>When I save a dollar, somebody somewhere has a dollar less to spend. For a while, that can slow the whole economy down. How much depends on whose dollar it was.</> },
      { id: 'q1', label: 'Take a guess', kind: 'quiz', quiz: {
        id: 'ceq1', guess: true, question: 'For each dollar saved, which change slows the economy the least at first?',
        choices: ['Cutting what the government buys', 'Raising taxes on higher-income people', 'Cutting payments to people'], correct: 1,
        explain: <>CBO estimates a dollar raised from higher-income people shrinks output by {fmtMult(high.lo)} to {fmtMult(high.hi)} at first, because they’d have saved part of it anyway. A dollar less of government purchases: {fmtMult(purchases.lo)} to {fmtMult(purchases.hi)}. Payments to people: {fmtMult(people.lo)} to {fmtMult(people.hi)}.</> } },
      { id: 'ranges', label: 'The ranges', kind: 'facts', mood: 'thinking', sam: <>Here are CBO’s estimates for each kind of change. The longer the bar, the more economists disagree. The further right, the more a dollar of savings slows things down at first.</>, body: () => <><MultiplierRanges />{steady}</> },
      { id: 'same', label: 'Same savings', kind: 'try', mood: 'happy', sam: <>Let’s save the same hundred billion dollars four ways. Tap each one and watch how much the economy feels it.</>, body: () => <SameSavings /> },
      { id: 'q2', label: 'Quick check', kind: 'quiz', quiz: {
        id: 'ceq2', question: 'Why does cutting what the government buys hit the economy hardest at first?',
        choices: ['Every dollar not spent is a dollar less of goods and services bought right away', 'Government purchases are taxed twice', 'The Federal Reserve can never respond to it'], correct: 0,
        explain: <>When the government stops buying something, that spending simply disappears. Part of a tax increase or a smaller benefit check would have been saved anyway, so less spending vanishes. The Federal Reserve can soften the blow by lowering rates, one reason CBO’s ranges are wide.</> } },
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
      { id: 'q1', label: 'Take a guess', kind: 'quiz', quiz: {
        id: 'cdq1', guess: true, question: 'At the budget desk, a plan counts as gentle when no single year tightens by more than…',
        choices: ['Half a percent of GDP', '2% of GDP', '5% of GDP'], correct: 0,
        explain: <>Half a percent of GDP, about {halfPct} this year, is gentle. Up to 1% is moderate; more than that is steep. The steepest year counts, because that’s the jolt the economy has to absorb.</> } },
      { id: 'demo', label: 'Try the pace', kind: 'try', mood: 'thinking', sam: <>This plan limits deductions for high earners and trims defense. Make it bigger, then switch on the phase-in, and watch the steepest bar.</>, body: () => <PhaseDemo /> },
      { id: 'q2', label: 'Quick check', kind: 'quiz', quiz: {
        id: 'cdq2', question: 'Two plans save the same total over ten years. Which is easier on the economy?',
        choices: ['The one that starts in full right away', 'The one phased in over three years', 'There’s no difference'], correct: 1,
        explain: <>Phasing in spreads the squeeze over several years, so no single year’s jolt is as big. The ten-year savings are the same; the game’s phase-in switch only changes the timing.</> } },
      { id: 'vote', label: 'Your vote', kind: 'vote', mood: 'thinking', sam: <>Phasing in is easier on the economy, but it means the savings come later. What would you ask of Congress?</>,
        vote: { kind: 'issue', id: 'phasein', question: 'Should a law that cuts the deficit phase in over several years?', choices: [
          { value: 'phase', label: 'Yes, phase it in' },
          { value: 'full', label: 'No, start in full right away' },
          { value: 'depends', label: 'It depends on the economy' },
        ], context: <>{principle('gradual')?.detail ?? principle('gradual')?.claim}{link('gradual')}</> } },
    ],
    takeaways: ['The budget desk rates a plan by its steepest year: gentle up to 0.5% of GDP, moderate up to 1%, steep above.', 'Phasing a plan in over three years keeps its savings but softens its biggest jolt.', 'Bigger plans squeeze harder, so the size of the goal decides how gentle a plan can be.'],
    shareFact: `Half a percent of the U.S. economy is about ${halfPct}: the most a plan can tighten in one year and still count as gentle.`,
    deepDive: [{ route: 'sources', label: 'How the game scores a plan' }],
    sources: ['principle-gradual', 'cbo-multiplier-wp'],
    links: links('gradual'),
  },
  {
    id: 'level-fairness', n: 13, title: 'Who pays: retirees and low-income families', topic: 'The people a change reaches first, and the game’s ground rules', difficulty: 'Medium', minutes: 5, icon: 'hands', badge: 'Who pays',
    steps: [
      { id: 'intro', label: 'Someone pays', kind: 'story', mood: 'thinking', sam: <>Every card asks something of somebody. Some reach the folks who can least afford it: families getting by on very little, and retirees who can’t go back to work.</> },
      { id: 'q1', label: 'Take a guess', kind: 'quiz', quiz: {
        id: 'cfq1', guess: true, question: 'Which of these cards would reach people who are already retired?',
        choices: ['Slower cost-of-living raises (the chained CPI)', 'Taxing carried interest as ordinary income', 'Limiting what itemized deductions save'], correct: 0,
        explain: <>The chained CPI slows the yearly raise in Social Security benefits for everyone already collecting, and the effect grows with age. The other two reach investment-fund managers and higher-income filers.</> } },
      { id: 'who', label: 'Who it reaches', kind: 'try', mood: 'thinking', sam: <>Here’s every card, sorted by who it reaches. The budget desk watches three groups closely: current retirees, programs for low-income families, and public investment.</>, body: () => <WhoItTouches /> },
      { id: 'taxes', label: 'Taxes too', kind: 'facts', mood: 'worried', sam: <>Taxes can land unevenly too. A tax on carbon or a sales-style tax costs lower-income households a bigger share of what they earn, because they spend more of it. Rebates can fix that, but these cards don’t include them.</>, body: () => (
        <ul className="concept-cards">{['carbon-tax-25', 'vat-5pct'].map((id) => { const o = opt(id); return <li key={id} className="concept-card"><span className="rcard-kind" data-side="revenue">Tax</span><span><strong>{o.name}</strong><span className="small muted"> {o.econ.why}</span></span></li>; })}</ul>
      ) },
      { id: 'q2', label: 'Quick check', kind: 'quiz', quiz: {
        id: 'cfq2', question: 'At the budget desk, the Promise keeper badge goes to a plan that avoids which cards?',
        choices: ['Any tax increase at all', 'Cuts to current retirees’ benefits, low-income programs, and public investment', 'Any cut to defense'], correct: 1,
        explain: <>Those are the game’s ground rules, the same ones many budget economists use: protect people who can’t adjust, and protect the investments the economy grows on. Every other card is fair game.</> } },
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
      { id: 'q1', label: 'Take a guess', kind: 'quiz', quiz: {
        id: 'cgq1', guess: true, question: 'Over time, CBO finds that higher federal debt tends to…',
        choices: ['Raise private investment', 'Crowd out private investment and lower incomes', 'Have no effect on the economy'], correct: 1,
        explain: <>{principle('debt-growth')?.claim}</> } },
      { id: 'split', label: 'Help or hold back', kind: 'try', mood: 'thinking', sam: <>Some cards make the economy work better over time: they trim tax breaks that steer money the wrong way, or price things that cost us all. Others blunt the reward for working and investing. Have a look.</>, body: () => <GrowthSplit /> },
      { id: 'q2', label: 'Quick check', kind: 'quiz', quiz: {
        id: 'cgq2', question: 'Why do many economists see a tax on consumption, like a VAT, as easier on growth than higher income tax rates?',
        choices: ['It taxes spending rather than saving and investment', 'It raises less money', 'Businesses never pay it'], correct: 0,
        explain: <>An income tax reaches the return on saving and investing; a consumption tax doesn’t. So it leaves more reward for the things that grow the economy. The catch, as the last campaign showed: it costs lower-income households a bigger share of income.</> } },
      { id: 'vote', label: 'Your vote', kind: 'vote', mood: 'thinking', sam: <>Here’s one economists like for growth, and many voters don’t. What do you think?</>,
        vote: { kind: 'option', optionId: 'vat-5pct' } },
    ],
    takeaways: ['Lower federal debt leaves more savings for private investment, which raises incomes over time.', 'Trimming tax breaks and pricing harmful activities can raise money while helping growth.', 'Higher tax rates on work and investment raise money but hold growth back a little.'],
    shareFact: `Of the ${CTX.options.length} deficit-cutting options in the game, ${CTX.options.filter((o) => o.econ.growth > 0).length} are expected to help long-run growth while they raise money or save it.`,
    deepDive: [{ route: 'debt', label: 'Debt & interest' }],
    sources: ['principle-debt-growth', 'cbo-options-2024'],
    links: links('debt-growth'),
  },
  {
    id: 'level-investment', n: 15, title: 'Cutting public investment', topic: 'Roads, research, and schools: saving now, costing later', difficulty: 'Medium', minutes: 4, icon: 'bridge', badge: 'Public investment',
    steps: [
      { id: 'intro', label: 'Investments', kind: 'story', mood: 'thinking', sam: <>Some of what I spend is really an investment: roads and bridges, research, schools. Cutting it saves money today. But it can cost the country more down the road.</> },
      { id: 'q1', label: 'Take a guess', kind: 'quiz', quiz: {
        id: 'ciq1', guess: true, question: `Non-defense spending that Congress votes on each year (roads, research, schools and more) was about 5% of the economy in 1980. And in FY${ND_FY}?`,
        choices: ['Bigger, about 7%', 'About the same, 5%', `Smaller, about ${pct(ND_NOW, 0)}`], correct: 2,
        explain: <>It fell from {pct(ND_1980, 1)} of GDP in FY1980 to {pct(ND_NOW, 1)} in FY{ND_FY}. It’s the part of the budget that has shrunk the most, because it’s the part Congress has to vote on every year.</> } },
      { id: 'chart', label: 'Over time', kind: 'facts', mood: 'worried', sam: <>Here’s that share of the economy since 1962. Programs that run on autopilot keep growing; this is the part that gets squeezed when money is tight.</>, body: () => <InvestmentChart /> },
      { id: 'double', label: 'A double hit', kind: 'facts', mood: 'worried', sam: <>Cutting it is what economists call a double hit. Aid to states for roads and schools has one of the biggest effects on the economy at first. And it leaves less to grow on later.</>, body: () => <MultiplierRanges highlight={['stateInfra']} /> },
      { id: 'q2', label: 'Quick check', kind: 'quiz', quiz: {
        id: 'ciq2', question: 'Why do economists call cutting public investment a double hit?',
        choices: ['It slows the economy now and leaves less to grow on later', 'It raises taxes and cuts benefits at once', 'It only affects the federal government'], correct: 0,
        explain: <>Money for roads and schools is spent quickly, so cutting it slows the economy right away (CBO: {fmtMult(MULT.stateInfra.lo)} to {fmtMult(MULT.stateInfra.hi)} per dollar). And roads, research, and skills keep paying off for decades, so the country grows a little more slowly without them.</> } },
      { id: 'vote', label: 'Your vote', kind: 'vote', mood: 'thinking', sam: <>Should the things we build for the future be off limits when it’s time to cut?</>,
        vote: { kind: 'issue', id: 'investment', question: 'Should roads, research, and schools be protected from deficit cuts?', choices: [
          { value: 'protect', label: 'Yes, protect them' },
          { value: 'same', label: 'No, cut them like everything else' },
          { value: 'more', label: 'Cut them first: they can wait' },
        ], context: <>Public investment pays off over decades, which is why many economists would protect it; others point out that not every project is worth its cost.</> } },
    ],
    takeaways: [`Non-defense spending Congress votes on fell from ${pct(ND_1980, 1)} of GDP in FY1980 to ${pct(ND_NOW, 1)} in FY${ND_FY}.`, 'Cutting public investment slows the economy now and leaves less to grow on later.', `The transportation-and-education card saves ${moneyWords(opt('cut-transport-education-grants').savings10 * 1e9, 0)} over ten years, at the highest short-run cost of any cut.`],
    shareFact: `Federal non-defense spending that Congress votes on each year fell from ${pct(ND_1980, 1)} of the economy in 1980 to ${pct(ND_NOW, 1)} today.`,
    deepDive: [{ route: 'spending', label: 'Where it goes' }],
    sources: ['omb-hist', 'cbo-multiplier-wp'],
  },
  {
    id: 'level-future', n: 16, title: 'Who pays later', topic: 'Interest, waiting, and the generations who inherit the debt', difficulty: 'Medium', minutes: 5, icon: 'hourglass', badge: 'The long term',
    steps: [
      { id: 'intro', label: 'Later', kind: 'story', mood: 'worried', sam: <>Every dollar I borrow today, somebody pays back later, with interest. Often it’s folks too young to vote, or not even born yet.</> },
      { id: 'q1', label: 'Take a guess', kind: 'quiz', quiz: {
        id: 'cfuq1', guess: true, question: `By FY${LAST.fy}, the projection puts the government’s net interest bill at about…`,
        choices: [moneyWords(LAST.netInterest * 0.55, 1), moneyWords(LAST.netInterest, 1), moneyWords(LAST.netInterest * 1.8, 1)], correct: 1,
        explain: <>About {money(LAST.netInterest)} in FY{LAST.fy}, up from {money(FIRST.netInterest)} in FY{FIRST.fy}: {LAST.netInterest > LAST.defense ? 'more than the whole defense budget' : 'close to the whole defense budget'}.</> } },
      { id: 'chart', label: 'The bill ahead', kind: 'facts', mood: 'worried', sam: <>Here’s interest against defense in the years ahead. Interest buys nothing new. It’s the price of what was already spent.</>, body: () => <InterestAhead /> },
      { id: 'share', label: 'Your share', kind: 'facts', mood: 'thinking', sam: <>Split that interest bill across everyone in the country, and it comes to about {dollars(interestPerPerson)} a person, every year. Kids included.</>, body: () => (
        <div className="concept-result"><span className="stat-label">Net interest in FY{LAST.fy}, per person</span><strong className="concept-big">{dollars(interestPerPerson)} a year</strong><span className="small muted">{money(LAST.netInterest)} ÷ {(POP / 1e6).toFixed(0)} million people (today’s population). The debt held by the public is projected at {pct(LAST.debtPublic / LAST.gdp, 0)} of GDP that year.</span></div>
      ) },
      { id: 'q2', label: 'Quick check', kind: 'quiz', quiz: {
        id: 'cfuq2', question: 'Why does waiting make the fix bigger?',
        choices: ['The debt keeps growing, and interest is charged on the bigger debt', 'Interest rates always fall over time', 'Waiting doesn’t change anything'], correct: 0,
        explain: <>Each year of deficits adds to the debt, and each year’s interest is charged on all of it. So the longer the fix waits, the more of the budget goes to interest, and the bigger the changes needed to catch up.</> } },
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
