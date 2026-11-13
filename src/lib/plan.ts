import type { CBOYear } from '../data/types';
import { type Extra, type Levers, type LeverId, ramp, simulate, type SimYear, SPENDING_LEVERS } from './sandbox';

// ---------------------------------------------------------------------------------------------
// Policy options (CBO, Options for Reducing the Deficit) and the "economists' plan" optimizer.
//
// The optimizer follows widely used principles for reducing deficits without undue harm to the
// economy (sources on the page):
//  1. Aim to stop the debt from growing faster than the economy (stabilize debt-to-GDP) rather
//     than force an immediate balance.
//  2. Phase changes in gradually so the economy can adjust.
//  3. Prefer the options with the smallest short-run drag on output per dollar saved, using
//     CBO's ranges of output multipliers by type of policy, adjusted for long-run growth effects.
//  4. Use a mix of revenue and spending changes.
//  5. Protect current retirees, programs for low-income families, and public investment.
// ---------------------------------------------------------------------------------------------

export interface PolicyOption {
  id: string;
  name: string;
  cboTitle: string;
  variant?: string;
  side: 'revenue' | 'spending';
  lever: LeverId;
  savings10: number; // $ billions over ten years
  affects: string;
  /** Who gains from it, beyond the lower borrowing every saving brings (our summary of CBO's case for it). */
  benefits: string;
  summary: string;
  obbbaNote?: string;
  source: { title: string; url: string };
}

export interface Principle { id: string; claim: string; detail?: string; source: { title: string; url: string } }

export interface OptionsData {
  volume: { title: string; published: string; url: string };
  options: PolicyOption[];
  principles: Principle[];
}

/** CBO's ranges of output multipliers (effect on GDP per dollar of budgetary change). */
export const MULT = {
  corporate: { label: 'Business taxes', lo: 0, hi: 0.4 },
  taxHigh: { label: 'Taxes on higher-income people', lo: 0.1, hi: 0.6 },
  taxBroad: { label: 'Taxes on low- and middle-income people', lo: 0.3, hi: 1.5 },
  transfersStates: { label: 'Aid to state governments', lo: 0.4, hi: 1.8 },
  stateInfra: { label: 'Aid to states for infrastructure', lo: 0.4, hi: 2.2 },
  transfersPersons: { label: 'Payments to people', lo: 0.4, hi: 2.1 },
  purchases: { label: 'Government purchases', lo: 0.5, hi: 2.5 },
} as const;
export type MultClass = keyof typeof MULT;
export const mid = (c: MultClass) => (MULT[c].lo + MULT[c].hi) / 2;

export type Tag = 'retirees' | 'lowIncome' | 'investment' | 'beneficiaries';
export interface Econ {
  cls: MultClass;
  /** Long-run growth effect: 1 helps (fixes a distortion or harmful activity), -1 hurts, 0 neutral. */
  growth: -1 | 0 | 1;
  tags: Tag[];
  why: string;
}

/** Score: lower is less harmful per dollar saved. Midpoint multiplier, adjusted for long-run growth. */
export const GROWTH_WEIGHT = 0.3;
export const score = (e: Econ) => mid(e.cls) - GROWTH_WEIGHT * e.growth;

export const LEVER_CLASS: Record<LeverId, MultClass> = {
  revenues: 'taxBroad',
  socialSecurity: 'transfersPersons',
  medicare: 'transfersPersons',
  medicaid: 'transfersStates',
  otherMandatory: 'transfersPersons',
  defense: 'purchases',
  nondefense: 'purchases',
};

export type Goal = 'stabilize' | 'deficit3' | 'balance';
export const GOALS: { id: Goal; label: string; blurb: string }[] = [
  { id: 'stabilize', label: 'Stop the debt from outgrowing the economy', blurb: 'Debt held by the public no higher, as a share of GDP, than it is today. This is the goal most economists use.' },
  { id: 'deficit3', label: 'Cut the deficit to 3% of GDP', blurb: 'A common benchmark that would put debt on a slowly falling path relative to the economy.' },
  { id: 'balance', label: 'Balance the budget', blurb: 'No deficit at all in the final year. Requires much larger and faster changes.' },
];

export interface Protect { retirees: boolean; lowIncome: boolean; investment: boolean }

export interface PlanContext {
  baseline: CBOYear[];
  startDebt: number;
  startRatio: number; // debt / GDP at the start
  options: (PolicyOption & { econ: Econ })[];
}

/** Ten-year GDP path from the first projection year (extends past the projection at its last growth rate). */
function tenYearGDP(baseline: CBOYear[]) {
  const g = baseline.map((b) => b.gdp);
  const growth = g.length > 1 ? g.at(-1)! / g.at(-2)! : 1.04;
  while (g.length < 10) g.push(g.at(-1)! * growth);
  return g.slice(0, 10);
}

