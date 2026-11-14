import { useSyncExternalStore } from 'react';
import { type Assessment, assess, LAST_FY } from '../lib/assess';
import { LEVERS, type Levers } from '../lib/sandbox';
import { OPTIONS_DATA } from '../lib/planData';
import { load, save } from '../lib/storage';
import { DESK } from './levels';
import { cleanName, decodePlan, encodePlan, siteRoot } from './plans';

// The Sealed Showdown (the final mission's duel): two people balance Uncle Sam's budget on their
// own, without seeing each other's plan, then the plans unseal in three rounds. Everything travels
// in links, so it works on the static site and in the artifact, with no accounts:
//   the invite  …/p/duel-<rating>-c<cards>-d<debt>/?duel=<id>&hp=10.abc&hlv=r2&hby=Ruth   the host's plan, sealed
//   the reply   …/p/duel-back/?duelr=<id>&hp=…&hby=Ruth&p=10.xyz&by=Sam                    both plans
//   a side match on a link's board: the reply's shape with vs=1 (nothing is saved or entered)
// The invite's preview is a classified dossier: the rating, how many cards, where the debt lands,
// and the moves blacked out. The plan itself rides in the link and the game hides it until the
// friend locks in their own ("sealed by the page": the address can be decoded by someone who
// tries). One invite can go to many friends; each reply is its own head-to-head, every plan on a
// link shares one board, and every duel is kept in this browser (the Showdowns page). Plans are
// compared, never people: no rankings of players.

export const DUEL_LEVEL = 'level-10';
/** What players call it: two sealed plans, then three rounds. (Routes and link parameters keep the older word, duel.) */
export const SHOWDOWN = 'Sealed Showdown';
const D10 = () => DESK.find((d) => d.id === DUEL_LEVEL)!;

export interface DuelPlan { ids: string[]; lv: Levers; gradual: boolean }
export interface Duel {
  id: string;
  /** host: I sent the invite. guest: I played someone's invite. */
  role: 'host' | 'guest';
  host: DuelPlan;
  hostName?: string;
  guest?: DuelPlan;
  guestName?: string;
  at: string;
  revealed?: boolean;
}

// ---------- links ----------
const prefixed = (q: string, pre: string) => { const x = new URLSearchParams(q); const out = new URLSearchParams(); x.forEach((v, k) => out.set(pre + k, v)); return out; };
const unprefixed = (q: URLSearchParams, pre: string) => { const out = new URLSearchParams(); q.forEach((v, k) => { if (k.startsWith(pre)) out.set(k.slice(pre.length), v); }); return out; };
const code = (p: DuelPlan, by?: string) => encodePlan({ level: DUEL_LEVEL, goal: D10().goal, ids: p.ids, lv: p.lv, gradual: p.gradual, by });
const plan = (q: URLSearchParams): (DuelPlan & { by?: string }) | null => { const p = decodePlan(q); return p && p.level === DUEL_LEVEL ? { ids: p.ids, lv: p.lv, gradual: p.gradual, by: p.by } : null; };
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');

