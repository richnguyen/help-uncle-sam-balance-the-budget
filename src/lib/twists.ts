import { budget, cbo, debt } from '../data';
import type { Goal } from './plan';
import type { Shock } from './sandbox';

// Each budget desk after the first changes in kind, not only in size. Mission 2.7 adds a rate
// shock: the average rate on the debt jumps the way it did from 2022 to 2023, on top of the
// projection, so interest eats more of the budget and savings made early count for more. Mission
// 3.5 adds a recession in the first year, as deep in revenue as 2001's, and tightening in that
// year counts double on the economy gauge, so phasing in pays. Both are computed from the game's
// own data (Treasury's average interest rates; the historical budget totals), and the desk says
// so in one line.

export interface Twist {
  id: 'rates' | 'recession';
  /** The one line that states the twist (opening its info sheet on the scoreboard). */
  line: string;
  /** A few words for the scoreboard's twist chip. */
  short: string;
  /** What Uncle Sam adds to his opening line. */
  say: string;
  /** What the twist does to the model, for "How this is rated". */
  method: string;
  /** What the twist leaves out. */
  leaves: string;
  sources: string[];
  shock: Shock;
}

/** The desk's first projection year (the desks start after the latest full fiscal year). */
const first = budget.latestFY + 1;

// --- Rates: the largest one-year rise in the Treasury's average rate on its debt (September to
// September). A bigger, multi-year rise (2021 to 2024) made the desk all but impossible to win
// within the game's protections, so the desk uses the largest single year.
const sept = debt.rates.filter((r) => r.date.slice(5, 7) === '09').map((r) => ({ y: Number(r.date.slice(0, 4)), v: r.total }));
const RISE = sept.slice(0, -1).map((r, i) => ({ from: r, to: sept[i + 1], up: sept[i + 1].v - r.v })).sort((a, b) => b.up - a.up)[0];
export const RATE_SHOCK = { points: +RISE.up.toFixed(2), from: RISE.from, to: RISE.to };

// --- Recession: revenue's fall from FY2001 to FY2002, as a share of the year before.
const rev = (fy: number) => cbo.history.find((h) => h.fy === fy)!.revenues;
export const RECESSION = { fy: 2002, dip: +(1 - rev(2002) / rev(2001)).toFixed(3) };

const pct1 = (v: number) => `${+(v * 100).toFixed(1)}%`;

export const TWISTS: Partial<Record<Goal, Twist>> = {
  deficit3: {
    id: 'rates',
    short: `Rates +${RATE_SHOCK.points.toFixed(1)} pts`,
    line: `Interest rates jump: the rate on the debt rises ${RATE_SHOCK.points.toFixed(1)} points, as it did from ${RATE_SHOCK.from.y} to ${RATE_SHOCK.to.y}, and stays there. Savings that start early count for more.`,
    say: `And a twist: interest rates are jumping, the way they did from ${RATE_SHOCK.from.y} to ${RATE_SHOCK.to.y}. Savings that start early count for more.`,
    method: `On top of the rates in the projection the desk uses (${cbo.projShort}), the average rate on the debt is ${RATE_SHOCK.points.toFixed(2)} percentage points higher from the first year on. That’s the largest one-year rise in the Treasury’s average rate on its debt since 2001 (${RATE_SHOCK.from.v.toFixed(2)}% in September ${RATE_SHOCK.from.y} to ${RATE_SHOCK.to.v.toFixed(2)}% in September ${RATE_SHOCK.to.y}).`,
    leaves: 'What would cause the jump, and any effect it would have on the rest of the economy.',
    sources: ['rates', cbo.baselineSourceId],
    shock: { rateUp: Array(10).fill(RATE_SHOCK.points) },
  },
  balance: {
    id: 'recession',
    short: `Recession FY${String(first).slice(2)}`,
    line: `A recession hits in FY${first}: revenue falls ${pct1(RECESSION.dip)}, as it did in FY2002, and tightening that year hits the economy twice as hard. Phasing in pays.`,
    say: `And a twist: a recession hits in FY${first}, like the one in 2001. Squeeze hard that year and it hurts twice as much, so phase your changes in.`,
    method: `In FY${first}, revenue is ${pct1(RECESSION.dip)} below the projection (${cbo.projShort}), the fall from FY2001 to FY2002 in the historical tables, and half that the next year. On the economy gauge, the tightening in that year counts double, because CBO finds that changes in taxes and spending move the economy more when it’s weak.`,
    leaves: 'The extra spending on unemployment benefits and other programs that grows in a recession, and any lasting effect of the recession on later years.',
    sources: [cbo.historySourceId, 'cbo-multiplier-wp'],
    shock: { revenueDip: [RECESSION.dip, RECESSION.dip / 2], slump: 0 },
  },
};

export const twistFor = (goal: Goal | undefined) => (goal ? TWISTS[goal] : undefined);
export const shockFor = (goal: Goal | undefined) => twistFor(goal)?.shock;
