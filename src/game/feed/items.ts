import billsJson from '../../data/generated/bills.json';
import factsJson from '../../data/curated/facts.json';
import { cbo } from '../../data';
import { budget, debt, laws, glossary, POP } from '../../data';
import { CATEGORIES, REVENUE_BY_ID } from '../../lib/categories';
import { moneyWords, dollars } from '../../lib/format';
import { OPTIONS_DATA } from '../../lib/planData';
import type { PolicyOption } from '../../lib/plan';
import { DEADLINES, type Deadline } from '../daily';
import { gameOf, LEVELS, STOPS, quizzesOf, missionShort, type Quiz, type Stop } from '../levels';
import { FIELD_GUIDE } from '../nav';
import { mergeNews, type NewsItem } from '../news';

// The main menu's feed: everything the game knows, as posts. Official items first while they're
// fresh (bills with new CRS summaries, announcements, deadlines), then the evergreen ones: budget
// lessons, polls on the CBO's options, quick checks and lessons from the missions, words from the
// glossary, and the laws that moved the deficit. Every post carries its official source and date.

export type Topic = 'bills' | 'budget' | 'polls' | 'lessons' | 'facts' | 'news';
export const TOPICS: { id: Topic | 'all'; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'bills', label: 'Bills' }, { id: 'budget', label: 'Budget' },
  { id: 'polls', label: 'Polls' }, { id: 'lessons', label: 'Lessons' }, { id: 'facts', label: 'Fun facts' }, { id: 'news', label: 'News' },
];
/** How much a post asks: a glance, a tap, or a few minutes. The mix alternates them. */
export type Effort = 'passive' | 'interactive' | 'deep';

export interface Bill {
  id: string; label: string; title: string; area: string; status: string;
  latestAction: { date: string; text: string }; introduced: string;
  /** The sponsor; `display` is exactly as Congress.gov lists them, e.g. "Sen. Crapo, Mike [R-ID]". */
  sponsor: { name: string; party: string; state: string; display?: string; district?: number | null } | null; cosponsors: number;
  /** Floor votes from the official records (House Clerk, U.S. Senate), newest first. */
  votes?: FloorVote[];
  /** Passages with no roll call (voice vote, unanimous consent), from Congress.gov's actions, newest first. */
  floorNotes?: FloorNote[];
  summary: string; summaryCut?: boolean; summaryStage: string; summaryDate: string;
  cbo: { title: string; url: string; date: string } | null; url: string; updated: string; companion?: string;
}
/** One roll call: members are [name, party, state, vote] as the record lists them. */
export interface FloorVote {
  chamber: 'House' | 'Senate'; roll: number; date: string; question: string; result: string;
  totals: { yea: number; nay: number; present: number; notVoting: number }; url: string;
  members: [string, string, string, string][];
  /** A Senate tie broken by the Vice President (the counts above are senators only). */
  tieBreaker?: { by: string; vote: string };
}
export interface FloorNote { chamber: 'House' | 'Senate'; date: string; how: 'voice vote' | 'unanimous consent' | 'without objection'; text: string }
export const BILLS = (billsJson as { fetchedAt: string; bills: Bill[] });

export interface Source { name: string; url?: string; date?: string }
/** A fun fact, or a dated event from budget history; `near` is set around its anniversary. */
export interface Fact { title: string; body: string; date?: string; year?: number; near?: 'today' | 'week'; big?: string }
interface Base { id: string; topic: Topic; effort: Effort; title: string; source: Source; /** Where Save sends you back to. */ href: string; /** For the fresh section: when it happened (ISO). */ time?: string }
export interface Slice { label: string; value: number; color?: string }
export interface Stat {
  headline: string; value: string; caption: string;
  chart: { kind: 'donut' | 'bars'; data: Slice[]; unit: string; highlight?: string };
  slides: { title: string; body: string }[];
}