export const newDuelId = newId;
/** Two plans are the same plan when they use the same cards, sliders, and phase-in. */
export const planKey = (p: DuelPlan) => JSON.stringify([p.ids.slice().sort(), p.lv, !!p.gradual]);
const inviteQuery = (d: Pick<Duel, 'id' | 'host' | 'hostName'>) => {
  const q = new URLSearchParams({ duel: d.id });
  prefixed(code(d.host, d.hostName), 'h').forEach((v, k) => q.set(k, v));
  return q.toString();
};
const replyQuery = (d: Pick<Duel, 'id' | 'host' | 'hostName' | 'guest' | 'guestName'>) => {
  const q = new URLSearchParams({ duelr: d.id });
  prefixed(code(d.host, d.hostName), 'h').forEach((v, k) => q.set(k, v));
  new URLSearchParams(code(d.guest!, d.guestName)).forEach((v, k) => q.set(k, v));
  return q.toString();
};
/** The invite: my plan, sealed, and my name. Its preview page is the dossier that matches the plan. */
export const inviteLink = (d: Pick<Duel, 'id' | 'host' | 'hostName'>) => `${siteRoot()}p/${dossierId(d.host)}/?${inviteQuery(d)}`;
/** A side match on a link's board: my plan against another plan on it. Nothing is saved or entered. */
export const sideHash = (id: string, mine: DuelPlan, theirs: DuelPlan, theirName?: string) => '#duel?' + replyQuery({ id, host: theirs, hostName: theirName, guest: mine }) + '&vs=1';
/** The reply: both plans, so the host sees the comparison on any device. */
export const replyLink = (d: Pick<Duel, 'id' | 'host' | 'hostName' | 'guest' | 'guestName'>) => `${siteRoot()}p/duel-back/?${replyQuery(d)}`;
/** Where a duel's comparison opens inside the game. */
export const resultHash = (d: Pick<Duel, 'id' | 'host' | 'hostName' | 'guest' | 'guestName'>) => '#duel?' + replyQuery(d);
export const inviteHash = (d: Pick<Duel, 'id' | 'host' | 'hostName'>) => '#duel?' + inviteQuery(d);
/** Reads a duel from the part of the hash after "duel?". */
export function readDuelParam(param: string | null): { kind: 'invite' | 'reply'; id: string; host: DuelPlan; hostName?: string; guest?: DuelPlan; guestName?: string; side?: boolean } | null {
  if (!param) return null;
  const q = new URLSearchParams(param);
  const id = (q.get('duel') ?? q.get('duelr') ?? '').replace(/[^a-z0-9]/g, '').slice(0, 12);
  const h = plan(unprefixed(q, 'h'));
  if (!id || !h) return null;
  if (q.has('duelr')) {
    const g = plan(q);
    if (!g) return null;
    return { kind: 'reply', id, host: h, hostName: h.by, guest: g, guestName: g.by, side: q.has('vs') };
  }
  return { kind: 'invite', id, host: h, hostName: h.by };
}

// ---------- the duels kept in this browser ----------
const KEY = 'duels';
export const loadDuels = () => load<Duel[]>(KEY, []);
// One record per duel for a guest; for a host, the open invite plus one record per reply (a
// friend's name and plan), so friends who don't sign their replies still each get their own.
const keyOf = (d: Pick<Duel, 'id' | 'role' | 'guest' | 'guestName'>) => `${d.id}:${d.role}:${d.role === 'host' ? (d.guest ? cleanName(d.guestName ?? '') + ':' + planKey(d.guest) : 'open') : ''}`;
export function saveDuel(d: Duel) {
  const all = loadDuels();
  // A host's invite gets one record per friend who replies (plus the open invite itself).
  const i = all.findIndex((x) => keyOf(x) === keyOf(d));
  if (i >= 0) all[i] = { ...all[i], ...d }; else all.unshift(d);
  save(KEY, all.slice(0, 60));
  window.dispatchEvent(new Event('ftd-duels'));
}
const onDuels = (f: () => void) => { window.addEventListener('ftd-duels', f); return () => window.removeEventListener('ftd-duels', f); };
let snap = ''; let cached: Duel[] = [];
const getDuels = () => { const raw = JSON.stringify(loadDuels()); if (raw !== snap) { snap = raw; cached = JSON.parse(raw); } return cached; };
export const useDuels = () => useSyncExternalStore(onDuels, getDuels, () => []);

/** The duel being played right now (accepted from an invite, not yet revealed). */
export const activeDuel = (): Duel | null => load<Duel | null>('duel-active', null);
export const setActiveDuel = (d: Duel | null) => { save('duel-active', d); window.dispatchEvent(new Event('ftd-duels')); };
/** A rematch: the friend to send the next duel to (shown above the level 10 duel invite). */
export const rematchFor = (): { name?: string } | null => load<{ name?: string } | null>('duel-rematch', null);
export const setRematch = (r: { name?: string } | null) => { save('duel-rematch', r); window.dispatchEvent(new Event('ftd-duels')); };

// ---------- the three rounds ----------
export type RoundWinner = 'me' | 'them' | 'tie';
export interface Round { id: 'debt' | 'economy' | 'balance'; title: string; question: string; mine: string; theirs: string; winner: RoundWinner; why: string }

export const assessDuel = (p: DuelPlan) => assess(D10().goal, p.ids, p.lv, p.gradual);
const debtShare = (a: Assessment) => a.last.debt / a.last.gdp;
/**
 * Who pays, over the whole projection: new tax revenue against spending cuts, counting the cards
 * and the across-the-board changes alike (a tax cut or a spending increase counts as nothing).
 */
