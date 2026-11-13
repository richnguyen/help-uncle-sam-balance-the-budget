import type { CBOYear } from '../data/types';

// A simple, transparent multi-year model on top of the official projection.
// Each lever is a percentage change applied to that category; specific policy options add dollar
// amounts by year. Net interest is re-estimated from the change in debt: interest_t scales with
// debt_{t-1}, using the interest rates implied by the projection.
export const LEVERS = [
  { id: 'revenues', label: 'All tax revenue', color: 'var(--c-emph)', min: -20, max: 30 },
  { id: 'socialSecurity', label: 'Social Security', color: 'var(--c-ss)', min: -30, max: 15 },
  { id: 'medicare', label: 'Medicare', color: 'var(--c-medicare)', min: -30, max: 15 },
  { id: 'medicaid', label: 'Medicaid', color: 'var(--c-health)', min: -40, max: 15 },
  { id: 'otherMandatory', label: 'Other mandatory', color: 'var(--c-income)', min: -40, max: 20 },
  { id: 'defense', label: 'Defense', color: 'var(--c-defense)', min: -50, max: 30 },
  { id: 'nondefense', label: 'Non-defense discretionary', color: 'var(--c-other)', min: -50, max: 30 },
] as const;

export type LeverId = (typeof LEVERS)[number]['id'];
export type Levers = Record<LeverId, number>; // percent
export type Extra = Partial<Record<LeverId, number[]>>; // $ of deficit reduction by projection year

export const ZERO: Levers = { revenues: 0, socialSecurity: 0, medicare: 0, medicaid: 0, otherMandatory: 0, defense: 0, nondefense: 0 };

export const SPENDING_LEVERS: LeverId[] = ['socialSecurity', 'medicare', 'medicaid', 'otherMandatory', 'defense', 'nondefense'];

/** Years over which a change is phased in when phasing is on (1/3, 2/3, then full). */
export const PHASE_YEARS = 3;
export const ramp = (i: number, on: boolean) => (on ? Math.min(1, (i + 1) / PHASE_YEARS) : 1);

export interface SimYear {
  fy: number;
  revenues: number;
  programs: number;
  interest: number;
  deficit: number;
  debt: number;
  gdp: number;
  /** Policy deficit reduction this year from levers and options, before interest savings. */
  policy: number;
  /** Of which from revenue increases. */
  policyRevenue: number;
}

/**
 * A desk's twist (see twists.ts): rates on the debt above CBO's projection (percentage points, by
 * year), and revenue below it in a recession (a share of the projection, by year).
 */
export interface Shock { rateUp?: number[]; revenueDip?: number[]; slump?: number }

export function simulate(baseline: CBOYear[], startDebt: number, lv: Levers, opts: { phaseIn?: boolean; extra?: Extra; shock?: Shock } = {}): SimYear[] {
  const out: SimYear[] = [];
  let debt = startDebt;
  let baseDebtPrev = startDebt;
  baseline.forEach((b, i) => {
    const r = ramp(i, !!opts.phaseIn);
    const f = (k: LeverId) => 1 + (lv[k] / 100) * r;
    const ex = (k: LeverId) => opts.extra?.[k]?.[i] ?? 0;
    const dip = opts.shock?.revenueDip?.[i] ?? 0;
    const revenues = b.revenues * (f('revenues') - dip) + ex('revenues');
    const programs =
      b.socialSecurity * f('socialSecurity') + b.medicare * f('medicare') + b.medicaid * f('medicaid') +
      b.otherMandatory * f('otherMandatory') + b.defense * f('defense') + b.nondefense * f('nondefense') -
      SPENDING_LEVERS.reduce((s, k) => s + ex(k), 0);
    const baseProgramsTotal = b.socialSecurity + b.medicare + b.medicaid + b.otherMandatory + b.defense + b.nondefense;
    // Higher rates apply to the whole debt at the start of the year, on top of CBO's projected rates.
    const interest = b.netInterest * (baseDebtPrev > 0 ? debt / baseDebtPrev : 1) + debt * ((opts.shock?.rateUp?.[i] ?? 0) / 100);
    const deficit = programs + interest - revenues;
    // The projection's debt changes by slightly more or less than its deficit (student loans,
    // cash balance); carry that "other means of financing" through so the baseline reproduces.
    const otherFinancing = b.debtPublic - baseDebtPrev - b.deficit;
    debt = debt + deficit + otherFinancing;
    baseDebtPrev = b.debtPublic;
    const policyRevenue = revenues - b.revenues * (1 - dip); // what the plan raises, not the recession
    out.push({ fy: b.fy, revenues, programs, interest, deficit, debt, gdp: b.gdp, policy: policyRevenue + (baseProgramsTotal - programs), policyRevenue });
  });
  return out;
}

/** Uniform % change in a set of levers needed to balance the budget in the final year (bisection). */
export function solveBalance(baseline: CBOYear[], startDebt: number, ids: LeverId[], sign: 1 | -1): number | null {
  let lo = 0;
  let hi = 100;
  const at = (x: number) => {
    const lv = { ...ZERO };
    for (const id of ids) lv[id] = sign * x;
    return simulate(baseline, startDebt, lv).at(-1)!.deficit;
  };
  if (at(hi) > 0) return null;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) > 0) lo = mid;
    else hi = mid;
  }
  return hi;
}