export type FeedItem =
  | (Base & { kind: 'bill'; bill: Bill })
  | (Base & { kind: 'news'; news: NewsItem })
  | (Base & { kind: 'deadline'; deadline: Deadline })
  | (Base & { kind: 'stat'; stat: Stat })
  | (Base & { kind: 'poll'; option: PolicyOption })
  | (Base & { kind: 'check'; quiz: Quiz; stop: Stop })
  | (Base & { kind: 'tutorial'; stop: Stop; steps: string[]; takeaways: string[] })
  | (Base & { kind: 'quick'; stop: Stop; game: { title: string; goal: string; rounds: number } })
  | (Base & { kind: 'chapter'; route: string; label: string; blurb: string })
  | (Base & { kind: 'term'; term: { id: string; term: string; def: string } })
  | (Base & { kind: 'law'; law: (typeof laws)[number] })
  | (Base & { kind: 'fact'; fact: Fact })
  | (Base & { kind: 'daily' });

/** Breaks in the stream: a row of topics or missions to swipe, and the "caught up" line. */
export type FeedRow =
  | { kind: 'item'; item: FeedItem }
  | { kind: 'caughtup'; id: string; fresh: number }
  | { kind: 'carousel'; id: string; title: string; items: FeedItem[] };

const MTS = { name: 'U.S. Treasury, Monthly Treasury Statement', url: 'https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/', date: budget.mtsLatestDate };
const FY = budget.latestFY;
const billions = (v: number) => v / 1e9;

// ---- Budget lessons: a number, a small chart, three cards to swipe. All from the data the game uses.

function statSpending(): Stat {
  const by: Record<string, number> = {};
  for (const f of budget.functionsByFY[String(FY)] ?? []) by[f.category] = (by[f.category] ?? 0) + f.amount;
  const total = Object.values(by).reduce((a, b) => a + b, 0);
  const data: Slice[] = [...CATEGORIES.map((c) => ({ label: c.short, value: billions(by[c.id] ?? 0), color: c.color })), { label: 'Interest', value: billions(by.interest ?? 0), color: 'var(--c-interest)' }].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const interest = by.interest ?? 0, defense = by.defense ?? 0;
  return {
    headline: interest > defense ? `Interest on the debt cost more than the military in FY${FY}` : `Where FY${FY}’s spending went`,
    value: moneyWords(interest, 2), caption: `net interest, against ${moneyWords(defense, 2)} for defense`,
    chart: { kind: 'donut', data, unit: 'billion', highlight: 'Interest' },
    slides: [
      { title: 'The biggest piece', body: `Social Security: ${moneyWords(by.ss ?? 0, 2)}, about ${Math.round(((by.ss ?? 0) / total) * 100)}¢ of every dollar spent.` },
      { title: 'Health care, together', body: `Medicare and Medicaid with other health programs: ${moneyWords((by.medicare ?? 0) + (by.health ?? 0), 2)}.` },
      { title: 'Interest', body: `${moneyWords(interest, 2)} went to interest on the debt the public holds, after interest the government earns. It buys no program; it pays for past borrowing.` },
    ],
  };
}

function statRevenue(): Stat {
  const r = budget.receiptsByFY[String(FY)] ?? [];
  const total = r.reduce((a, b) => a + b.amount, 0);
  const get = (id: string) => r.find((x) => x.id === id)?.amount ?? 0;
  const names: Record<string, string> = { individual: 'Income taxes', payroll: 'Payroll taxes', corporate: 'Corporate taxes', customs: 'Tariffs', excise: 'Excise taxes', estate: 'Estate & gift', misc: 'Other' };
  return {
    headline: `Where FY${FY}’s money came from`,
    value: `${Math.round(((get('individual') + get('payroll')) / total) * 100)}%`, caption: 'came from individuals’ income and payroll taxes',
    chart: { kind: 'donut', data: r.map((x) => ({ label: names[x.id] ?? x.name, value: billions(x.amount), color: REVENUE_BY_ID[x.id as keyof typeof REVENUE_BY_ID]?.color })).sort((a, b) => b.value - a.value), unit: 'billion', highlight: 'Income taxes' },
    slides: [
      { title: 'Income taxes', body: `${moneyWords(get('individual'), 2)}: the largest single source.` },
      { title: 'Payroll taxes', body: `${moneyWords(get('payroll'), 2)}, mostly set aside for Social Security and Medicare.` },
      { title: 'Corporations and tariffs', body: `Corporate income taxes brought ${moneyWords(get('corporate'), 2)}; customs duties, ${moneyWords(get('customs'), 2)}.` },
    ],
  };
}