export function whoPays(a: Assessment) {
  const tax = Math.max(0, a.sim.reduce((s, y) => s + y.policyRevenue, 0));
  const cuts = Math.max(0, a.sim.reduce((s, y) => s + y.policy - y.policyRevenue, 0));
  return { tax, cuts, any: tax + cuts > 0, taxShare: tax + cuts > 0 ? tax / (tax + cuts) : 0.5 };
}
export const splitLabel = (a: Assessment) => { const w = whoPays(a); return w.any ? `${Math.round(w.taxShare * 100)}% taxes, ${Math.round((1 - w.taxShare) * 100)}% cuts` : 'no changes yet'; };
const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`;

/**
 * Round 1, the debt: whose plan leaves it lower by the last projection year (debt held by the
 * public, next to the economy). Round 2, the economy: whose steepest year is gentler. Round 3,
 * the balance: whose split between new taxes and spending cuts is closer to even. Best of three.
 * Even after three rounds, the tie-breakers, in order: the gentler steepest year (so the scoring
 * never pushes anyone toward a steeper plan just to save a card), then fewer policy cards. Even
 * on both is a true tie.
 */
export function duelRounds(mine: DuelPlan, theirs: DuelPlan) {
  const a = assessDuel(mine), b = assessDuel(theirs);
  const pick = (x: number, y: number, tie: number): RoundWinner => (Math.abs(x - y) <= tie ? 'tie' : x < y ? 'me' : 'them');
  const off = (s: Assessment) => { const w = whoPays(s); return w.any ? Math.abs(w.taxShare - 0.5) : 0.5; };
  const rounds: Round[] = [
    { id: 'debt', title: 'The debt', question: `Whose plan leaves the debt lower by FY${LAST_FY}?`, mine: `${pct1(debtShare(a))} of GDP`, theirs: `${pct1(debtShare(b))} of GDP`, winner: pick(debtShare(a), debtShare(b), 0.001), why: 'Debt held by the public, next to the size of the economy, in the last year of the projection.' },
    { id: 'economy', title: 'The economy', question: 'Whose plan goes easier on the economy?', mine: `${pct1(a.econ.peakStep)} of GDP`, theirs: `${pct1(b.econ.peakStep)} of GDP`, winner: pick(a.econ.peakStep, b.econ.peakStep, 0.0005), why: 'How much the plan tightens in its steepest single year. Less is gentler.' },
    { id: 'balance', title: 'The balance', question: 'Whose plan splits the load more evenly?', mine: splitLabel(a), theirs: splitLabel(b), winner: pick(off(a), off(b), 0.02), why: 'How close the split between new taxes and spending cuts is to half and half, counting the cards and the across-the-board changes.' },
  ];
  const won = rounds.filter((r) => r.winner === 'me').length, lost = rounds.filter((r) => r.winner === 'them').length;
  const cards = { mine: mine.ids.length, theirs: theirs.ids.length };
  // The tie-breakers decide only when the rounds come out even: the gentler economy first, then fewer cards.
  const steep = { mine: a.econ.peakStep, theirs: b.econ.peakStep };
  const byEconomy = Math.abs(steep.mine - steep.theirs) > 0.00005;
  const tiebreakBy: 'economy' | 'cards' | null = won !== lost ? null : byEconomy ? 'economy' : 'cards';
  const tiebreak: RoundWinner | null = !tiebreakBy ? null
    : tiebreakBy === 'economy' ? (steep.mine < steep.theirs ? 'me' : 'them')
    : cards.mine === cards.theirs ? 'tie' : cards.mine < cards.theirs ? 'me' : 'them';
  const outcome: 'won' | 'tied' | 'lost' = won > lost || tiebreak === 'me' ? 'won' : won < lost || tiebreak === 'them' ? 'lost' : 'tied';
  return { rounds, outcome, score: `${won}–${lost}`, tiebreak, tiebreakBy, steep, cards, mine: a, theirs: b, balanced: { mine: a.met, theirs: b.met } };
}

// ---------- the sealed envelope, the boxing scorecard, and the board ----------
export type Rating = 'gentle' | 'moderate' | 'steep';
const RATING_WORD: Record<Rating, string> = { gentle: 'Gentle', moderate: 'Moderate', steep: 'Steep' };
/** The sealed plan's rating (how hard it hits the economy), the one thing the invite reveals. */
export const sealedRating = (p: DuelPlan): Rating => assessDuel(p).econ.rating;
/** What the dossier shows of a sealed plan: enough to aim at, nothing of the moves. */
export interface Dossier { rating: Rating; met: boolean; cards: number; levers: number; moves: number; debt: number; bars: number[] }
const hash = (t: string) => { let h = 2166136261; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); return h >>> 0; };
export function dossier(p: DuelPlan): Dossier {
  const a = assessDuel(p);
  const levers = LEVERS.filter((l) => p.lv[l.id]).length;
  const moves = p.ids.length + levers;
  // The blacked-out bars: one per move (up to eight), their lengths from a scramble of the plan,
  // so a bar's length says nothing about the move under it.
  let h = hash(planKey(p));
  const bars = Array.from({ length: Math.min(moves, 8) }, () => { h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return 46 + (h % 49); });
  return { rating: a.econ.rating, met: a.met, cards: p.ids.length, levers, moves, debt: Math.round(debtShare(a) * 100), bars };
}
export const RATING_NAME = (r: Rating) => RATING_WORD[r];
/** The pre-drawn previews: three or fewer cards, 4 to 11, or 12 and up; debt to the nearest 5% of GDP from 70 to 90. */
export const cardBucket = (n: number) => (n <= 3 ? 3 : n >= 12 ? 12 : n);
export const debtBucket = (d: number) => Math.max(70, Math.min(90, Math.round(d / 5) * 5));
export const dossierId = (p: DuelPlan) => { const d = dossier(p); return `duel-${d.rating}-c${cardBucket(d.cards)}-d${debtBucket(d.debt)}`; };
const blocks = (d: Dossier) => d.bars.slice(0, 3).map((w) => '█'.repeat(Math.round(w / 8))).join(' ');
/** The invite's message: the dossier in a line. The name and the exact figures go here; the preview card is pre-drawn. */
export function sealedText(name: string, p: DuelPlan) {
  const d = dossier(p);
  const who = name || 'A friend';
  return `🔒 SEALED BUDGET PLAN · CLASSIFIED. ${who} ${d.met ? 'balanced Uncle Sam’s budget and sealed the plan' : 'built a plan for Uncle Sam’s budget and sealed it'}. Rating: ${RATING_WORD[d.rating]} · ${d.cards} CBO option${d.cards === 1 ? '' : 's'} · debt at ${d.debt}% of GDP by FY${LAST_FY} · moves: ${blocks(d)}. Build yours to unseal ${name ? name + '’s' : 'their'} moves and face off across 3 rounds 👉`;
}

// ---------- the fog of war: what a friend sees of the sealed plan while building ----------
const BAND: Record<Rating, number> = { gentle: 0, moderate: 1, steep: 2 };
const AREA: { id: string; label: string; levers: string[] }[] = [
  { id: 'tax', label: 'taxes', levers: ['revenues'] },
  { id: 'ss', label: 'Social Security', levers: ['socialSecurity'] },
  { id: 'medicare', label: 'Medicare', levers: ['medicare'] },
  { id: 'medicaid', label: 'Medicaid', levers: ['medicaid'] },
  { id: 'defense', label: 'defense', levers: ['defense'] },
  { id: 'other', label: 'other programs', levers: ['nondefense', 'otherMandatory'] },
];
const OPT = new Map(OPTIONS_DATA.options.map((o) => [o.id, o]));
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs.at(-1));
/** The parts of the budget a plan changed, by card or across the board. */
export function areasTouched(p: DuelPlan) {
  const hit = new Set<string>([...p.ids.map((id) => OPT.get(id)?.lever as string | undefined), ...LEVERS.filter((l) => p.lv[l.id]).map((l) => l.id as string)].filter((x): x is string => !!x));
  return { touched: AREA.filter((a) => a.levers.some((l) => hit.has(l))).map((a) => a.label), left: AREA.filter((a) => !a.levers.some((l) => hit.has(l))).map((a) => a.label) };
}
export interface Fog { debt: number; band: Rating; clue: string }
/**
 * The sealed benchmark: the debt figure (the dossier already shows it), only the band of the
 * economy rating, and for the balance round a single vague clue: which parts of the budget the
 * plan touched, never how much or with which cards.
 */
export function fog(sealed: DuelPlan): Fog {
  const a = assessDuel(sealed);
  const { touched, left } = areasTouched(sealed);
  const clue = !touched.length ? 'The sealed plan changes nothing yet.'
    : !left.length ? 'The sealed plan touched every part of the budget.'
    : `The sealed plan touched ${list(touched)}, but left ${list(left)} alone.`;
  return { debt: debtShare(a), band: a.econ.rating, clue };
}
/**
 * Uncle Sam's running commentary while a friend builds against a sealed plan. It uses only what
 * the fog shows (the debt figure and the rating band) and the friend's own plan, and it treats
 * taxes and cuts alike: what it needles is steepness and a lopsided split, never a side.
 */
export function showdownTaunt(mine: DuelPlan, sealed: DuelPlan): { id: 'bold' | 'heat' | 'safe' | 'lopsided' | 'ahead'; line: string } | null {
  if (!mine.ids.length && !LEVERS.some((l) => mine.lv[l.id])) return null;
  const a = assessDuel(mine), b = assessDuel(sealed);
  const ahead = debtShare(a) < debtShare(b) - 0.001;
  const steeper = BAND[a.econ.rating] > BAND[b.econ.rating], gentler = BAND[a.econ.rating] < BAND[b.econ.rating];
  const w = whoPays(a);
  if (steeper && ahead) return { id: 'bold', line: `Bold move. You’re ahead on the debt, but your economy round is taking heat: you’re at ${RATING_WORD[a.econ.rating]}, and the sealed plan is rated ${RATING_WORD[b.econ.rating]}.` };
  if (steeper) return { id: 'heat', line: `Rough patch: behind on the debt, and steeper than the sealed plan. Try a card that phases in more gently.` };
  if (!ahead) return { id: 'safe', line: `Playing it safe? The sealed plan ${gentler ? 'took more heat and ' : ''}leaves the debt lower. You’re behind in Round 1.` };
  if (w.any && Math.abs(w.taxShare - 0.5) > 0.25) return { id: 'lopsided', line: `You’re ahead on the debt, but it’s nearly all ${w.taxShare > 0.5 ? 'taxes' : 'spending cuts'}. The balance round goes to the plan closer to half and half.` };
  return { id: 'ahead', line: 'Ahead on the debt, and no steeper than the sealed plan. The balance round is still in the fog.' };
}

// ---------- the unsealed autopsy: where two plans split ----------
export interface Lean { side: 'tax' | 'cuts' | 'even'; share: number; top?: string }
/**
 * Which way a plan leans (55% or more of its savings from one side), and the biggest move on that
 * side: a card the other plan doesn't play, when there is one, since that's where the two differ.
 */
export function lean(p: DuelPlan, other?: DuelPlan): Lean {
  const a = assessDuel(p), w = whoPays(a);
  const side: Lean['side'] = !w.any ? 'even' : w.taxShare >= 0.55 ? 'tax' : w.taxShare <= 0.45 ? 'cuts' : 'even';
  const cards = p.ids.map((id) => OPT.get(id)).filter((o): o is NonNullable<typeof o> => !!o && o.savings10 > 0 && (side === 'even' || (o.side === 'revenue') === (side === 'tax')));
  const own = (o: { id: string }) => Number(!other?.ids.includes(o.id));
  const card = cards.sort((x, y) => own(y) - own(x) || y.savings10 - x.savings10)[0];
  // No card on that side: the biggest across-the-board change on it.
  const lever = LEVERS.filter((l) => p.lv[l.id] && (side === 'even' || (l.id === 'revenues') === (side === 'tax')) && (l.id === 'revenues' ? p.lv[l.id] > 0 : p.lv[l.id] < 0)).sort((x, y) => Math.abs(p.lv[y.id]) - Math.abs(p.lv[x.id]))[0];
  const top = card ? card.name : lever ? `${lever.label} ${p.lv[lever.id] > 0 ? '+' : ''}${p.lv[lever.id]}% across the board` : undefined;
  return { side, share: side === 'tax' ? w.taxShare : side === 'cuts' ? 1 - w.taxShare : w.taxShare, top };
}
const leanLine = (who: string, l: Lean) => {
  const pc = Math.round(l.share * 100), inc = l.top ? ` (including “${l.top}”)` : '';
  return l.side === 'tax' ? `${who} relied ${pc}% on tax increases${inc}.` : l.side === 'cuts' ? `${who} relied ${pc}% on spending cuts${inc}.` : `${who} split the load: ${pc}% taxes, ${100 - pc}% cuts${inc}.`;
};
/** "Where you split": each plan's lean in a sentence, and the tagline for the pair. */
export function divergence(a: DuelPlan, b: DuelPlan, aName: string, bName: string) {
  const la = lean(a, b), lb = lean(b, a);
  const tagline = la.side !== 'even' && lb.side !== 'even' && la.side !== lb.side ? 'Same goal, opposite paths.' : la.side === lb.side ? 'Same goal, similar paths.' : 'Same goal, different mixes.';
  return { a: la, b: lb, lines: [leanLine(aName, la), leanLine(bName, lb)], tagline };
}

/**
 * The fight, scored like boxing: each round 10–9 to the plan that wins it (10–10 if even), and a
 * verdict: all three rounds is a knockout, 2–1 a split decision, a win with an even round a
 * majority decision, and even rounds go to the tie-breakers (a decision) or a draw.
 */
export function scorecard(r: ReturnType<typeof duelRounds>) {
  const pts = r.rounds.map((x) => (x.winner === 'me' ? [10, 9] : x.winner === 'them' ? [9, 10] : [10, 10]));
  const total = pts.reduce((s, [a, b]) => [s[0] + a, s[1] + b], [0, 0]);
  const won = r.rounds.filter((x) => x.winner === 'me').length, lost = r.rounds.filter((x) => x.winner === 'them').length;
  const verdict = won === 3 || lost === 3 ? 'Knockout'
    : won === lost ? (r.outcome === 'tied' ? 'Draw' : 'Decision on the tie-breaker')
    : Math.min(won, lost) > 0 ? 'Split decision' : 'Majority decision';
  return { pts, total, verdict };
}

/** Whether this comparison was already revealed on this device (then it opens with every round showing). */
const SEEN = 'duel-seen';
export const revealKey = (id: string, a: DuelPlan, b: DuelPlan) => `${id}:${planKey(a)}:${planKey(b)}`;
export const wasRevealed = (k: string) => load<string[]>(SEEN, []).includes(k);
export const markRevealed = (k: string) => save(SEEN, [k, ...load<string[]>(SEEN, []).filter((x) => x !== k)].slice(0, 60));

export interface BoardEntry { plan: DuelPlan; name?: string; host: boolean; mine: boolean }
/** A board row from the server, as a plan (rows that don't read as a final-mission plan are left out). */
export function boardEntry(x: { p: string; lv: string; ph: boolean; name: string | null; host: boolean; mine: boolean }): BoardEntry | null {
  const q = new URLSearchParams({ p: x.p, ...(x.lv ? { lv: x.lv } : {}), ...(x.ph ? {} : { ph: '0' }) });
  const p = plan(q);
  return p ? { plan: { ids: p.ids, lv: p.lv, gradual: p.gradual }, name: x.name ?? undefined, host: x.host, mine: x.mine } : null;
}
/** How a plan reads on the board: the link's own spelling (cards, across-the-board changes, phase-in). */
export function boardPlanArgs(p: DuelPlan) {
  const q = new URLSearchParams(code(p));
  return { p: q.get('p') ?? '10.', lv: q.get('lv') ?? '', ph: q.get('ph') !== '0' };
}
/**
 * Everyone on one link, plan against plan: each plan plays every other in the same three rounds
 * (and tie-breakers). A win is a point, a draw half. Ordered by points, then the gentler economy.
 */
export function standings(entries: BoardEntry[]) {
  const rows = entries.map((e) => ({ ...e, w: 0, l: 0, t: 0, a: assessDuel(e.plan) }));
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const o = duelRounds(rows[i].plan, rows[j].plan).outcome;
    if (o === 'won') { rows[i].w++; rows[j].l++; } else if (o === 'lost') { rows[i].l++; rows[j].w++; } else { rows[i].t++; rows[j].t++; }
  }
  return rows.sort((x, y) => (y.w + y.t / 2) - (x.w + x.t / 2) || x.a.econ.peakStep - y.a.econ.peakStep);
}
