import { budget, debt, dts as bakedDts, POP } from '../data';
import type { TreasuryDay } from '../lib/dts';
import { dateLabel, dollars, moneyWords } from '../lib/format';
import { useLive } from '../lib/live';
import { Tick, useDebtClock } from './DebtClock';

// This fiscal year's federal deficit, running: what Uncle Sam has spent since Oct. 1, what he has
// taken in, and the gap between them. It starts from what the Treasury has counted so far this
// year, then adds the past twelve months' pace, second by second, from the end of that count.
//
// The count: the official Monthly Treasury Statement for each month it has published; after that,
// the Treasury's daily figures. A deficit is paid for by borrowing, so the deficit since a given
// day is about the new borrowing from the public (Debt to the Penny) less the cash that borrowing
// added to the Treasury's account (Daily Treasury Statement). Tried on fiscal 2026, that came
// within $15 to $27 billion of the official count at the end of October, November, December and
// March. Revenue is the cash deposited without borrowing, put on the official footing with last
// year's two counts; spending is revenue plus the deficit. Spreading last year's total evenly over
// the calendar instead would miss how lopsided the year is: about $346 billion of fiscal 2027's
// deficit came in October alone. Every part says where it comes from, and the ticking is labeled
// as an estimate. The ticking itself is the debt clock's (one shared clock).

const YEAR = 365 * 24 * 3600;
// Fiscal years start Oct. 1, Eastern time; a month's count is as of the end of its last day.
const fyStart = (fy: number) => Date.parse(`${fy - 1}-10-01T00:00:00-04:00`);
const endOfDay = (date: string) => Date.parse(`${date}T23:59:59-05:00`);
const fyOf = (d: Date) => d.getUTCFullYear() + (d.getUTCMonth() >= 9 ? 1 : 0);
const DAY = 86400000;

export interface DeficitCount { through: string; spend: number; rev: number; basis: 'mts' | 'daily' | 'mts+daily'; monthThrough?: string; live: boolean }
/**
 * Where this fiscal year stands in the Treasury's own counts: the monthly statement (`mts`), and
 * the daily figures (`day`) measured from a starting day (`from`: last fiscal year's final day, or
 * the last day `mts` covers). `last` is last year's official totals, and `yearEnd` the daily
 * figures on its final day, which together put daily deposits on the official footing.
 */
export function deficitCount(fy: number, o: {
  mts: { through: string; spend: number; rev: number; live: boolean } | null;
  day: (TreasuryDay & { live: boolean }) | null;
  monthEnd: TreasuryDay | null;
  yearEnd: TreasuryDay | undefined;
  last: { fy: number; receipts: number; outlays: number } | undefined;
}): DeficitCount | null {
  const { mts, monthEnd, yearEnd, last } = o;
  const day = o.day && o.day.fy === fy ? o.day : null;
  if (mts && (!day || day.date <= mts.through)) return { ...mts, basis: 'mts' };
  if (!day || !yearEnd || yearEnd.fy !== fy - 1) return null;
  const revRatio = last && last.fy === yearEnd.fy ? last.receipts / yearEnd.deposits : null;
  if (!revRatio) return null;
  // New borrowing from the public, less the cash it added to the Treasury's account.
  const since = (from: TreasuryDay) => (day.debtHeldPublic - from.debtHeldPublic) - (day.cash - from.cash);
  if (mts && monthEnd && monthEnd.fy === fy) {
    const rev = mts.rev + (day.deposits - monthEnd.deposits) * revRatio;
    const deficit = (mts.spend - mts.rev) + since(monthEnd);
    return { through: day.date, rev, spend: rev + deficit, basis: 'mts+daily', monthThrough: mts.through, live: day.live };
  }
  const rev = day.deposits * revRatio;
  const deficit = since(yearEnd);
  return { through: day.date, rev, spend: rev + deficit, basis: 'daily', live: day.live };
}

