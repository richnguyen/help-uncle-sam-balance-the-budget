import { lower } from './format';
import type { EconSummary, Goal } from './plan';
import { load, save } from './storage';

// Game layer for the balance-the-budget page: missions, stars, badges, and coaching tips.
// Progress is a per-viewer convenience kept in this browser only.

export interface Mission {
  id: Goal;
  level: 'Normal' | 'Hard' | 'Expert';
  title: string;
  short: string;
  goalText: string;
}

export const MISSIONS: Mission[] = [
  { id: 'stabilize', level: 'Normal', title: 'Stop the debt from outgrowing the economy', short: 'Stabilize the debt', goalText: 'Keep debt no bigger, compared with the economy, than it is today.' },
  { id: 'deficit3', level: 'Hard', title: 'Cut the yearly deficit to 3% of GDP', short: 'Deficit to 3%', goalText: 'Borrow no more than 3 cents of every dollar the economy produces.' },
  { id: 'balance', level: 'Expert', title: 'Balance the budget', short: 'Balance it', goalText: 'Take in as much as the government spends: no borrowing at all.' },
];

export interface Check { id: 'goal' | 'gentle' | 'balanced'; label: string; done: boolean; tip: string }

export interface Evaluation {
  met: boolean;
  stars: 0 | 1 | 2 | 3;
  checks: Check[];
  balanced: boolean;
  gentle: boolean;
  promiseKept: boolean;
}

export function evaluate(o: { met: boolean; econ: EconSummary; revenueShare: number; count: number; crossesRules: boolean; heavySide: 'revenue' | 'spending' | null }): Evaluation {
  const gentle = o.econ.rating === 'gentle';
  const balanced = o.count > 0 && o.revenueShare >= 1 / 3 - 1e-9 && o.revenueShare <= 2 / 3 + 1e-9;
  const checks: Check[] = [
    {
      id: 'goal',
      label: 'Reach the goal',
      done: o.met,
      tip: o.met ? 'Goal reached.' : 'Add cards until the bar reaches the goal line. If the cards run out, use the across-the-board changes.',
    },
    {
      id: 'gentle',
      label: 'Go easy on the economy',
      done: o.met && gentle,
      tip: gentle ? 'No single year tightens by more than 0.5% of GDP.' : 'Your plan tightens too fast in its steepest year. Turn on “Phase in over 3 years,” or swap a high-drag card for a low-drag one.',
    },
    {
      id: 'balanced',
      label: 'Balance taxes and spending cuts',
      done: o.met && balanced,
      tip: balanced ? 'Between a third and two-thirds of your savings come from each side.' : o.heavySide ? `Most of your savings come from ${o.heavySide === 'revenue' ? 'taxes' : 'spending cuts'}. Add a ${o.heavySide === 'revenue' ? 'spending' : 'revenue'} card.` : 'Use both revenue and spending cards.',
    },
  ];
  const stars = (o.met ? 1 : 0) + (o.met && gentle ? 1 : 0) + (o.met && balanced ? 1 : 0);
  return { met: o.met, stars: stars as Evaluation['stars'], checks, balanced, gentle, promiseKept: o.met && !o.crossesRules };
}

export interface Badge { id: string; name: string; desc: string }

export const BADGES: Badge[] = [
  { id: 'first', name: 'First move', desc: 'Add your first policy card.' },
  { id: 'stabilize', name: 'Debt stabilizer', desc: 'Finish campaign 1: stop the debt from outgrowing the economy.' },
  { id: 'deficit3', name: 'Deficit tamer', desc: 'Finish campaign 2: cut the deficit to 3% of GDP.' },
  { id: 'balance', name: 'Budget balancer', desc: 'Finish campaign 3: balance the budget.' },
  { id: 'gentle', name: 'Light touch', desc: 'Meet a budget desk’s goal while going easy on the economy.' },
  { id: 'even', name: 'Even-handed', desc: 'Meet a budget desk’s goal with 40 to 60% of savings from each side.' },
  { id: 'promise', name: 'Promise keeper', desc: 'Meet a budget desk’s goal without cutting benefits for current retirees, programs for low-income families, or public investment.' },
  { id: 'economist', name: 'Economist-level', desc: 'Meet a budget desk’s goal at no more than 10% above the lowest possible economic cost.' },
  { id: 'voter', name: 'Voice heard', desc: 'Vote on a policy card or pick a plan.' },
];

export interface Progress { stars: Partial<Record<Goal, number>>; badges: string[] }

export function loadProgress(): Progress {
  const p = load<Progress>('game', { stars: {}, badges: [] });
  return { stars: p.stars ?? {}, badges: Array.isArray(p.badges) ? p.badges : [] };
}

export function saveProgress(p: Progress) {
  save('game', p);
  // Lets the top bar's accomplishments count update straight away.
  try { window.dispatchEvent(new Event('ftd-progress')); } catch { /* no window */ }
}

/** Badges earned by the current state (not yet merged with saved progress). */
export function earnedBadges(o: { goal: Goal; ev: Evaluation; count: number; revenueShare: number; efficiency: number | null; voted: boolean }): string[] {
  const out: string[] = [];
  if (o.count > 0) out.push('first');
  if (o.ev.met) {
    out.push(o.goal);
    if (o.ev.gentle) out.push('gentle');
    if (o.revenueShare >= 0.4 && o.revenueShare <= 0.6) out.push('even');
    if (o.ev.promiseKept) out.push('promise');
    if (o.efficiency != null && o.efficiency >= 100 / 1.1) out.push('economist');
  }
  if (o.voted) out.push('voter');
  return out;
}

export function planText(o: { mission: Mission; names: string[]; deficit: string; debt: string; stars: number; fy: number }) {
  return [
    `My plan to ${lower(o.mission.title)} by FY${o.fy} (${'★'.repeat(o.stars)}${'☆'.repeat(3 - o.stars)}):`,
    ...o.names.map((n) => `• ${n}`),
    `Result in FY${o.fy}: deficit ${o.deficit} of GDP, debt ${o.debt} of GDP.`,
    'Built with Help Uncle Sam Balance the Budget, using CBO estimates.',
  ].join('\n');
}