function statDeficits(): Stat {
  const a = budget.annual.slice(-10);
  const last = a.at(-1)!;
  const peak = a.reduce((m, x) => (x.deficit > m.deficit ? x : m), a[0]);
  return {
    headline: `The deficit, the last ${a.length} years`,
    value: moneyWords(last.deficit, 2), caption: `in FY${last.fy}: spending minus revenue`,
    chart: { kind: 'bars', data: a.map((x) => ({ label: `’${String(x.fy).slice(2)}`, value: billions(x.deficit) })), unit: 'billion', highlight: `’${String(last.fy).slice(2)}` },
    slides: [
      { title: 'The peak', body: `FY${peak.fy}: ${moneyWords(peak.deficit, 2)}, in the pandemic’s first year.` },
      { title: 'Last year', body: `FY${last.fy}: ${moneyWords(last.outlays, 2)} spent, ${moneyWords(last.receipts, 2)} taken in.` },
      { title: 'Why it matters', body: 'Every year’s deficit is borrowed, and adds to the debt that interest is paid on.' },
    ],
  };
}

function statInterest(): Stat {
  const s = debt.interestByFY.slice(-8);
  const first = s[0], last = s.at(-1)!;
  return {
    headline: 'The interest bill keeps growing',
    value: `${(last.gross / first.gross).toFixed(1)}×`, caption: `gross interest, FY${first.fy} to FY${last.fy}`,
    chart: { kind: 'bars', data: s.map((x) => ({ label: `’${String(x.fy).slice(2)}`, value: billions(x.gross) })), unit: 'billion', highlight: `’${String(last.fy).slice(2)}` },
    slides: [
      { title: `FY${first.fy}`, body: `${moneyWords(first.gross, 2)} in gross interest on the debt.` },
      { title: `FY${last.fy}`, body: `${moneyWords(last.gross, 2)}: more debt, at higher rates.` },
      { title: 'Gross, not net', body: 'Gross interest includes what the Treasury pays its own trust funds; the budget’s net interest leaves that out.' },
    ],
  };
}

function statDebt(): Stat {
  const l = debt.latest;
  const yrs = debt.byFY.slice(-10);
  return {
    headline: 'The national debt, per person',
    value: dollars(l.total / POP), caption: `${moneyWords(l.total, 2)} on ${l.date}, shared by ${Math.round(POP / 1e6)} million people`,
    chart: { kind: 'bars', data: yrs.map((x) => ({ label: `’${String(x.fy).slice(2)}`, value: x.total / 1e12 })), unit: 'trillion', highlight: `’${String(yrs.at(-1)!.fy).slice(2)}` },
    slides: [
      { title: 'Held by the public', body: `${moneyWords(l.public, 2)}: owed to investors, here and abroad, and the Federal Reserve.` },
      { title: 'Owed to itself', body: `${moneyWords(l.intragov, 2)}: owed to government trust funds such as Social Security’s.` },
      { title: 'Ten years ago', body: `At the end of FY${yrs[0].fy}, the debt was ${moneyWords(yrs[0].total, 2)}.` },
    ],
  };
}

function statTariffs(): Stat {
  const c = budget.customs;
  const last = c.at(-1)!, first = c[0];
  return {
    headline: 'Tariffs became a bigger source of money',
    value: moneyWords(last.net, 2), caption: `in customs duties, after refunds, in FY${last.fy}`,
    chart: { kind: 'bars', data: c.map((x) => ({ label: `FY${x.fy}`, value: billions(x.net) })), unit: 'billion', highlight: `FY${last.fy}` },
    slides: [
      { title: `FY${first.fy}`, body: `${moneyWords(first.net, 2)} after refunds.` },
      { title: 'Refunds', body: `In FY${last.fy}, ${moneyWords(last.refunds, 2)} was paid back to importers.` },
      { title: 'Who pays', body: 'Importers pay the duty at the border; some of it reaches buyers in higher prices.' },
    ],
  };
}

