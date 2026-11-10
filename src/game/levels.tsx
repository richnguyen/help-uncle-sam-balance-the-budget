import { load, save } from '../lib/storage';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { BarList, SegBar, TimeChart, Waffle } from '../components/charts';
import { ChartFrame, Legend, Stat, Term } from '../components/ui';
import { budget, debt, fyTotals, geo, HH, laws, POP, process, SOURCE_BY_ID, ssa, tax } from '../data';
import { BUCKETS, REVENUE_BY_ID } from '../lib/categories';
import { bucketYear, categoryTotals, cboSeries } from '../lib/derive';
import { dateLabel, dollars, money, moneyWords, pct, people } from '../lib/format';
import { OPTIONS_DATA } from '../lib/planData';
import { backendOn, rpc } from '../lib/backend';
import { useVotes } from '../lib/votes';
import { areaForZip, isZip } from '../lib/zip';
import { CountyTry, rememberZip } from './county';
import { ReceiptTeaser, useWages, WageControls } from '../components/TaxReceipt';
import type { Mood } from './voice';
import { LawExplorer } from './LawExplorer';
import { QUOTES, type Quote } from './quotes';
import { CONCEPT_LEVELS } from './concepts';
import { PROCESS_LEVELS } from './process';
import { BUDGET_CALENDAR, Dial, InterestRateSim, OctoberChoice, RevenueTank, SsMixer } from './sims';
import type { GameSpec } from './minigame';
import { HigherLowerRound, OrderRound, PairsRound } from './rounds';
import type { SizeGuess, SortGuess, SplitGuess } from './guesses';

// ---------------------------------------------------------------------------------------------
// The seven chapter levels. Every number Uncle Sam says, and every quiz answer, is computed from
// the same official data the rest of the site uses.
// ---------------------------------------------------------------------------------------------

/**
 * A guess made by dragging a slider instead of picking: the player sets a number, locks it in, and
 * sees the real one and how close they came. `spot` and `close` are how near counts as spot on and
 * as close (in the slider's units, or as a share of the answer when `relative`).
 */
export interface Estimate { min: number; max: number; step: number; start: number; answer: number; spot: number; close: number; relative?: boolean; format: (v: number) => string; diff: (d: number) => string; prompt: string; marks?: { at: number; label: string }[] }
/**
 * `guess`: asked before the step that shows the answer. One pick (or, with `estimate`, one slider
 * setting), then the answer; it never counts toward stars. For an estimate, a split, sized bars or
 * a sort, `choices` holds just the answer, written out, so Uncle Sam can say it.
 */
export interface Quiz { id: string; question: string; choices: string[]; correct: number; explain: ReactNode; guess?: boolean; estimate?: Estimate; split?: SplitGuess; sizes?: SizeGuess; sort?: SortGuess }
export type VoteSpec =
  | { kind: 'option'; optionId: string }
  | { kind: 'issue'; id: string; question: string; context: ReactNode; choices: { value: string; label: string }[] };

export interface Step {
  id: string;
  label: string;
  /** `game`: the mission's scored game, a few rounds that set its stars. */
  kind: 'story' | 'facts' | 'try' | 'quiz' | 'vote' | 'game';
  mood?: Mood;
  sam?: ReactNode; // what Uncle Sam says on this step
  body?: () => ReactNode;
  quiz?: Quiz;
  vote?: VoteSpec;
  game?: GameSpec;
}

export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Super hard';
export type IconId = 'paycheck' | 'bills' | 'home' | 'gap' | 'gauge' | 'card' | 'capitol' | 'target' | 'shield' | 'scale' | 'wave' | 'meter' | 'hands' | 'sprout' | 'bridge' | 'hourglass' | 'flow' | 'people' | 'whistle' | 'brake';

export interface Level {
  id: string;
  n: number;
  title: string;
  topic: string;
  difficulty: Difficulty;
  minutes: number;
  icon: IconId;
  badge: string;
  steps: Step[];
  takeaways: string[];
  /** The one fact on the level's certificate: true, surprising, and never the answer to any quick check in the game. */
  shareFact: string;
  deepDive: { route: string; label: string }[];
  sources: string[];
  links?: { title: string; url: string }[]; // full documents beyond the site's source list
}

// ---------- shared figures ----------
const FY = budget.latestFY;
const T = fyTotals(FY);
const REC = [...(budget.receiptsByFY[String(FY)] ?? [])].sort((a, b) => b.amount - a.amount);
const REC_TOTAL = REC.reduce((s, r) => s + r.amount, 0);
const CATS = categoryTotals(FY);
const cat = (id: string) => CATS.find((c) => c.id === id)!.amount;
const BUCKET = bucketYear(FY);
const SERIES = cboSeries();
const LAST_SURPLUS = [...SERIES].filter((r) => r.actual).reverse().find((r) => r.deficit < 0)?.fy ?? 2001;
const MI_SHARE = (BUCKET.y.mandatory + BUCKET.y.netInterest) / BUCKET.y.revenues;
const BORROWED = T.deficit / T.outlays;
const D = debt.latest;
const EARN = REC.filter((r) => r.id === 'individual' || r.id === 'payroll').reduce((s, r) => s + r.amount, 0);
const opt = (id: string) => OPTIONS_DATA.options.find((o) => o.id === id);
const src = (id: string) => SOURCE_BY_ID[id];
const principle = (id: string) => OPTIONS_DATA.principles.find((p) => p.id === id);
/** Whole dollars out of $100 that add up to exactly $100 (largest remainder). */
const wholeDollars = (vals: number[]) => {
  const tot = vals.reduce((a, v) => a + v, 0);
  const raw = vals.map((v) => (v / tot) * 100);
  const out = raw.map(Math.floor);
  const left = 100 - out.reduce((a, v) => a + v, 0);
  raw.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r).slice(0, left).forEach(({ i }) => { out[i] += 1; });
  return out;
};
const recOf = (id: string) => REC.find((r) => r.id === id)?.amount ?? 0;
const SPLIT_PARTS = [
  { id: 'individual', label: 'Income taxes', color: REVENUE_BY_ID.individual.color, v: recOf('individual') },
  { id: 'payroll', label: 'Payroll taxes', color: REVENUE_BY_ID.payroll.color, v: recOf('payroll') },
  { id: 'corporate', label: 'Corporate taxes', color: REVENUE_BY_ID.corporate.color, v: recOf('corporate') },
  { id: 'other', label: 'Everything else', color: REVENUE_BY_ID.customs.color, v: REC_TOTAL - recOf('individual') - recOf('payroll') - recOf('corporate') },
];
const SPLIT_ANSWER = wholeDollars(SPLIT_PARTS.map((x) => x.v));
const SPLIT: SplitGuess = { parts: SPLIT_PARTS.map((x, i) => ({ id: x.id, label: x.label, color: x.color, answer: SPLIT_ANSWER[i] })), prompt: 'Drag the dividers to split the $100.', spot: 6, close: 15 };
/** 1.1: the taxes on a pay stub, and where each one goes. */
const STUB: Quiz = {
  id: 'g1stub', question: 'Where does each tax on your pay stub go?',
  choices: ['the income tax to the general fund, both Social Security taxes to Social Security’s trust funds, and the Medicare tax to Medicare’s hospital trust fund'], correct: 0,
  sort: {
    bins: [{ id: 'general', label: 'The Treasury’s general fund' }, { id: 'ss', label: 'Social Security’s trust funds' }, { id: 'hi', label: 'Medicare’s hospital trust fund' }],
    items: [
      { id: 'fit', label: 'Federal income tax withheld', bin: 'general' },
      { id: 'oasdi', label: 'Social Security tax (6.2%)', bin: 'ss' },
      { id: 'hi', label: 'Medicare tax (1.45%)', bin: 'hi' },
      { id: 'match', label: 'Your employer’s matching Social Security tax', bin: 'ss' },
    ],
    prompt: 'Drag each tax to where it goes, or tap a tax and then a fund.',
  },
  explain: <>Payroll taxes are dedicated by law. In FY{FY} the retirement and disability <Term id="trust-fund">trust funds</Term> received {money(budget.payroll.filter((p) => /OASI|\(DI\)/.test(p.name)).reduce((s, p) => s + p.amount, 0))} from them, and the Medicare tax goes to Medicare’s hospital insurance fund. Income taxes go into the Treasury’s general fund, which pays for everything else.</>,
};
/** 1.2: two bills at a time; the player taps the bigger one. */
const catOf = (id: string) => CATS.find((c) => c.id === id)!;
const PAIRS = ([['defense', 'interest'], ['medicare', 'defense'], ['income', 'veterans'], ['health', 'interest'], ['medicare', 'health']] as const)
  .map(([a, b]) => [a, b].map((id) => ({ id, label: catOf(id).label, value: catOf(id).amount, color: catOf(id).color })) as [ReturnType<typeof catOf> & { value: number }, ReturnType<typeof catOf> & { value: number }]);
