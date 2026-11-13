import { useSyncExternalStore } from 'react';
import { type Assessment, assess, LAST_FY } from '../lib/assess';
import type { Levers } from '../lib/sandbox';
import { load, save } from '../lib/storage';
import { DESK } from './levels';
import { cleanName, decodePlan, encodePlan, siteRoot } from './plans';

// The level 10 duel: two people balance Uncle Sam's budget on their own, without seeing each
// other's plan, then compare in three rounds. Everything travels in links, so it works on the
// static site and in the artifact, with no accounts:
//   the invite  …/p/duel/?duel=<id>&hp=10.abc&hlv=r2&hby=Rich       the host's plan, sealed
//   the reply   …/p/duel-back/?duelr=<id>&hp=…&hby=Rich&p=10.xyz&by=Sam   both plans
// One invite can go to many friends; each reply is its own head-to-head, and every duel is kept
// in this browser (the Duels page). Plans are compared, never people: no rankings of players.

export const DUEL_LEVEL = 'level-10';
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
/** The invite: my plan, sealed, and my name. */
export const inviteLink = (d: Pick<Duel, 'id' | 'host' | 'hostName'>) => `${siteRoot()}p/duel/?${inviteQuery(d)}`;
/** The reply: both plans, so the host sees the comparison on any device. */
export const replyLink = (d: Pick<Duel, 'id' | 'host' | 'hostName' | 'guest' | 'guestName'>) => `${siteRoot()}p/duel-back/?${replyQuery(d)}`;
/** Where a duel's comparison opens inside the game. */
export const resultHash = (d: Pick<Duel, 'id' | 'host' | 'hostName' | 'guest' | 'guestName'>) => '#duel?' + replyQuery(d);
export const inviteHash = (d: Pick<Duel, 'id' | 'host' | 'hostName'>) => '#duel?' + inviteQuery(d);
/** Reads a duel from the part of the hash after "duel?". */
export function readDuelParam(param: string | null): { kind: 'invite' | 'reply'; id: string; host: DuelPlan; hostName?: string; guest?: DuelPlan; guestName?: string } | null {
  if (!param) return null;
  const q = new URLSearchParams(param);
  const id = (q.get('duel') ?? q.get('duelr') ?? '').replace(/[^a-z0-9]/g, '').slice(0, 12);
  const h = plan(unprefixed(q, 'h'));
  if (!id || !h) return null;
  if (q.has('duelr')) {
    const g = plan(q);
    if (!g) return null;
    return { kind: 'reply', id, host: h, hostName: h.by, guest: g, guestName: g.by };
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