const STATS: { id: string; make: () => Stat; source: Source }[] = [
  { id: 'spending', make: statSpending, source: MTS },
  { id: 'revenue', make: statRevenue, source: MTS },
  { id: 'deficits', make: statDeficits, source: MTS },
  { id: 'interest', make: statInterest, source: { name: 'Treasury, Interest Expense on the Debt', url: 'https://fiscaldata.treasury.gov/datasets/interest-expense-debt-outstanding/', date: `FY${debt.interestByFY.at(-1)?.fy}` } },
  { id: 'debt', make: statDebt, source: { name: 'Treasury, Debt to the Penny', url: 'https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/', date: debt.latest.date } },
  { id: 'tariffs', make: statTariffs, source: MTS },
];

// ---- Fun facts: the sourced ones in facts.json, and a few worked out from the game's own data.

interface RawFact { id: string; date?: string; title: string; body: string; source: { title: string; url: string } }
const RAW_FACTS = (factsJson as { facts: RawFact[] }).facts;
const HIST_DEBT = { name: 'Treasury, Historical Debt Outstanding', url: 'https://fiscaldata.treasury.gov/datasets/historical-debt-outstanding/' };
const OMB_HIST = { name: 'OMB Historical Tables', url: 'https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/' };

function computedFacts(): { id: string; fact: Fact; source: Source }[] {
  const out: { id: string; fact: Fact; source: Source }[] = [];
  const last = budget.annual.at(-1)!;
  const perSec = last.outlays / (365 * 86400);
  out.push({ id: 'per-second', source: { ...MTS, date: `FY${last.fy}` }, fact: { title: 'Federal spending, every second', big: dollars(perSec), body: `In FY${last.fy} the government spent ${moneyWords(last.outlays, 2)}: about ${dollars(perSec)} every second of the year, or ${moneyWords(last.outlays / 365, 1)} a day.` } });
  const interest = (budget.functionsByFY[String(FY)] ?? []).filter((f) => f.category === 'interest').reduce((a, f) => a + f.amount, 0);
  if (interest) out.push({ id: 'interest-day', source: { ...MTS, date: `FY${FY}` }, fact: { title: 'What a day of interest costs', big: moneyWords(interest / 365, 1), body: `Net interest on the debt came to ${moneyWords(interest, 2)} in FY${FY}: about ${moneyWords(interest / 365, 1)} a day, every day of the year.` } });
  const d0 = debt.byFY[0], d1835 = debt.byFY.find((x) => x.fy === 1835), d1838 = debt.byFY.find((x) => x.fy === 1838);
  if (d0) out.push({ id: 'debt-1790', source: HIST_DEBT, fact: { title: 'The first national debt', year: d0.fy, big: moneyWords(d0.total, 0), body: `In ${d0.fy}, mostly from the Revolutionary War, the national debt was ${moneyWords(d0.total, 1)}. On ${new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(debt.latest.date + 'T12:00:00Z'))}, it was ${moneyWords(debt.latest.total, 2)}.` } });
  if (d1835 && d1838) out.push({ id: 'debt-1835', source: HIST_DEBT, fact: { title: 'The year the debt almost hit zero', year: 1835, big: dollars(d1835.total), body: `Under President Andrew Jackson the government paid its debts down until, in 1835, the Treasury counted just ${dollars(d1835.total)} outstanding. It didn’t last: by 1838 the debt was back to ${moneyWords(d1838.total, 1)}.` } });
  const hist = cbo.history.filter((h) => h.actual);
  const surplus = hist.filter((h) => h.deficit < 0);
  const lastS = surplus.at(-1);
  if (lastS) {
    let run = 1; while (hist.find((h) => h.fy === lastS.fy - run)?.deficit! < 0) run++;
    out.push({ id: 'last-surplus', source: OMB_HIST, fact: { title: 'The last time the budget balanced', year: lastS.fy, big: `FY${lastS.fy}`, body: `The government last took in more than it spent in FY${lastS.fy}, the end of ${run} surplus years in a row (FY${lastS.fy - run + 1}–FY${lastS.fy}). Every year since has run a deficit.` } });
  }
  const h62 = hist[0];
  const nowDef = (budget.functionsByFY[String(FY)] ?? []).filter((f) => f.category === 'defense').reduce((a, f) => a + f.amount, 0);
  const nowAll = last.outlays;
  if (h62 && nowDef) out.push({ id: 'defense-1962', source: OMB_HIST, fact: { title: `In ${h62.fy}, half the budget was defense`, year: h62.fy, big: `${Math.round((h62.defense / h62.outlays) * 100)}%`, body: `Defense was ${Math.round((h62.defense / h62.outlays) * 100)}% of all federal spending in FY${h62.fy}, and Medicare didn’t exist yet. In FY${FY}, defense was about ${Math.round((nowDef / nowAll) * 100)}% and the big programs were Social Security, Medicare and Medicaid.` } });
  return out;
}

