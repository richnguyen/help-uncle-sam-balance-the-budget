import { budget, cbo } from '../data';
import { evaluate, type Evaluation } from './game';
import { economics, type EconSummary, extraFor, type Goal, goalMet, optimize, type PlanContext, planCost, savingsSplit, shortfall } from './plan';
import { withEcon } from './planData';
import { type Levers, simulate, type SimYear, ZERO } from './sandbox';
import { shockFor } from './twists';

// Scores a budget-desk plan outside the desk itself (a friend's shared plan, the Budget Story,
// the replay clip), with the same model and star rules the desk uses.

const startYear = budget.latestFY;
const base = cbo.baseline.filter((b) => b.fy > startYear);
const start = cbo.baseline.find((b) => b.fy === startYear) ?? cbo.history.find((h) => h.fy === startYear)!;
export const CTX: PlanContext = { baseline: base, startDebt: start.debtPublic, startRatio: start.debtPublic / start.gdp, options: withEcon() };
export const LAST_FY = base.at(-1)!.fy;
export const FIRST_FY = base[0].fy;

/** The desk's context for a goal: the same model, plus that desk's twist (twists.ts). */
export const ctxFor = (goal?: Goal): PlanContext => (shockFor(goal) ? { ...CTX, shock: shockFor(goal) } : CTX);
export const runPlan = (ids: string[], lv: Levers, gradual: boolean, goal?: Goal): SimYear[] =>
  simulate(CTX.baseline, CTX.startDebt, lv, { phaseIn: gradual, extra: extraFor(ids, CTX, gradual), shock: shockFor(goal) });
export const BASELINE = runPlan([], ZERO, true);
/** The no-change path a desk's plan is compared with, twist included. */
export const baselineFor = (goal?: Goal) => (shockFor(goal) ? runPlan([], ZERO, true, goal) : BASELINE);

export interface Assessment {
  goal: Goal;
  sim: SimYear[];
  last: SimYear;
  met: boolean;
  /** Share of the goal's gap the plan closes (1 = met). */
  progress: number;
  econ: EconSummary;
  ev: Evaluation;
  revTen: number;
  spTen: number;
  revenueShare: number;
  crossesRules: boolean;
  /** Each chosen card's own share of the gap, largest first. */
  shares: { id: string; name: string; side: 'revenue' | 'spending'; share: number; savings10: number }[];
  /** Economic cost compared with the least-cost plan (100 = as gentle as possible), when comparable. */
  efficiency: number | null;
}

const crossing = (o: PlanContext['options'][number]) => o.econ.tags.some((t) => t === 'retirees' || t === 'lowIncome' || t === 'investment');

const cache = new Map<string, Assessment>();
export function assess(goal: Goal, ids: string[], lv: Levers, gradual: boolean): Assessment {
  const key = [goal, [...ids].sort().join(','), Object.values(lv).join(','), gradual].join('|');
  const hit = cache.get(key);
  if (hit) return hit;
  const sim = runPlan(ids, lv, gradual, goal);
  const last = sim.at(-1)!;
  const short0 = shortfall(goal, runPlan([], ZERO, gradual, goal), CTX.startRatio);
  const met = goalMet(goal, sim, CTX.startRatio);
  const progress = short0 > 0 ? Math.min(1, Math.max(0, (short0 - shortfall(goal, sim, CTX.startRatio)) / short0)) : 1;
  const econ = economics(ctxFor(goal), ids, lv, gradual);
  const sel = CTX.options.filter((o) => ids.includes(o.id));
  const { rev: revTen, sp: spTen } = savingsSplit(sel);
  const revenueShare = revTen + spTen ? revTen / (revTen + spTen) : 0;
  const crossesRules = sel.some(crossing);
  const ev = evaluate({ met, econ, revenueShare, count: sel.length, crossesRules, heavySide: sel.length ? (revenueShare > 2 / 3 ? 'revenue' : revenueShare < 1 / 3 ? 'spending' : null) : null });
  const shares = sel
    .map((o) => ({ id: o.id, name: o.name, side: o.side, savings10: o.savings10, share: short0 > 0 ? (short0 - shortfall(goal, runPlan([o.id], ZERO, gradual, goal), CTX.startRatio)) / short0 : 0 }))
    .sort((a, b) => b.share - a.share);
  const slidersUsed = Object.values(lv).some((v) => v !== 0);
  let efficiency: number | null = null;
  if (met && !slidersUsed && sel.length) {
    const best = optimize(ctxFor(goal), goal, { retirees: true, lowIncome: true, investment: true }, gradual, 1 / 3);
    const mine = planCost(CTX, ids);
    if (best.met && mine > 0) efficiency = Math.min(100, Math.round((planCost(CTX, best.ids) / mine) * 100));
  }
  const a: Assessment = { goal, sim, last, met, progress, econ, ev, revTen, spTen, revenueShare, crossesRules, shares, efficiency };
  cache.set(key, a);
  return a;
}