/**
 * Spread each option's ten-year CBO estimate over the ten years starting with the first projection
 * year, in proportion to GDP (a constant share of the economy), phased in when `gradual` is on.
 * The ten-year total always equals CBO's estimate.
 */
export function optionPath(o: PolicyOption, baseline: CBOYear[], gradual: boolean): number[] {
  const g = tenYearGDP(baseline);
  const w = g.map((x, i) => x * ramp(i, gradual));
  const W = w.reduce((s, x) => s + x, 0);
  return w.slice(0, baseline.length).map((x) => (o.savings10 * 1e9 * x) / W);
}

export function extraFor(ids: string[], ctx: PlanContext, gradual: boolean): Extra {
  const extra: Extra = {};
  for (const o of ctx.options) {
    if (!ids.includes(o.id)) continue;
    const p = optionPath(o, ctx.baseline, gradual);
    const cur = extra[o.lever] ?? new Array(ctx.baseline.length).fill(0);
    extra[o.lever] = cur.map((v, i) => v + p[i]);
  }
  return extra;
}

export function goalMet(goal: Goal, sim: SimYear[], startRatio: number) {
  const last = sim.at(-1)!;
  if (goal === 'balance') return last.deficit <= 0;
  if (goal === 'deficit3') return last.deficit / last.gdp <= 0.03;
  return last.debt / last.gdp <= startRatio + 1e-9;
}

/** How far the plan is from the goal in the final year, in dollars (0 when met). */
export function goalGap(goal: Goal, sim: SimYear[], startRatio: number) {
  const last = sim.at(-1)!;
  if (goal === 'balance') return Math.max(0, last.deficit);
  if (goal === 'deficit3') return Math.max(0, last.deficit - 0.03 * last.gdp);
  return Math.max(0, last.debt - startRatio * last.gdp);
}

export interface EconSummary {
  /** Largest year-over-year tightening, as a share of GDP. */
  peakStep: number;
  /** Largest estimated short-run reduction in GDP, as a share of GDP (low / mid / high). */
  drag: { lo: number; mid: number; hi: number };
  rating: 'gentle' | 'moderate' | 'steep';
}

/** Short-run economic effects: size of each year's tightening and CBO-multiplier drag on output. */
export function economics(ctx: PlanContext, ids: string[], lv: Levers, gradual: boolean): EconSummary {
  const n = ctx.baseline.length;
  const tight = new Array(n).fill(0);
  const dLo = new Array(n).fill(0);
  const dMid = new Array(n).fill(0);
  const dHi = new Array(n).fill(0);
  const add = (i: number, dollars: number, c: MultClass) => {
    tight[i] += dollars;
    dLo[i] += dollars * MULT[c].lo;
    dMid[i] += dollars * mid(c);
    dHi[i] += dollars * MULT[c].hi;
  };
  for (const o of ctx.options) {
    if (!ids.includes(o.id)) continue;
    optionPath(o, ctx.baseline, gradual).forEach((v, i) => add(i, v, o.econ.cls));
  }
  ctx.baseline.forEach((b, i) => {
    const r = ramp(i, gradual);
    const rev = (b.revenues * lv.revenues) / 100 * r;
    add(i, rev, LEVER_CLASS.revenues);
    for (const k of SPENDING_LEVERS) add(i, (-(b[k] as number) * lv[k]) / 100 * r, LEVER_CLASS[k]);
  });
  let peakStep = 0;
  let prev = 0;
  const peak = { lo: 0, mid: 0, hi: 0 };
  ctx.baseline.forEach((b, i) => {
    const t = tight[i] / b.gdp;
    peakStep = Math.max(peakStep, t - prev);
    prev = t;
    peak.lo = Math.max(peak.lo, dLo[i] / b.gdp);
    peak.mid = Math.max(peak.mid, dMid[i] / b.gdp);
    peak.hi = Math.max(peak.hi, dHi[i] / b.gdp);
  });
  const rating = peakStep <= 0.005 ? 'gentle' : peakStep <= 0.01 ? 'moderate' : 'steep';
  return { peakStep, drag: peak, rating };
}

export interface OptimizeResult {
  ids: string[];
  met: boolean;
  sim: SimYear[];
  revenueShare: number;
  steps: { id: string; reason: string }[];
  mixRelaxed?: boolean;
}

export const allowed = (o: PlanContext['options'][number], p: Protect) =>
  !(p.retirees && o.econ.tags.includes('retirees')) &&
  !(p.lowIncome && o.econ.tags.includes('lowIncome')) &&
  !(p.investment && o.econ.tags.includes('investment'));