/** Within three days of the anniversary (today or the days just past or coming). */
function nearDate(date: string, now: number): 'today' | 'week' | undefined {
  const t = new Date(now);
  const y = t.getUTCFullYear();
  for (const yy of [y - 1, y, y + 1]) {
    const a = Date.UTC(yy, +date.slice(5, 7) - 1, +date.slice(8, 10));
    const days = Math.round((a - Date.UTC(y, t.getUTCMonth(), t.getUTCDate())) / 86400000);
    if (days === 0) return 'today';
    if (Math.abs(days) <= 3) return 'week';
  }
  return undefined;
}

// ---- Everything, as posts.

const RECENT_DAYS = 14;
const day = (iso: string) => iso.slice(0, 10);

export function buildItems(now = Date.now(), liveNews: NewsItem[] = []): FeedItem[] {
  const out: FeedItem[] = [];
  for (const raw of BILLS.bills) {
    // CRS often opens with the bill's name on a line of its own; the card already shows it.
    const lines = raw.summary.split('\n');
    const named = lines.length > 1 && lines[0].length < 200 && !/[.!?]\s*$/.test(lines[0].trim());
    const b = named ? { ...raw, summary: lines.slice(1).join('\n') } : raw;
    out.push({ id: `bill:${b.id}`, kind: 'bill', bill: b, topic: 'bills', effort: 'passive', title: `${b.label}: ${b.title}`, href: b.url, time: b.summaryDate, source: { name: 'Congress.gov · CRS summary', url: b.url, date: b.summaryDate } });
  }
  for (const n of mergeNews(liveNews, now)) {
    out.push({ id: `news:${n.id}`, kind: 'news', news: n, topic: 'news', effort: 'passive', title: n.title, href: n.url, time: n.time, source: { name: n.source, url: n.url, date: day(n.time) } });
  }
  for (const d of DEADLINES) {
    // In the feed only when it's close (two months); the side column lists every date.
    const left = Date.parse(d.date + 'T23:59:59') - now;
    if (left < 0 || left > 60 * 86400000) continue;
    out.push({ id: `deadline:${d.kind}-${d.date}`, kind: 'deadline', deadline: d, topic: 'news', effort: 'passive', title: d.kind === 'shutdown' ? 'Government funding runs out' : 'The debt limit', href: d.source.url, time: new Date(now).toISOString(), source: { name: d.source.title, url: d.source.url } });
  }
  out.push({ id: 'daily:today', kind: 'daily', topic: 'news', effort: 'interactive', title: 'Today’s Daily Dollar', href: '#daily', source: { name: 'Help Uncle Sam', date: new Date(now).toISOString().slice(0, 10) } });
  for (const s of STATS) {
    out.push({ id: `stat:${s.id}`, kind: 'stat', stat: s.make(), topic: 'budget', effort: 'passive', title: s.make().headline, href: '#overview', source: s.source });
  }
  for (const o of OPTIONS_DATA.options) {
    out.push({ id: `poll:${o.id}`, kind: 'poll', option: { ...o, savings10: Number(o.savings10) }, topic: 'polls', effort: 'interactive', title: o.name, href: '#ideas', source: { name: o.source.title.replace(/\s*\([^)]*\)$/, ''), url: o.source.url, date: o.source.title.match(/\(([^)]+)\)$/)?.[1] } });
  }
  for (const s of STOPS) {
    const lv = LEVELS.find((l) => l.id === s.id);
    out.push({ id: `tutorial:${s.id}`, kind: 'tutorial', stop: s, steps: lv ? lv.steps.map((x) => x.label) : [], takeaways: lv?.takeaways ?? [], topic: 'lessons', effort: 'deep', title: s.title, href: '#' + s.id, source: { name: `${missionShort(s)} · ${s.minutes} min` } });
    if (!lv) continue;
    // Quick play: the mission's game on its own, about a minute, for up to two stars.
    const g = gameOf(lv);
    if (g) out.push({ id: `quick:${s.id}`, kind: 'quick', stop: s, game: { title: g.title, goal: g.goal, rounds: g.rounds.length }, topic: 'lessons', effort: 'interactive', title: `Quick play: ${g.title}`, href: '#' + s.id, source: { name: `${missionShort(s)}, ${s.title}` } });
    for (const q of quizzesOf(lv)) {
      if (q.guess || q.estimate || q.split || q.sizes || q.sort || q.choices.length < 2 || out.some((x) => x.id === `check:${q.id}`)) continue;
      out.push({ id: `check:${q.id}`, kind: 'check', quiz: q, stop: s, topic: 'lessons', effort: 'interactive', title: q.question, href: '#' + s.id, source: { name: `From ${missionShort(s)}, ${s.title}` } });
    }
  }
  for (const g of FIELD_GUIDE) {
    out.push({ id: `chapter:${g.route}`, kind: 'chapter', route: g.route, label: g.label, blurb: CHAPTER_BLURB[g.route] ?? '', topic: 'lessons', effort: 'deep', title: g.label, href: '#' + g.route, source: { name: 'The field guide' } });
  }
  for (const t of glossary) {
    out.push({ id: `term:${t.id}`, kind: 'term', term: t, topic: 'lessons', effort: 'passive', title: t.term, href: '#glossary', source: { name: 'Glossary' } });
  }
  for (const f of RAW_FACTS) {
    const near = f.date ? nearDate(f.date, now) : undefined;
    out.push({ id: `fact:${f.id}`, kind: 'fact', fact: { title: f.title, body: f.body, date: f.date, year: f.date ? +f.date.slice(0, 4) : undefined, near }, topic: 'facts', effort: 'passive', title: f.title, href: f.source.url,
      ...(near ? { time: new Date(now).toISOString() } : {}), source: { name: f.source.title, url: f.source.url } });
  }
  for (const c of computedFacts()) {
    out.push({ id: `fact:${c.id}`, kind: 'fact', fact: c.fact, topic: 'facts', effort: 'passive', title: c.fact.title, href: c.source.url ?? '#overview', source: c.source });
  }
  for (const l of laws) {
    out.push({ id: `law:${l.id}`, kind: 'law', law: l, topic: 'budget', effort: 'passive', title: l.name, href: '#laws', source: { name: l.source.title.split(',')[0], url: l.source.url, date: l.signed.slice(0, 4) } });
  }
  return out;
}