export function useDeficitClock(now = new Date()) {
  const live = useLive();
  const fy = fyOf(now);
  // The past twelve months, for the pace.
  const last12 = budget.monthly.slice(-12);
  const spendYear = last12.reduce((s, m) => s + m.outlays, 0);
  const revYear = last12.reduce((s, m) => s + m.receipts, 0);
  const paceThrough = last12.at(-1)?.date ?? budget.mtsLatestDate;
  // Where this fiscal year stands in the Treasury's own counts (monthly, then daily).
  const mts = live.mts && live.mts.fy === fy
    ? { through: live.mts.date, spend: live.mts.outlaysFYTD, rev: live.mts.receiptsFYTD, live: true }
    : budget.partialFY && budget.partialFY.fy === fy
      ? { through: budget.partialFY.through, spend: budget.partialFY.outlays, rev: budget.partialFY.receipts, live: false }
      : null;
  const day = live.day && live.day.date >= bakedDts.latest.date ? { ...live.day, live: true } : { ...bakedDts.latest, live: false };
  const monthEnd = mts ? (bakedDts.monthEnds.find((m) => m.month === mts.through) ?? live.dayMonthEnd ?? null) : null;
  const counted = deficitCount(fy, { mts, day, monthEnd, yearEnd: bakedDts.start, last: budget.annual.at(-1) });
  const t0 = counted ? endOfDay(counted.through) : fyStart(fy);
  const secs = (t: number) => Math.max(0, (t - t0) / 1000);
  const spendAt = (t: number) => (counted?.spend ?? 0) + (spendYear / YEAR) * secs(t);
  const revAt = (t: number) => (counted?.rev ?? 0) + (revYear / YEAR) * secs(t);
  const deficitAt = (t: number) => spendAt(t) - revAt(t);
  const deficitYear = spendYear - revYear;
  const gross = debt.interestByFY.at(-1)!;
  return { fy, counted, paceThrough, spendYear, revYear, deficitYear, perPersonYear: deficitYear / POP, interestYear: gross.gross, interestFY: gross.fy, spendAt, revAt, deficitAt, lastFY: budget.annual.at(-1) };
}

/** The menu's widget: the deficit in red, spending in blue and revenue in green beside it. */
export function DeficitClock() {
  const c = useDeficitClock();
  // A year at a time, the same figures as the debt clock: each person's share of the deficit, a year's new debt, and the interest bill.
  const d = useDebtClock();
  return (
    <section className="card deficit" aria-label={`The federal deficit, fiscal year ${c.fy} so far`}>
      <div className="deficit-head">
        <span className="clock-label"><span className="clock-dot" aria-hidden="true" /> The federal deficit, FY{c.fy} so far</span>
        <a className="small" href="#gap">What’s a deficit?</a>
      </div>
      <div className="deficit-num" aria-hidden="true"><Tick value={c.deficitAt} /></div>
      <div className="deficit-sides" aria-hidden="true">
        <span className="deficit-side" data-kind="spend"><span className="deficit-k">Spending</span><Tick value={c.spendAt} /></span>
        <span className="deficit-side" data-kind="rev"><span className="deficit-k">Revenue</span><Tick value={c.revAt} /></span>
      </div>
      <p className="sr-only">So far this fiscal year, the government has spent about {moneyWords(c.spendAt(Date.now()), 2)} and taken in about {moneyWords(c.revAt(Date.now()), 2)}, a deficit of about {moneyWords(c.deficitAt(Date.now()), 2)}.</p>
      <div className="deficit-yearhead">Each year, at the past 12 months’ pace</div>
      <dl className="deficit-year">
        <div><dt>The deficit{c.lastFY && c.paceThrough === `${c.lastFY.fy}-09-30` ? ` (all of FY${c.lastFY.fy})` : ''}</dt><dd>{moneyWords(c.deficitYear, 2)}</dd></div>
        <div><dt>Every person’s share of the deficit</dt><dd>{dollars(c.deficitYear / POP)}</dd></div>
        <div><dt>The debt grows by</dt><dd>{moneyWords(d.perYear, 2)}</dd></div>
        <div><dt>Interest costs</dt><dd>{moneyWords(d.interestPerYear, 2)}</dd></div>
      </dl>
      <p className="small muted deficit-src">
        {!c.counted ? 'Since Oct. 1: no count from the Treasury yet this year, so'
          : c.counted.basis === 'mts' ? `Treasury’s monthly statement through ${dateLabel(c.counted.through)}${c.counted.live ? ' (fetched live)' : ''}, then`
          : c.counted.basis === 'mts+daily' ? `Treasury’s monthly statement through ${dateLabel(c.counted.monthThrough!)}, then its daily figures through ${dateLabel(c.counted.through)}${c.counted.live ? ' (fetched live)' : ''} (new borrowing less the cash it added), then`
          : `Treasury’s daily figures through ${dateLabel(c.counted.through)}${c.counted.live ? ' (fetched live)' : ''} (new borrowing from the public less the cash it added), then`} an estimate at the pace of the past 12 months (through {dateLabel(c.paceThrough)}). Interest: FY{d.interestFY}, gross. <a href="#clock">The debt clock</a>
      </p>
    </section>
  );
}
