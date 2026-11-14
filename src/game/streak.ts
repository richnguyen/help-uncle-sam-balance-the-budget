// The Daily Dollar streak: how many days in a row this player has finished the puzzle, and the
// longest run they've ever had, from the results the game keeps in this browser (one entry per
// day played). Kept apart from daily.ts (and its puzzle data) so the top bar can show it cheaply.
// The best run is what unlocks each Mall landmark's finishing touch (build/landmarks.ts): a
// missed day resets the current run, but never takes back what was unlocked.
import { useEffect, useState } from 'react';
import { load } from '../lib/storage';

export const DAILY_ROUNDS = 5;
/** Sent whenever a Daily Dollar result is saved, so the top bar and the Mall update at once. */
export const DAILY_EVENT = 'ftd-daily';

type Results = Record<string, boolean[]>;
const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const back = (key: string, n: number) => { const [y, m, d] = key.split('-').map(Number); return keyOf(new Date(y, m - 1, d - n)); };

export interface Streak { run: number; best: number; played: number }

/** The current run (today counts once played; until then, the run up to yesterday), the best run ever, and days played. */
export function streakStats(r: Results, today = keyOf(new Date())): Streak {
  const days = Object.keys(r).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && (r[k]?.length ?? 0) >= DAILY_ROUNDS).sort();
  const set = new Set(days);
  const start = set.has(today) ? 0 : 1;
  let run = 0;
  while (set.has(back(today, start + run))) run++;
  let best = 0, cur = 0, prev = '';
  for (const k of days) { cur = prev && back(k, 1) === prev ? cur + 1 : 1; best = Math.max(best, cur); prev = k; }
  return { run, best: Math.max(best, run), played: days.length };
}

export const dailyStreak = () => streakStats(load<Results>('daily', {}));

/** The streak, kept current as results are saved (here or in another tab) and as days change. */
export function useDailyStreak(): Streak {
  const [s, setS] = useState(dailyStreak);
  useEffect(() => {
    const on = () => setS(dailyStreak());
    const vis = () => { if (document.visibilityState === 'visible') on(); };
    window.addEventListener(DAILY_EVENT, on);
    window.addEventListener('storage', on);
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener(DAILY_EVENT, on); window.removeEventListener('storage', on); document.removeEventListener('visibilitychange', vis); };
  }, []);
  return s;
}