const CHAPTER_BLURB: Record<string, string> = {
  overview: 'The whole federal budget on one page: what comes in, what goes out, and the gap.',
  spending: 'Where the money goes, program by program, and how that has changed.',
  revenue: 'Where the money comes from: income, payroll, corporate taxes and tariffs.',
  receipt: 'Your own tax receipt: where your federal taxes went, line by line.',
  state: 'What your state and district send to Washington and get back.',
  gap: 'Why the deficit is not a one-year problem: the structural gap.',
  debt: 'How the debt grew, who holds it, and what the interest costs.',
  process: 'How Congress is supposed to pass a budget, and what happens instead.',
  laws: 'The laws that moved deficits the most, scored by CBO.',
  'social-security': 'When Social Security’s trust fund runs short, and the ways to fix it.',
};

/** Is it new: a bill or announcement from the last two weeks. */
export const isFresh = (it: FeedItem, now = Date.now()) =>
  (it.kind === 'fact' && !!it.fact.near)
  || ((it.kind === 'bill' || it.kind === 'news' || it.kind === 'deadline' || it.kind === 'daily') && (!it.time || now - Date.parse(it.time) < RECENT_DAYS * 86400000));

// ---- The mix.

/** A steady shuffle: the same order all day, a new one tomorrow. */
function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1e6) / 1e6; };
}
function shuffle<T>(a: T[], rnd: () => number) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

/**
 * Three glances, one tap, one deeper read, over and over (the 3-1-1 rhythm), never three bills in
 * a row. Fresh official posts come first, newest first, then a "caught up" line, then the rest;
 * a row to swipe every dozen posts. Posts new since the last visit come first of all. With a
 * topic picked, just that topic, newest or shuffled.
 */