const DISC_SHARE = (BUCKET.y.discretionary / BUCKET.y.outlays) * 100;
/** 1.3: states well above or below the national average per person (the near-average ones would be coin flips). */
const HILO = ['VA', 'GA', 'NM', 'NJ', 'AK', 'UT', 'MD', 'IL']
  .map((a) => geo.states.find((x) => x.abbr === a))
  .filter((x): x is NonNullable<typeof x> => !!x && Math.abs(x.perCapita / geo.national.perCapita - 1) > 0.15)
  .map((x) => ({ id: x.abbr, label: x.name, value: x.perCapita }));
const BILLS: SizeGuess = {
  parts: [{ id: 'defense', label: 'Defense' }, { id: 'medicare', label: 'Medicare' }, { id: 'ss', label: 'Social Security' }, { id: 'interest', label: 'Interest' }]
    .map((b) => ({ ...b, color: CATS.find((c) => c.id === b.id)!.color, answer: cat(b.id) })),
  max: 2e12, step: 25e9, start: 750e9, format: (v) => money(v), prompt: 'Drag each bar up or down to your guess.',
};

// ---------- small interactive pieces ----------
function WaffleBlock() {
  const [active, setActive] = useState<string | null>(null);
  const tot = CATS.reduce((s, c) => s + c.amount, 0);
  return (
    <div className="waffle-wrap">
      <Waffle parts={CATS.map((c) => ({ id: c.id, label: c.label, value: c.amount, color: c.color }))} active={active} onActive={setActive} label={`Every $100 of FY${FY} spending`} />
      <div className="key-list" role="list" onPointerLeave={() => setActive(null)}>
        {CATS.map((c) => (
          <div key={c.id} role="listitem" className="key-row" data-active={active === c.id} onPointerEnter={() => setActive(c.id)}>
            <span className="swatch" style={{ background: c.color }} />
            <span><strong>{c.label}</strong><div className="small muted">{c.blurb}</div></span>
            <span className="amt">${Math.round((c.amount / tot) * 100)}</span>
            <span className="share">{money(c.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaxTry() {
  const w = useWages();
  return (
    <div className="try try-receipt">
      <div className="try-controls">
        <WageControls id="try-w" {...w} />
        <p className="small muted">An estimate: {tax.year} IRS rates, the standard deduction, and wages as your only income. <a href="#receipt">More options and assumptions</a></p>
      </div>
      {/* The receipt itself opens as a pop-up, so the step stays short on a phone. */}
      <ReceiptTeaser wages={w.wages} status={w.status} />
    </div>
  );
}

function AgeTry() {
  const [born, setBorn] = useState(1975);
  const d = ssa.depletion;
  return (
    <div className="try">
      <div className="field" style={{ maxWidth: 240 }}><label htmlFor="try-b">Your birth year</label><input id="try-b" className="input" type="number" min={1920} max={2025} value={born} onChange={(e) => setBorn(Math.max(1920, Math.min(2025, Number(e.target.value) || 1975)))} /></div>
      <div className="grid-3" style={{ gap: 12 }}>
        <Stat label={`Your age in late ${d.oasi.year}`} value={`${d.oasi.year - born}`} note={d.oasi.year - born >= 62 ? 'You would likely be collecting by then.' : `Full retirement age (67) arrives in ${born + 67}.`} />
        <Stat label="Automatic cut if nothing changes" value={`about ${100 - d.oasi.payablePct}%`} note="for retirement and survivor benefits" />
        <Stat label="A $2,000 monthly check would become" value={dollars((2000 * d.oasi.payablePct) / 100)} note="per month" />
      </div>
    </div>
  );
}

/** How a state's (or 3-digit ZIP area's) players voted, once enough of them have saved a ZIP. */
interface AreaTally { voters: number; options: Record<string, { support: number; oppose: number }>; issues: Record<string, Record<string, number>> }
const AREA_MIN = 10;

function StateTry() {
  const states = [...geo.states].sort((a, b) => a.name.localeCompare(b.name));
  const votes = useVotes();
  // The state is remembered (and, on the public site, counts toward the state rankings).
  const [abbr, setAbbrState] = useState(() => load<string>('state', 'TX'));
  const setAbbr = (a: string) => { setAbbrState(a); save('state', a); save('state-picked', true); };
  // A saved ZIP lives with the ballot on the public site; elsewhere it stays in this browser.
  const inDb = votes.zipHome === 'database';
  const savedZip = (inDb ? votes.mine.zip : load<string>('zip', '')) || '';
  const [zip, setZip] = useState(savedZip);
  const [keep, setKeep] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [area, setArea] = useState<AreaTally | null | undefined>(undefined);
  useEffect(() => { if (savedZip && !zip) setZip(savedZip); }, [savedZip]); // eslint-disable-line react-hooks/exhaustive-deps
  const saved = !!savedZip && savedZip === zip;
  const s = states.find((x) => x.abbr === abbr) ?? states[0];
  const nat = geo.national;
  useEffect(() => {
    if (!saved || !inDb || !backendOn()) return;
    let alive = true;
    rpc<{ states?: Record<string, AreaTally> }>('ballot_area_totals').then((t) => { if (alive) setArea(t?.states?.[abbr] ?? null); }).catch(() => { if (alive) setArea(null); });
    return () => { alive = false; };
  }, [saved, inDb, abbr]);
  const find = (e?: React.FormEvent) => {
    e?.preventDefault();
    const z = zip.trim();
    const a = areaForZip(z);
    if (!a) { setMsg('A ZIP code is five digits.'); return; }
    if (a.kind === 'military') { setMsg('That’s a military ZIP, which has no state. Pick a state instead.'); setPicker(true); return; }
    if (a.kind === 'unknown' || !states.some((x) => x.abbr === a.abbr)) { setMsg('That ZIP doesn’t match a state. Check it, or pick a state instead.'); return; }
    setMsg(null); setAbbr(a.abbr); rememberZip(z);
    if (keep) { votes.setZip(z, a.abbr); save('zip', inDb ? '' : z); }
  };
  const saveNow = () => { const a = areaForZip(zip.trim()); if (a?.kind === 'state') { votes.setZip(zip.trim(), a.abbr); save('zip', inDb ? '' : zip.trim()); } };
  const remove = () => { votes.setZip(null, null); save('zip', ''); setZip(''); setKeep(false); setArea(undefined); rememberZip(''); };
  const top = area ? Object.entries(area.options).filter(([, t]) => t.support + t.oppose >= AREA_MIN).sort((x, y) => y[1].support / (y[1].support + y[1].oppose) - x[1].support / (x[1].support + x[1].oppose))[0] : undefined;
  const topName = top ? OPTIONS_DATA.options.find((o) => o.id === top[0])?.name : undefined;
  return (
    <div className="try">
      <form className="zip-form" onSubmit={find} aria-label="Find your state from your ZIP code">
        <div className="field"><label htmlFor="try-zip">Your ZIP code</label>
          <input id="try-zip" className="input zip-input num" inputMode="numeric" autoComplete="postal-code" maxLength={5} placeholder="e.g. 22301" value={zip}
            onChange={(e) => { setZip(e.target.value.replace(/\D/g, '').slice(0, 5)); setMsg(null); }} aria-describedby="zip-note" />
        </div>
        <button type="submit" className="btn btn-primary zip-find" disabled={!isZip(zip)}>Find my state</button>
        {!saved && (
          <label className="switch zip-keep"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> Also save my ZIP with my budget votes</label>
        )}
      </form>
      {msg && <p className="small zip-msg" role="alert">{msg}</p>}
      <p className="small muted" id="zip-note">
        Optional. {inDb
          ? 'If you save it, your ZIP is stored with your budget votes in the game’s database, where only you can see it.'
          : 'In this copy of the game, a saved ZIP stays in this browser; it isn’t shared with anyone.'}{' '}
        Public results group players only by state, or by the first three digits of a ZIP once {AREA_MIN} or more players share them. You can remove it any time.
      </p>
      {saved ? (
        <div className="zip-stamp" role="status">
          <span className="zip-postmark" aria-hidden="true"><strong className="num">{savedZip}</strong><em>{abbr}</em></span>
          <span><strong>Saved with your votes.</strong> <span className="small muted">{inDb ? 'Only you can see your ZIP.' : 'Kept in this browser only.'}</span></span>
          <button type="button" className="btn btn-sm zip-remove" onClick={remove}>Remove my ZIP</button>
        </div>
      ) : isZip(zip) && areaForZip(zip)?.kind === 'state' && abbr === (areaForZip(zip) as { abbr: string }).abbr && !keep ? (
        <button type="button" className="btn btn-sm zip-save" onClick={saveNow}>Save my ZIP with my votes</button>
      ) : null}
      {saved && inDb && area !== undefined && (
        <p className="small zip-area">{area && area.voters >= AREA_MIN
          ? <>{area.voters.toLocaleString('en-US')} players in {s.name} have saved a ZIP with their votes.{top && topName ? <> Their most-supported card: {topName} ({Math.round((top[1].support / (top[1].support + top[1].oppose)) * 100)}% support).</> : null}</>
          : <>Once {AREA_MIN} or more players in {s.name} save a ZIP, how they voted shows up here.</>}</p>
      )}
      {(picker || !isZip(zip)) && (
        <details className="zip-picker" open={picker || undefined}>
          <summary className="small">Rather not use a ZIP? Pick a state instead</summary>
          <div className="field" style={{ maxWidth: 320 }}><label htmlFor="try-st">Your state</label>
            <select id="try-st" className="select" value={s.abbr} onChange={(e) => setAbbr(e.target.value)}>{states.map((x) => <option key={x.abbr} value={x.abbr}>{x.name}</option>)}</select>
          </div>
        </details>
      )}
      <div className="sim-gauge-row">
        <Dial value={(s.perCapita / nat.perCapita) * 100} max={250} label={`Federal awards per person in ${s.name}, compared with the national average`} readout={`${dollars(s.perCapita)} a person`}
          zones={[{ to: 85, label: 'below average', short: 'below', tone: 's1' }, { to: 115, label: 'near average', short: 'near', tone: 's2' }, { to: 250, label: 'above average', short: 'above', tone: 's3' }]} note={`${Math.round((s.perCapita / nat.perCapita) * 100)}% of the national ${dollars(nat.perCapita)}`} />
        <Stat label={`Federal awards to ${s.name}, FY${geo.fy}`} value={money(s.total)} note={`${dollars(s.perCapita)} per person, vs. ${dollars(nat.perCapita)} nationally`} />
      </div>
      <div>
        <div>
          <div className="stat-label" style={{ marginBottom: 6 }}>Biggest programs</div>
          <BarList items={s.programs.slice(0, 4).map((p) => ({ id: p.code, label: p.name, value: p.amount, color: 'var(--c-medicare)' }))} />
        </div>
      </div>
      <p className="small muted">Medicare ({money(nat.medicare)} nationally) is left out because USAspending.gov records it where insurers and claims processors are based. <a href={'#state-' + s.abbr.toLowerCase()}>See every district in {s.name}</a>.</p>
    </div>
  );
}

// ---------- levels ----------
const lawReduce = laws.find((l) => l.id === 'fra-2023') ?? laws.find((l) => l.deficitEffect < 0)!;
const lawUp = laws.filter((l) => l.deficitEffect > 0).sort((a, b) => b.deficitEffect - a.deficitEffect);
const lawChoices = [lawUp.find((l) => l.id === 'cares-act-2020') ?? lawUp[0], lawReduce, lawUp.find((l) => l.id === 'tcja-2017') ?? lawUp[1]];
const top7ids = [...laws].sort((a, b) => Math.abs(b.deficitEffect) - Math.abs(a.deficitEffect)).slice(0, 7).map((l) => l.id);
const totalCRs = process.years.reduce((a, y) => a + y.crs, 0);
const topProgramCounts = (() => {
  const c: Record<string, number> = {};
  for (const s of geo.states) if (s.programs[0]) c[s.programs[0].name] = (c[s.programs[0].name] ?? 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
})();
const topProgram = topProgramCounts[0]?.[0] ?? 'Social Security Retirement Insurance';
const interestBeatsDefense = cat('interest') > cat('defense');
const mixChoices = [{ value: 'taxes', label: 'Mostly tax increases' }, { value: 'even', label: 'An even mix of taxes and cuts' }, { value: 'cuts', label: 'Mostly spending cuts' }];

const CHAPTERS: Level[] = [
  {
    id: 'level-1', n: 1, title: 'Uncle Sam’s paycheck', topic: 'Where the money comes from', difficulty: 'Easy', minutes: 4, icon: 'paycheck', badge: 'Revenue basics',
    steps: [
      { id: 'meet', label: 'Meet Uncle Sam', kind: 'story', mood: 'happy', sam: <>Howdy, I’m Uncle Sam. I’m a regular guy with a very big household: {people(POP)} of you. Like plenty of families, I spend more than I bring in, and I could use your help sorting it out. Let’s start with a game about my paycheck: three rounds, up to a hundred points each.</> },
      { id: 'game', label: 'Fill the piggy bank', kind: 'game', game: {
        id: 'g-paycheck', title: 'Fill the piggy bank', goal: 'Guess where Uncle Sam’s money comes from, and where the taxes on your paycheck go.',
        rounds: [
          { kind: 'estimate', id: 'take', label: 'The whole paycheck', sam: <>Round one: the big number. How much did I bring in last year?</>, quiz: { id: 'g1take', question: `How much did Uncle Sam take in during FY${FY}?`, choices: [moneyWords(T.receipts)], correct: 0,
            estimate: { min: 1e12, max: 10e12, step: 0.05e12, start: 3e12, answer: T.receipts, spot: 0.05, close: 0.15, relative: true, format: (v) => moneyWords(v), diff: (d) => moneyWords(d), prompt: 'Drag to the total' },
            explain: <>{moneyWords(T.receipts)}, about {dollars(T.receipts / POP)} for every person in the country.</> } },
          { kind: 'split', id: 'split', label: 'Split the $100', sam: <>Round two. Out of every hundred dollars I take in, how much comes from each source?</>, quiz: {
        id: 'l1q1', question: 'Of every $100 Uncle Sam takes in, how much comes from each source?',
        choices: [`about $${SPLIT_ANSWER[0]} from income taxes, $${SPLIT_ANSWER[1]} from payroll taxes, $${SPLIT_ANSWER[2]} from corporate taxes, and $${SPLIT_ANSWER[3]} from everything else`], correct: 0, split: SPLIT,
        explain: <>{REVENUE_BY_ID[REC[0].id].label} brought in {money(REC[0].amount)}, {pct(REC[0].amount / REC_TOTAL, 0)} of all revenue in FY{FY}. Add payroll taxes and {pct(EARN / REC_TOTAL, 0)} of the money comes from taxes on what people earn.</> } },
          { kind: 'sort', id: 'stub', label: 'Your pay stub', sam: <>Last round: the taxes on your pay stub. Send each one where it really goes.</>, quiz: STUB },
        ] } },
      { id: 'you', label: 'Your share', kind: 'try', mood: 'happy', sam: <>Now your part. Slide to your salary, and I’ll print your own tax receipt.</>, body: () => <TaxTry /> },
      { id: 'vote', label: 'Your vote', kind: 'vote', mood: 'thinking', sam: <>This year, the Social Security tax stops at {dollars(tax.ssWageBase)} of wages. Here’s an idea CBO has priced.</>, vote: { kind: 'option', optionId: 'ss-tax-earnings-over-250k' } },

    ],
    takeaways: [`About ${pct(EARN / REC_TOTAL, 0)} of federal revenue comes from taxes on what people earn.`, 'Payroll taxes are set aside for Social Security and Medicare; income taxes go into the general fund.', `For every dollar spent in FY${FY}, about ${Math.round(BORROWED * 100)} cents was borrowed.`],
    shareFact: `For every dollar Uncle Sam spent in FY${FY}, about ${Math.round(BORROWED * 100)} cents was borrowed.`,
    deepDive: [{ route: 'revenue', label: 'Where it comes from' }, { route: 'receipt', label: 'Your tax receipt' }],
    sources: ['mts9', 'mts4', 'irs-rp2532', 'irs-p15'],
  },
  {
    id: 'level-2', n: 2, title: 'Uncle Sam’s bills', topic: 'Where the money goes', difficulty: 'Easy', minutes: 5, icon: 'bills', badge: 'Spending basics',
    steps: [
      { id: 'intro', label: 'The bills', kind: 'story', mood: 'thinking', sam: <>Now the bills. I spent {moneyWords(T.outlays)} last year. That’s about {money(T.outlays / 365)} a day, or {dollars(T.outlays / HH)} for every household. Let’s see how well you know them.</> },
      { id: 'game', label: 'Size the bills', kind: 'game', game: {
        id: 'g-bills', title: 'Size the bills', goal: 'Size up Uncle Sam’s biggest bills, pick the bigger of two, and find the share Congress votes on.',
        rounds: [
          { kind: 'sizes', id: 'sizes', label: 'The four biggest', sam: <>Round one. Here are my four biggest bills. Drag each one to how big you think it is.</>, quiz: {
        id: 'l2q1', question: `Uncle Sam’s four biggest bills: how much did each cost in FY${FY}?`,
        choices: [`Social Security, the biggest, at ${moneyWords(cat('ss'))}`], correct: 0, sizes: BILLS,
        explain: <>Social Security paid out {money(cat('ss'))} in FY{FY}, about {pct(cat('ss') / T.outlays, 0)} of all spending, to roughly {ssa.beneficiaries ? people(ssa.beneficiaries.total) : '71 million'} people. Then Medicare ({money(cat('medicare'))}), interest on the debt ({money(cat('interest'))}), and defense ({money(cat('defense'))}).</> } },
          { kind: 'custom', id: 'pairs', label: 'Which is bigger?', sam: <>Round two, quick fire. Two bills at a time: tap the bigger one.</>, play: ({ done, intro }) => <PairsRound pairs={PAIRS} intro={intro} done={done} format={(v) => money(v)} prompt={`Which cost more in FY${FY}?`} /> },
          { kind: 'estimate', id: 'share', label: 'Congress’s share', sam: <>Last round. Most of my bills are on autopilot. What share of my spending does Congress vote on each year?</>, quiz: { id: 'l2q2', question: 'What share of spending does Congress vote on each year?', choices: [`about ${Math.round(DISC_SHARE)} percent`], correct: 0,
            estimate: { min: 0, max: 100, step: 1, start: 50, answer: DISC_SHARE, spot: 3, close: 8, format: (v) => `${Math.round(v)}%`, diff: (d) => `${Math.round(d)} points`, prompt: 'Drag to the share' },
            explain: <>Discretionary spending, the part set in the 12 yearly appropriations bills, was {pct(BUCKET.y.discretionary / BUCKET.y.outlays, 0)} of spending in FY{BUCKET.y.fy}; {pct(BUCKET.y.defense / BUCKET.y.discretionary, 0)} of it was defense. The rest runs on permanent law, like Social Security and Medicare, or is interest.</> } },
        ] } },
      { id: 'every100', label: 'Every $100', kind: 'facts', mood: 'thinking', sam: <>Here’s where every $100 went. Point at a row to light it up.</>, body: () => <WaffleBlock /> },
      { id: 'vote', label: 'Your vote', kind: 'vote', mood: 'thinking', sam: <>Defense is the biggest bill Congress votes on every year. Here’s one option CBO priced.</>, vote: { kind: 'option', optionId: 'cut-defense-budget' } },

    ],
    takeaways: [`Social Security is the biggest program: about $${Math.round((cat('ss') / CATS.reduce((s, c) => s + c.amount, 0)) * 100)} of every $100.`, `Only about ${pct(BUCKET.y.discretionary / BUCKET.y.outlays, 0)} of spending is voted on each year.`, interestBeatsDefense ? 'Interest on the debt now costs more than national defense.' : 'Interest on the debt is approaching what defense costs.'],
    shareFact: `Uncle Sam spends about ${moneyWords(T.outlays / 365, 1)} a day.`,
    deepDive: [{ route: 'overview', label: 'The big picture' }, { route: 'spending', label: 'Where it goes' }],
    sources: ['mts9', 'mts5', 'omb-hist'],
  },
  {
    id: 'level-3', n: 3, title: 'Back home', topic: 'Federal money in your state', difficulty: 'Easy', minutes: 5, icon: 'home', badge: 'Federal money at home',
    steps: [
      { id: 'intro', label: 'Neighbors', kind: 'story', mood: 'happy', sam: <>A lot of what I spend ends up right in your neighborhood: Social Security checks, Medicaid, highways, schools, and military bases. Let’s play higher or lower with the states.</> },
      { id: 'game', label: 'Higher or lower', kind: 'game', game: {
        id: 'g-home', title: 'Higher or lower', goal: 'Guess which states get more federal money per person than the national average.',
        rounds: [
          { kind: 'custom', id: 'hilo', label: 'Higher or lower', sam: <>Here’s how it works. I name a state; you tell me if it gets more or less federal money per person than the national average.</>, play: ({ done, intro }) => <HigherLowerRound items={HILO} avg={geo.national.perCapita} intro={intro} done={done} format={(v) => dollars(v)} unit="a person" prompt={(name) => `Federal awards per person in ${name}: more or less than the national average?`} /> },
          { kind: 'choice', id: 'top', label: 'Bonus round', sam: <>Bonus round, for up to a hundred more points.</>, quiz: {
        id: 'l3q1', question: 'Which federal program sends the most money to the most states?',
        choices: [topProgram === 'Grants to States for Medicaid' ? 'Highway Planning and Construction' : 'Grants to States for Medicaid', topProgram, 'Federal Pell Grant Program'], correct: 1,
        explain: <>{topProgram} is the biggest federal program in {topProgramCounts[0]?.[1] ?? 'most'} of {geo.states.length} states and territories in FY{geo.fy} (not counting Medicare).</> } },
        ] } },
      { id: 'state', label: 'Your state', kind: 'try', mood: 'proud', sam: <>Type your ZIP code and I’ll find your state. These are federal grants, contracts, and payments recorded for FY{geo.fy}; the needle shows how your state compares, per person, with the whole country. Saving your ZIP with your votes is up to you.</>, body: () => <StateTry /> },
      { id: 'county', label: 'Your county', kind: 'try', mood: 'thinking', sam: <>Now the other side of the ledger: taxes. Here’s who paid federal income tax in your county, by income, on 2023 tax returns, next to the whole country.</>, body: () => <CountyTry /> },
      { id: 'vote', label: 'Your vote', kind: 'vote', mood: 'thinking', sam: <>States count on federal grants for roads, transit, and schools. Here’s a cut CBO has priced.</>, vote: { kind: 'option', optionId: 'cut-transport-education-grants' } },

    ],
    takeaways: [`Federal awards averaged ${dollars(geo.national.perCapita)} per person in FY${geo.fy}, not counting Medicare.`, `${topProgram} is the largest program in most states.`, 'Defense contracts and national labs make some states rank high per person.'],
    shareFact: `Federal awards averaged ${dollars(geo.national.perCapita)} per person in FY${geo.fy}, not counting Medicare.`,
    deepDive: [{ route: 'state', label: 'Your state & district' }],
    sources: ['usaspending-geo', 'usaspending-cat'],
  },
  {
    id: 'level-4', n: 4, title: 'Spending more than I make', topic: 'Deficits and the structural gap', difficulty: 'Medium', minutes: 5, icon: 'gap', badge: 'Deficits',
    steps: [
      { id: 'intro', label: 'The problem', kind: 'story', mood: 'worried', sam: <>Here’s my real problem. It isn’t one bad month. Last year the gap was {moneyWords(T.deficit)}, and it’s been a long time since I took in more than I spent.</> },
      { id: 'game', label: 'Fill the tank', kind: 'game', game: {
        id: 'g-gap', title: 'Fill the tank', goal: 'Guess the last surplus, pour the bills on autopilot in first, and see what spills over.',
        rounds: [
          { kind: 'estimate', id: 'surplus', label: 'The last surplus', sam: <>Round one. When did I last take in more than I spent?</>, quiz: {
        id: 'l4q1', question: 'When did Uncle Sam last take in more than he spent?',
        choices: [`FY${LAST_SURPLUS}`], correct: 0,
        estimate: { min: 1962, max: FY, step: 1, start: 1985, answer: LAST_SURPLUS, spot: 0, close: 3, format: (v) => `FY${v}`, diff: (d) => `${d} year${d === 1 ? '' : 's'}`, prompt: 'Drag to the year' },
        explain: <>FY{LAST_SURPLUS} was the last surplus. Deficits jumped in the 2008–09 financial crisis and the pandemic, and have stayed large since.</> } },
          { kind: 'custom', id: 'tank', label: 'Fill the tank', sam: <>Round two. Everything I take in fits in this tank. Pour in the bills on autopilot first, then the ones Congress votes on. Watch what happens when it fills up.</>, play: ({ done, intro }) => <RevenueTank game={{ done }} /> },
          { kind: 'choice', id: 'share', label: 'Bonus round', sam: <>Bonus round.</>, quiz: {
        id: 'l4q2', question: `In FY${BUCKET.y.fy}, how much of all revenue did mandatory programs plus interest use up?`,
        choices: ['About a quarter', 'About half', `About ${Math.round(MI_SHARE * 100)}%`], correct: 2,
        explain: <>Mandatory programs and interest cost {money(BUCKET.y.mandatory + BUCKET.y.netInterest)} against {money(BUCKET.y.revenues)} of revenue, {pct(MI_SHARE, 0)}. That left almost nothing for defense and everything else Congress votes on, so those were mostly borrowed.</> } },
        ] } },
      { id: 'vote', label: 'Your vote', kind: 'vote', mood: 'thinking', sam: <>When it’s time to close the gap, folks disagree on how. What do you think should do most of the work?</>,
        vote: { kind: 'issue', id: 'mix', question: 'What should do most of the work in closing the gap?', choices: mixChoices, context: (
          <>CBO’s estimates suggest tax increases on higher earners slow the economy less in the short run than spending cuts. An IMF study of past deficit cuts found tax-based cuts slowed growth more. Economists disagree. {principle('multipliers') && <a href={principle('multipliers')!.source.url} target="_blank" rel="noreferrer">CBO</a>}{principle('composition') && <> · <a href={principle('composition')!.source.url} target="_blank" rel="noreferrer">IMF</a></>}</>
        ) } },

    ],
    takeaways: [`The government last ran a surplus in FY${LAST_SURPLUS}.`, `In FY${BUCKET.y.fy}, mandatory programs plus interest used ${pct(MI_SHARE, 0)} of all revenue.`, 'A deficit that persists in good times is called structural.'],
    shareFact: `Uncle Sam’s deficit in FY${FY} was ${moneyWords(T.deficit, 2)}, about ${dollars(T.deficit / HH)} for every household.`,
    deepDive: [{ route: 'gap', label: 'Deficits & the structural gap' }],
    sources: ['omb-hist', 'mts9'],
    links: ['multipliers', 'composition'].map((id) => principle(id)).filter(Boolean).map((p) => ({ title: p!.source.title, url: p!.source.url })),
  },
  {
    id: 'level-6', n: 6, title: 'The credit card', topic: 'Debt and interest', difficulty: 'Medium', minutes: 5, icon: 'card', badge: 'Debt and interest',
    steps: [
      { id: 'intro', label: 'The balance', kind: 'story', mood: 'worried', sam: <>All that borrowing goes on the card. My total debt was {money(D.total)} on {dateLabel(D.date)}. That’s about {dollars(D.total / HH)} per household.</> },
      { id: 'game', label: 'Rate shock', kind: 'game', game: {
        id: 'g-card', title: 'Rate shock', goal: 'Size the interest bill, then find the rate where it overtakes defense.',
        rounds: [
          { kind: 'estimate', id: 'bill', label: 'The interest bill', sam: <>Round one. Defense is one of my biggest bills. How does interest compare?</>, quiz: {
        id: 'l5q1', question: `National defense cost ${money(cat('defense'))} in FY${FY}. What did interest on the debt cost?`,
        choices: [money(cat('interest'))], correct: 0,
        estimate: { min: 200e9, max: 2000e9, step: 10e9, start: Math.round(cat('defense') / 1e10) * 1e10, answer: cat('interest'), spot: 0.05, close: 0.15, relative: true, format: (v) => money(v), diff: (d) => money(d), prompt: 'Drag to the interest bill', marks: [{ at: cat('defense'), label: 'defense' }] },
        explain: <>Net interest was {money(cat('interest'))} and national defense was {money(cat('defense'))} in FY{FY}.</> } },
          { kind: 'custom', id: 'cross', label: 'The crossover', sam: <>Round two. Slide the interest rate and stop it right where interest catches up with defense. Watch the bars.</>, play: ({ done, intro }) => <InterestRateSim defense={cat('defense')} medicare={cat('medicare')} fy={FY} game={{ done }} /> },
          { kind: 'choice', id: 'why', label: 'Bonus round', sam: <>Bonus round.</>, quiz: {
        id: 'l5q2', question: 'Why is Uncle Sam’s interest bill climbing?',
        choices: ['The Treasury raised the rate on bonds it already sold', 'Old low-rate debt is being replaced with new debt at higher rates, and the debt keeps growing', 'Interest depends only on this year’s deficit'], correct: 1,
        explain: <>Treasury bonds keep the rate they were sold at. As older, cheaper debt matures, it is refinanced at today’s higher rates, and new borrowing adds to the total. That is why interest grows even in years when the deficit doesn’t.</> } },
        ] } },
      { id: 'who', label: 'Who I owe', kind: 'facts', mood: 'thinking', sam: <>Most of it I owe to investors, banks, other countries, and the Federal Reserve. The rest I owe to my own trust funds, like Social Security.</>,
        body: () => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SegBar label="Total public debt by holder" parts={[{ label: 'Debt held by the public', value: D.public, color: 'var(--c-emph)', ink: 'var(--accent-ink)' }, { label: 'Owed to federal trust funds', value: D.intragov, color: 'var(--c-deemph)', ink: 'var(--ink)' }]} />
            <Legend items={[{ label: `Held by the public · ${money(D.public)}`, color: 'var(--c-emph)' }, { label: `Owed to federal trust funds · ${money(D.intragov)}`, color: 'var(--c-deemph)' }]} />
            <ChartFrame title="What each fiscal year added to the debt" sourceIds={['debtHist']}>
              <TimeChart label="Annual change in total public debt" x={debt.byFY.filter((r) => r.fy >= 2007).map((r) => r.fy)} height={200} zeroLine tipTitle={(y) => `FY${y}`}
                series={[{ id: 'c', label: 'Added to the debt', color: 'var(--c-interest)', kind: 'bar', values: debt.byFY.filter((r) => r.fy >= 2007).map((r) => r.change) }]} />
            </ChartFrame>
          </div>
        ) },
      { id: 'vote', label: 'Your vote', kind: 'vote', mood: 'thinking', sam: <>So, how hard should I work to pay this down? Pick the goal you think Congress should aim for over the next five years.</>,
        vote: { kind: 'issue', id: 'goal', question: 'What should Congress aim for over the next five years?', choices: [
          { value: 'stabilize', label: 'Stop the debt from outgrowing the economy' },
          { value: 'deficit3', label: 'Cut the deficit to 3% of GDP' },
          { value: 'balance', label: 'Balance the budget' },
          { value: 'other', label: 'Focus on other priorities for now' },
        ], context: <>{principle('debt-stabilize')?.claim} {principle('debt-stabilize') && <a href={principle('debt-stabilize')!.source.url} target="_blank" rel="noreferrer">CBO</a>}</> } },

    ],
    takeaways: [`The debt was ${money(D.total)}, about ${dollars(D.total / HH)} per household.`, interestBeatsDefense ? `Interest (${money(cat('interest'))}) now costs more than defense (${money(cat('defense'))}).` : 'Interest is approaching what defense costs.', 'Refinancing old low-rate debt at higher rates pushes interest up.'],
    shareFact: `The national debt is ${moneyWords(D.total, 1)}, about ${dollars(D.total / HH)} for every household.`,
    deepDive: [{ route: 'debt', label: 'Debt & interest' }],
    sources: ['penny', 'debtHist', 'rates', 'mts9'],
  },
  {
    id: 'level-7', n: 7, title: 'Who writes my budget?', topic: 'How Congress budgets, and the laws that moved the needle', difficulty: 'Medium', minutes: 7, icon: 'capitol', badge: 'The budget process',
    steps: [
      { id: 'intro', label: 'Kitchen table', kind: 'story', mood: 'thinking', sam: <>In my house we sit down at the kitchen table once a year and plan. Congress is supposed to do the same, with a deadline of October 1. Let’s see how that’s going.</> },
      { id: 'game', label: 'Beat the deadline', kind: 'game', game: {
        id: 'g-process', title: 'Beat the deadline', goal: 'Guess the last on-time year, put the budget calendar in order, and see what happens on October 1.',
        rounds: [
          { kind: 'estimate', id: 'ontime', label: 'The last on-time year', sam: <>Round one. When did Congress last get all of its spending bills done on time?</>, quiz: {
        id: 'l6q1', question: 'When did Congress last pass all of its regular spending bills on time?',
        choices: [`FY${process.lastAllOnTime?.fy ?? 1997}`], correct: 0,
        estimate: { min: 1977, max: FY, step: 1, start: 2010, answer: process.lastAllOnTime?.fy ?? 1997, spot: 0, close: 3, format: (v) => `FY${v}`, diff: (d) => `${d} year${d === 1 ? '' : 's'}`, prompt: 'Drag to the year' },
        explain: <>{process.lastAllOnTime?.note ?? 'All regular bills were last enacted on time in FY1997.'}</> } },
          { kind: 'custom', id: 'calendar', label: 'The calendar', sam: <>Round two. On paper it’s orderly. Put my budget calendar in order. Then see what happens when the deadline comes and the bills aren’t done.</>, play: ({ done, intro }) => <OrderRound items={BUDGET_CALENDAR.map((c) => ({ id: c.id, label: c.what, detail: c.when }))} start={['bills', 'pres', 'oct', 'res']} intro={intro} done={done} prompt="Put the budget calendar in order." after={<OctoberChoice />} /> },
          { kind: 'choice', id: 'law', label: 'Bonus round', sam: <>Bonus round. Deficits are written into law.</>, quiz: {
        id: 'l6q2', question: 'Which of these laws was officially estimated to reduce deficits?',
        choices: lawChoices.map((l) => `${l.name} (${l.signed.slice(0, 4)})`), correct: 1,
        explain: <>{lawReduce.name} was estimated to cut deficits by {money(Math.abs(lawReduce.deficitEffect) * 1e9)} over {lawReduce.window}. {lawChoices[0].shortName} and {lawChoices[2].shortName} were estimated to add {money(lawChoices[0].deficitEffect * 1e9)} and {money(lawChoices[2].deficitEffect * 1e9)}.</> } },
        ] } },
      { id: 'laws', label: 'Laws that moved it', kind: 'facts', mood: 'surprised', sam: <>Deficits are written into law. Here are the biggest laws of the past 25 years. Tap one to see what it did.</>,
        body: () => <LawExplorer /> },
      { id: 'vote', label: 'Your vote', kind: 'vote', mood: 'thinking', sam: <>Shutdowns are hard on everyone. One fix lawmakers have proposed is an automatic stopgap. Where do you stand?</>,
        vote: { kind: 'issue', id: 'auto-cr', question: 'Should Congress adopt an automatic continuing resolution?', choices: [{ value: 'support', label: 'Support' }, { value: 'oppose', label: 'Oppose' }, { value: 'unsure', label: 'Not sure' }], context: (
          <>If Congress missed the October 1 deadline, agencies would keep running at about last year’s funding until new bills passed, so shutdowns would not happen. Supporters say it protects workers and services. Critics say it takes pressure off Congress to finish on time and locks in last year’s priorities. <a href="https://www.congress.gov/crs_external_products/R/PDF/R41948/R41948.13.pdf" target="_blank" rel="noreferrer">CRS overview of proposals</a></>
        ) } },

    ],
    takeaways: [`Congress passed ${totalCRs} continuing resolutions for FY${process.years[0].fy}–FY${process.years.at(-1)!.fy}.`, `All regular spending bills were last on time in FY${process.lastAllOnTime?.fy ?? 1997}.`, 'Tax cuts, emergency packages, and spending increases from both parties added trillions to projected deficits.'],
    shareFact: `Congress passed ${totalCRs} stopgap funding bills (continuing resolutions) for FY${process.years[0].fy}–FY${process.years.at(-1)!.fy}.`,
    deepDive: [{ route: 'process', label: 'How Congress budgets' }, { route: 'laws', label: 'Laws that moved the needle' }],
    sources: ['cbo-options-2024'],
    links: [...process.sources, ...laws.filter((l) => top7ids.includes(l.id)).map((l) => l.source)].filter((x) => x.url),
  },
  {
    id: 'level-9', n: 9, title: 'Keeping my promises', topic: 'Social Security’s future', difficulty: 'Medium', minutes: 6, icon: 'shield', badge: 'Social Security',
    steps: [
      { id: 'intro', label: 'A promise', kind: 'story', mood: 'proud', sam: <>I made a promise to the folks who worked their whole lives. Social Security pays about {ssa.beneficiaries ? people(ssa.beneficiaries.total) : '71 million'} people. But its savings are running down.</> },
      { id: 'game', label: 'Close the gap', kind: 'game', game: {
        id: 'g-ss', title: 'Close the gap', goal: 'Guess what can still be paid, then close Social Security’s 75-year gap, now and after waiting.',
        rounds: [
          { kind: 'estimate', id: 'payable', label: 'What’s still paid', sam: <>Round one. When the retirement fund runs out, the checks don’t stop. How much can still be paid?</>, quiz: {
        id: 'l7q1', question: `When the retirement fund runs out in late ${ssa.depletion.oasi.year}, what share of scheduled benefits can still be paid?`,
        choices: [`about ${ssa.depletion.oasi.payablePct}%`], correct: 0,
        estimate: { min: 0, max: 100, step: 1, start: 50, answer: ssa.depletion.oasi.payablePct, spot: 2, close: 8, format: (v) => `${v}%`, diff: (d) => `${d} points`, prompt: 'Drag to the share still paid' },
        explain: <>Benefits don’t stop. By law they can be paid only from incoming taxes, which would cover about {ssa.depletion.oasi.payablePct}% of scheduled retirement and survivor benefits, unless Congress acts first.</> } },
          { kind: 'custom', id: 'now', label: 'Close it now', sam: <>Round two. The trustees name two fixes: a higher payroll tax, or smaller checks. Mix them any way you like, and close the gap exactly.</>, play: ({ done, intro }) => <SsMixer late={false} game={{ done }} /> },
          { kind: 'custom', id: 'late', label: 'Close it late', sam: <>Round three. Now Congress waits until 2034 to act. Close the gap again, and see how much bigger the fix gets.</>, play: ({ done, intro }) => <SsMixer late game={{ done }} /> },
          { kind: 'choice', id: 'fix', label: 'Bonus round', sam: <>Bonus round.</>, quiz: {
        id: 'l7q2', question: 'According to the trustees, which single change made now would close Social Security’s 75-year gap?',
        choices: ['Raise the payroll tax from 12.4% to 13%', 'Cut all benefits by 5%', `Raise the payroll tax from 12.4% to ${ssa.fixes?.[0]?.value ?? '16.65%'}`], correct: 2,
        explain: <>The trustees estimate the gap at {ssa.actuarialDeficit?.toFixed(2)}% of taxable payroll. Closing it right away would take a payroll tax of about {ssa.fixes?.[0]?.value ?? '16.65%'} or an across-the-board benefit cut of about {ssa.fixes?.[1]?.value.replace('−', '') ?? '25%'}. Waiting makes the changes bigger.</> } },
        ] } },
      { id: 'you', label: 'What it means for you', kind: 'try', mood: 'thinking', sam: <>Let’s make it personal. What year were you born?</>, body: () => <AgeTry /> },
      { id: 'vote', label: 'Your vote', kind: 'vote', mood: 'thinking', sam: <>Here’s one change CBO has priced. It would phase in slowly and not touch anyone already collecting.</>, vote: { kind: 'option', optionId: 'raise-full-retirement-age-70' } },

    ],
    takeaways: [`The retirement fund runs out in late ${ssa.depletion.oasi.year}; then about ${ssa.depletion.oasi.payablePct}% of benefits would be payable.`, 'Benefits would be cut automatically, not stopped.', `Closing the gap now would take a payroll tax of about ${ssa.fixes?.[0]?.value ?? '16.65%'} or a benefit cut of about ${ssa.fixes?.[1]?.value.replace('−', '') ?? '25%'}.`],
    shareFact: `Social Security paid out ${moneyWords(cat('ss'), 2)} in FY${FY}, about ${moneyWords(cat('ss') / 365, 1)} a day.`,
    deepDive: [{ route: 'social-security', label: 'Social Security’s future' }],
    sources: ['mts8', 'ssa-tr2026', 'ssa-facts', 'cms-tr2026'],
    links: [{ title: 'The 2026 Social Security Trustees Report (full report, PDF)', url: 'https://www.ssa.gov/oact/TR/2026/tr2026.pdf' }],
  },
];
/** Every chapter mission: the original seven, the concept missions before each budget desk, and the budget-process missions. */
export const LEVELS: Level[] = [...CHAPTERS, ...CONCEPT_LEVELS, ...PROCESS_LEVELS];

/** The budget desk levels: the hard "wall" levels where the player fixes the budget with real options. */
/** `hint`: the first desk level offers a hint (Uncle Sam points to one card, or to the next star). */
export interface DeskLevel { id: string; n: number; goal: 'stabilize' | 'deficit3' | 'balance'; title: string; topic: string; difficulty: Difficulty; minutes: number; icon: IconId; badge: string; hint?: boolean }
export const DESK: DeskLevel[] = [
  { id: 'level-5', n: 5, goal: 'stabilize', title: 'Stop the debt from outgrowing the economy', topic: 'Budget desk: fix the budget with real options CBO has priced', difficulty: 'Hard', minutes: 8, icon: 'gauge', badge: 'Debt stabilized', hint: true },
  { id: 'level-8', n: 8, goal: 'deficit3', title: 'Cut the deficit to 3% of GDP', topic: 'Budget desk: a bigger fix, with the same rules', difficulty: 'Hard', minutes: 8, icon: 'target', badge: 'Deficit tamed' },
  { id: 'level-10', n: 10, goal: 'balance', title: 'Balance the budget', topic: 'Budget desk: the final challenge, no borrowing at all', difficulty: 'Super hard', minutes: 10, icon: 'scale', badge: 'Budget balanced' },
];

/**
 * Three campaigns, each with one goal, built from missions that go from easy to hard and end at
 * the budget desk. A mission's `n` is its stable code (old links, rooms, previews and saved
 * progress use it); players see "Campaign 1 · Mission 5" instead.
 */
export interface Campaign { n: 1 | 2 | 3; goal: 'stabilize' | 'deficit3' | 'balance'; title: string; blurb: string; missions: string[] }
export const CAMPAIGNS: Campaign[] = [
  { n: 1, goal: 'stabilize', title: 'Stop the debt from outgrowing the economy', blurb: 'Learn where the money comes from and goes, how it gets spent, how a change hits the economy, and who it reaches. Then steady the debt.', missions: ['level-1', 'level-2', 'level-spend', 'level-3', 'level-4', 'level-economy', 'level-drag', 'level-fairness', 'level-5'] },
  { n: 2, goal: 'deficit3', title: 'Cut the deficit to 3% of GDP', blurb: 'Learn about the debt, who does what, how Congress budgets and the rules it plays by, what grows the economy, and why public investment is different. Then cut the deficit to a level the country can keep up.', missions: ['level-6', 'level-roles', 'level-7', 'level-rules', 'level-growth', 'level-investment', 'level-8'] },
  { n: 3, goal: 'balance', title: 'Balance the budget', blurb: 'Learn what Social Security’s future and the interest bill ask of the next generation, and the brakes built into the budget. Then try to balance the books.', missions: ['level-9', 'level-future', 'level-brakes', 'level-10'] },
];

/** Every mission in play order, chapters and budget desk alike. */
export interface Stop { id: string; n: number; kind: 'chapter' | 'desk'; title: string; topic: string; difficulty: Difficulty; minutes: number; icon: IconId; badge: string; quote: Quote; pos: number; campaign: 1 | 2 | 3; mission: number; of: number; final: boolean }
const RAW: Record<string, Omit<Stop, 'pos' | 'campaign' | 'mission' | 'of' | 'final'>> = Object.fromEntries([
  ...LEVELS.map((l) => [l.id, { id: l.id, n: l.n, kind: 'chapter' as const, title: l.title, topic: l.topic, difficulty: l.difficulty, minutes: l.minutes, icon: l.icon, badge: `${l.badge}: explained`, quote: QUOTES[l.id] }]),
  ...DESK.map((d) => [d.id, { id: d.id, n: d.n, kind: 'desk' as const, title: d.title, topic: d.topic, difficulty: d.difficulty, minutes: d.minutes, icon: d.icon, badge: d.badge, quote: QUOTES[d.id] }]),
]);
export const STOPS: Stop[] = CAMPAIGNS.flatMap((c) => c.missions.map((id, k) => ({ ...RAW[id], campaign: c.n, mission: k + 1, of: c.missions.length, final: k === c.missions.length - 1, pos: 0 }))).map((s, i) => ({ ...s, pos: i + 1 }));
export const STOP_BY_ID: Record<string, Stop> = Object.fromEntries(STOPS.map((s) => [s.id, s]));
export const ALL_STOPS = STOPS;
export const campaignOf = (id: string) => CAMPAIGNS[(STOP_BY_ID[id]?.campaign ?? 1) - 1];
/** The mission after this one, in play order (none after the last). */
export const nextOf = (id: string): Stop | undefined => STOPS[(STOP_BY_ID[id]?.pos ?? STOPS.length)];
export const prevOf = (id: string): Stop | undefined => { const p = STOP_BY_ID[id]?.pos ?? 1; return p > 1 ? STOPS[p - 2] : undefined; };
/** "Mission 1.5": the campaign, then the mission within it. */
export const missionShort = (s: Pick<Stop, 'campaign' | 'mission'>) => `Mission ${s.campaign}.${s.mission}`;
/** "Campaign 1 · Mission 5 of 8", or "Campaign 1 · Final mission". */
export const missionLong = (s: Pick<Stop, 'campaign' | 'mission' | 'of' | 'final'>) => `Campaign ${s.campaign} · ${s.final ? 'Final mission' : `Mission ${s.mission} of ${s.of}`}`;
/** A desk's stop, from its stable code (5, 8 or 10). */
export const stopForCode = (n: number) => STOPS.find((s) => s.n === n);

export function isUnlocked(id: string, done: string[], freeRoam: boolean) {
  if (freeRoam) return true;
  const s = STOP_BY_ID[id];
  if (!s) return true;
  // A mission played before the campaigns existed stays open.
  return s.pos === 1 || done.includes(id) || done.includes(STOPS[s.pos - 2].id);
}

export function unlockText(id: string) {
  const prev = prevOf(id);
  return prev ? `Finish ${missionShort(prev)} to unlock` : 'Open';
}

/** Stars for a chapter level: three for every question right on the first try. */
/** The quick checks that count toward a level's stars (guesses never do). */
export const checksOf = (level: Level) => level.steps.filter((s) => s.quiz && !s.quiz.guess).map((s) => s.quiz!);
/** Every question in a mission: its quiz steps, and the rounds of its game that are questions. */
export const quizzesOf = (level: Level): Quiz[] => level.steps.flatMap((s) => (s.quiz ? [s.quiz] : s.game ? s.game.rounds.flatMap((r) => (r.kind === 'custom' ? [] : [r.quiz])) : []));
/** A mission's game, if it has one. */
export const gameOf = (level: Level) => level.steps.find((s) => s.game)?.game;

/** Three stars for every quick check right on the first try; two for right on the second try (or half the points); otherwise one. */
export function chapterStars(level: Level, quiz: Record<string, { tries: number; correct: boolean }>) {
  const qs = checksOf(level).map((q) => quiz[q.id]);
  if (!qs.length) return 3;
  const points = qs.reduce((a, q) => a + (q?.correct ? (q.tries === 1 ? 2 : 1) : 0), 0);
  return points === qs.length * 2 ? 3 : points >= qs.length ? 2 : 1;
}

export function useLevel(id: string) {
  return useMemo(() => LEVELS.find((l) => l.id === id) ?? null, [id]);
}

export const sourcesFor = (ids: string[]) => ids.map(src).filter(Boolean);

/** Adviser titles earned along the road. */
export const RANKS = [
  { at: 0, name: 'New volunteer' },
  { at: 2, name: 'Budget aide' },
  { at: 5, name: 'Budget analyst' },
  { at: 11, name: 'Senior budget adviser' },
  { at: STOPS.length, name: 'Informed Budget Voter' },
];
export const rankFor = (n: number) => [...RANKS].reverse().find((r) => n >= r.at)!;
export const MAX_STARS = STOPS.length * 3;

/** Game chrome colors by difficulty: bold, high-contrast fills, read together with each level's icon. */
export const DIFF_COLOR: Record<Difficulty, string> = { Easy: '#128a4d', Medium: '#2467c4', Hard: '#c9302c', 'Super hard': '#5b45cc' };
export const diffKey = (d: Difficulty) => (d === 'Super hard' ? 'super' : d.toLowerCase());