/** Unclamped distance from the goal in the final year, in dollars (negative = goal beaten). */
export function shortfall(goal: Goal, sim: SimYear[], startRatio: number) {
  const last = sim.at(-1)!;
  if (goal === 'balance') return last.deficit;
  if (goal === 'deficit3') return last.deficit - 0.03 * last.gdp;
  return last.debt - startRatio * last.gdp;
}

/**
 * The economists' plan: among the options allowed by the ground rules, find the combination with
 * the smallest total economic cost (score x ten-year dollars) that meets the goal and keeps at
 * least `minShare` of the savings on each side (revenue and spending). Solved exactly by branch
 * and bound, using each option's measured contribution to the goal, then checked with the full
 * model. If no combination meets the goal, the plan uses every allowed option.
 */
export function optimize(ctx: PlanContext, goal: Goal, protect: Protect, gradual: boolean, minShare = 1 / 3, lv?: Levers): OptimizeResult {
  const levers = lv ?? ({ revenues: 0, socialSecurity: 0, medicare: 0, medicaid: 0, otherMandatory: 0, defense: 0, nondefense: 0 } as Levers);
  const run = (ids: string[]) => simulate(ctx.baseline, ctx.startDebt, levers, { phaseIn: gradual, extra: extraFor(ids, ctx, gradual) });
  const pool = ctx.options.filter((o) => allowed(o, protect));
  const short0 = shortfall(goal, run([]), ctx.startRatio);
  const shares = (ids: string[]) => {
    const sel = ctx.options.filter((o) => ids.includes(o.id));
    const rev = sel.filter((o) => o.side === 'revenue').reduce((s, o) => s + o.savings10, 0);
    const tot = sel.reduce((s, o) => s + o.savings10, 0);
    return tot ? rev / tot : 0;
  };
  if (short0 <= 0) return { ids: [], met: true, sim: run([]), revenueShare: 0, steps: [] };

  const items = pool.map((o) => ({
    o,
    contrib: short0 - shortfall(goal, run([o.id]), ctx.startRatio),
    cost: Math.max(0.01, score(o.econ)) * o.savings10,
  })).filter((x) => x.contrib > 0).sort((a, b) => a.cost / a.contrib - b.cost / b.contrib);
  const suffix = items.map((_, i) => items.slice(i).reduce((s, x) => s + x.contrib, 0));

  const solve = (share: number) => {
    let best: { cost: number; pick: number[] } | null = null;
    const pick: number[] = [];
    let nodes = 0;
    const dfs = (i: number, cost: number, contrib: number, rev: number, tot: number) => {
      if (++nodes > 400000) return;
      if (best && cost >= best.cost) return;
      if (contrib >= short0) {
        const r = tot ? rev / tot : 0;
        if (r >= share - 1e-9 && 1 - r >= share - 1e-9) { best = { cost, pick: [...pick] }; return; }
      }
      if (i >= items.length || contrib + suffix[i] < short0) return;
      const it = items[i];
      pick.push(i);
      dfs(i + 1, cost + it.cost, contrib + it.contrib, rev + (it.o.side === 'revenue' ? it.o.savings10 : 0), tot + it.o.savings10);
      pick.pop();
      dfs(i + 1, cost, contrib, rev, tot);
    };
    dfs(0, 0, 0, 0, 0);
    return best as { cost: number; pick: number[] } | null;
  };

  let found = solve(minShare);
  let mixRelaxed = false;
  if (!found && minShare > 0) { found = solve(0); mixRelaxed = !!found; }
  let ids = found ? found.pick.map((i) => items[i].o.id) : pool.map((o) => o.id);
  let sim = run(ids);
  // Contributions are measured one option at a time; if interactions leave a small gap, add the
  // next most efficient unused option until the full model confirms the goal.
  for (const it of items) {
    if (goalMet(goal, sim, ctx.startRatio)) break;
    if (ids.includes(it.o.id)) continue;
    ids = [...ids, it.o.id];
    sim = run(ids);
  }
  const met = goalMet(goal, sim, ctx.startRatio);
  const steps = ids.map((id) => ({ id, reason: mixRelaxed ? 'mix relaxed: no allowed combination met both the goal and the mix rule' : 'part of the least-cost combination' }));
  return { ids, met, sim, revenueShare: shares(ids), steps, mixRelaxed };
}

/** Total economic cost of a set of options: harm per dollar times ten-year dollars (as in optimize). */
export function planCost(ctx: PlanContext, ids: string[]) {
  return ctx.options.filter((o) => ids.includes(o.id)).reduce((s, o) => s + Math.max(0.01, score(o.econ)) * o.savings10, 0);
}