export function mix(items: FeedItem[], topic: Topic | 'all', seed: string, now = Date.now(), newIds: Set<string> = new Set()): FeedRow[] {
  const rnd = seeded(seed);
  const pick = topic === 'all' ? items : items.filter((i) => i.topic === topic);
  // What's new since the last visit leads; then the newest first.
  const fresh = pick.filter((i) => isFresh(i, now) || newIds.has(i.id)).sort((a, b) => Number(newIds.has(b.id)) - Number(newIds.has(a.id)) || (b.time ?? '').localeCompare(a.time ?? ''));
  const rest = shuffle(pick.filter((i) => !isFresh(i, now) && !newIds.has(i.id)), rnd);
  const lanes: Record<Effort, FeedItem[]> = { passive: [], interactive: [], deep: [] };
  for (const i of rest) lanes[i.effort].push(i);
  // Fresh posts take the glance slots first.
  lanes.passive = [...fresh.filter((i) => i.effort === 'passive'), ...lanes.passive];
  lanes.interactive = [...fresh.filter((i) => i.effort === 'interactive'), ...lanes.interactive];
  const freshIds = new Set(fresh.map((i) => i.id));
  const rows: FeedRow[] = [];
  const pattern: Effort[] = ['passive', 'passive', 'passive', 'interactive', 'deep'];
  let k = 0, sinceBreak = 0, placed = 0, caught = !fresh.length || topic !== 'all';
  const takeFrom = (e: Effort): FeedItem | undefined => {
    const lane = lanes[e];
    // Never three of a kind in a row (three bills, three words).
    const last = rows.slice(-2).map((r) => (r.kind === 'item' ? r.item.kind : ''));
    const i = lane.findIndex((x) => !(last.length === 2 && last.every((t) => t === x.kind)));
    return i < 0 ? lane.shift() : lane.splice(i, 1)[0];
  };
  while (lanes.passive.length + lanes.interactive.length + lanes.deep.length) {
    const want = pattern[k % pattern.length];
    k++;
    const order: Effort[] = [want, 'passive', 'interactive', 'deep'];
    const lane = order.find((e) => lanes[e].length)!;
    const it = takeFrom(lane);
    if (!it) continue;
    rows.push({ kind: 'item', item: it });
    if (freshIds.has(it.id)) placed++;
    if (!caught && placed === fresh.length) { rows.push({ kind: 'caughtup', id: 'caughtup', fresh: fresh.length }); caught = true; }
    sinceBreak++;
    if (topic === 'all' && sinceBreak >= 12) {
      sinceBreak = 0;
      const n = rows.filter((r) => r.kind === 'carousel').length;
      const history = items.filter((i) => i.kind === 'fact' && !!i.fact.date).sort((x, y) => (x.kind === 'fact' && y.kind === 'fact' ? (x.fact.date ?? '').localeCompare(y.fact.date ?? '') : 0));
      const c = n % 3 === 0
        ? { title: 'Chapters of the field guide', items: shuffle(items.filter((i) => i.kind === 'chapter'), rnd).slice(0, 6) }
        : n % 3 === 1 ? { title: 'Budget history, year by year', items: history }
        : { title: 'Missions to play', items: items.filter((i) => i.kind === 'tutorial').slice(n * 2, n * 2 + 6) };
      if (c.items.length) rows.push({ kind: 'carousel', id: `carousel-${n}`, ...c });
    }
  }
  return rows;
}

/** Cursor pages: the rows after the one with this id (or from the start), a batch at a time. */
export function page(rows: FeedRow[], after: string | null, size = 10): { rows: FeedRow[]; next: string | null } {
  const rowId = (r: FeedRow) => (r.kind === 'item' ? r.item.id : r.id);
  const start = after ? rows.findIndex((r) => rowId(r) === after) + 1 : 0;
  const out = rows.slice(start, start + size);
  return { rows: out, next: start + size < rows.length ? rowId(out.at(-1)!) : null };
}
export const rowKey = (r: FeedRow) => (r.kind === 'item' ? r.item.id : r.id);
