// The Daily Dollar's crowd: anonymous counts of each call, right or wrong, and each finished score
// (supabase/migrations/…_daily_counts.sql), read back as "61% of players got this one". Plus the
// friend link: a shared result carries the sharer's right/wrong pattern, so a friend who plays the
// same puzzle sees the two side by side. Nothing about who played is sent or stored.
import { useEffect, useState } from 'react';
import { backendOn, rpc } from '../lib/backend';
import { load, save } from '../lib/storage';
import { ROUNDS } from './daily';

/** Below this many answers a share is too noisy to show. */
export const CROWD_MIN = 20;

/** One count, at most once per browser per puzzle and call (call 0 is the final score). */
export function countDaily(puzzle: number, call: number, result: number) {
  const sent = load<Record<string, true>>('daily-sent', {});
  const k = `${puzzle}:${call}`;
  if (sent[k]) return;
  // Keep only the last few puzzles' marks.
  save('daily-sent', { ...Object.fromEntries(Object.entries(sent).filter(([x]) => Number(x.split(':')[0]) >= puzzle - 3)), [k]: true });
  (globalThis as { __plays?: [string, string][] }).__plays?.push(['daily', `${puzzle}-${call}-${result}`]);
  if (backendOn()) rpc('count_daily', { p_puzzle: puzzle, p_call: call, p_result: result }).catch(() => {});
}

export interface DailyStats { puzzle: number; calls: { call: number; right: number; wrong: number }[]; scores: Record<string, number>; players: number }

export async function dailyStats(puzzle: number): Promise<DailyStats | null> {
  const r = await rpc<DailyStats>('daily_stats', { p_puzzle: puzzle });
  if (!r || !Array.isArray(r.calls)) return null;
  return { puzzle, calls: r.calls, scores: r.scores && typeof r.scores === 'object' ? r.scores : {}, players: Number(r.players) || 0 };
}

/** The puzzle's crowd counts, read again whenever `tick` changes (after each call). */
export function useDailyStats(puzzle: number, enabled: boolean, tick: number) {
  const [s, setS] = useState<DailyStats | null>(null);
  useEffect(() => {
    if (!enabled || !backendOn()) return;
    let alive = true;
    // A moment after the call, so this browser's own count is in.
    const t = setTimeout(() => { dailyStats(puzzle).then((r) => { if (alive && r) setS(r); }).catch(() => {}); }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [puzzle, enabled, tick]);
  return s;
}

/** The share of players who got call k (1-5) right, once enough have answered. */
export function callPct(s: DailyStats | null, k: number) {
  const c = s?.calls.find((x) => x.call === k);
  const total = c ? c.right + c.wrong : 0;
  return c && total >= CROWD_MIN ? { pct: Math.round((c.right / total) * 100), total } : null;
}

/** The call fewest players got right (of those with enough answers). */
export function hardest(s: DailyStats | null) {
  let best: { call: number; pct: number } | null = null;
  for (let k = 1; k <= ROUNDS; k++) { const p = callPct(s, k); if (p && (!best || p.pct < best.pct)) best = { call: k, pct: p.pct }; }
  return best;
}

/** A line for the share text, with no spoiler: which call caught the most players out. */
export function crowdLine(s: DailyStats | null) {
  const h = hardest(s);
  return h && h.pct <= 65 ? `Call ${h.call} tripped up ${100 - h.pct}% of players today.` : null;
}

/** Today's totals once enough have finished: how many, the average, and how many got all five. */
export function crowdSummary(s: DailyStats | null) {
  if (!s || s.players < CROWD_MIN) return null;
  const sum = Object.entries(s.scores).reduce((a, [k, n]) => a + Number(k) * n, 0);
  return { players: s.players, avg: sum / s.players, perfect: Math.round(((s.scores[String(ROUNDS)] ?? 0) / s.players) * 100) };
}

// ---- The friend link: ?daily&dn=9&vs=11011&by=Ruth

export interface Friend { puzzle: number; vs: boolean[]; by: string }
const bits = (a: boolean[]) => a.map((x) => (x ? '1' : '0')).join('');

/** A friend's result from the page's link, if it's well formed. */
export function friendFrom(param: string | null): Friend | null {
  const q = new URLSearchParams(param ?? '');
  const vs = q.get('vs') ?? '', dn = Number(q.get('dn'));
  if (!new RegExp(`^[01]{${ROUNDS}}$`).test(vs) || !Number.isInteger(dn) || dn < 1) return null;
  const by = (q.get('by') ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 24);
  return { puzzle: dn, vs: [...vs].map((c) => c === '1'), by };
}

/** The link a result is shared with: its preview card (one per right/wrong pattern), then the game. */
export function dailyShareUrl(site: string, puzzle: number, answers: boolean[], name: string) {
  const b = bits(answers);
  const q = new URLSearchParams({ dn: String(puzzle), vs: b });
  if (name.trim()) q.set('by', name.trim().slice(0, 24));
  return `${site}p/daily-${b}/?daily&${q.toString()}`;
}
