import { budget, debt, POP } from '../data';
import { dateLabel, dollars, moneyWords } from '../lib/format';
import { useLive } from '../lib/live';
import { Tick, useDebtClock } from './DebtClock';

// This fiscal year's federal deficit, running: what Uncle Sam has spent since Oct. 1, what he has
// taken in, and the gap between them. It starts from the Treasury's Monthly Treasury Statement
// (the latest month of this fiscal year, when there is one; otherwise zero on Oct. 1) and adds
// the past twelve months' pace, second by second. Every part says where it comes from, and the
// ticking is labeled as an estimate. The ticking itself is the debt clock's (one shared clock).

const YEAR = 365 * 24 * 3600;
// Fiscal years start Oct. 1, Eastern time; a month's count is as of the end of its last day.
const fyStart = (fy: number) => Date.parse(`${fy - 1}-10-01T00:00:00-04:00`);
const endOfDay = (date: string) => Date.parse(`${date}T23:59:59-05:00`);
const fyOf = (d: Date) => d.getUTCFullYear() + (d.getUTCMonth() >= 9 ? 1 : 0);

export function useDeficitClock(now = new Date()) {
  const live = useLive();
  const fy = fyOf(now);
  // The past twelve months, for the pace.
  const last12 = budget.monthly.slice(-12);
  const spendYear = last12.reduce((s, m) => s + m.outlays, 0);
  const revYear = last12.reduce((s, m) => s + m.receipts, 0);
  const paceThrough = last12.at(-1)?.date ?? budget.mtsLatestDate;
  // Where this fiscal year stands in the Treasury's own count, if it has reported a month yet.
  const counted = live.mts && live.mts.fy === fy
    ? { through: live.mts.date, spend: live.mts.outlaysFYTD, rev: live.mts.receiptsFYTD, live: true }
    : budget.partialFY && budget.partialFY.fy === fy
      ? { through: budget.partialFY.through, spend: budget.partialFY.outlays, rev: budget.partialFY.receipts, live: false }
      : null;
  const t0 = counted ? endOfDay(counted.through) : fyStart(fy);
  const secs = (t: number) => Math.max(0, (t - t0) / 1000);
  const spendAt = (t: number) => (counted?.spend ?? 0) + (spendYear / YEAR) * secs(t);
  const revAt = (t: number) => (counted?.rev ?? 0) + (revYear / YEAR) * secs(t);
  const deficitAt = (t: number) => spendAt(t) - revAt(t);
  const deficitYear = spendYear - revYear;
  const gross = debt.interestByFY.at(-1)!;
  return { fy, counted, paceThrough, spendYear, revYear, deficitYear, perPersonYear: deficitYear / POP, interestYear: gross.gross, interestFY: gross.fy, spendAt, revAt, deficitAt };
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
        <div><dt>Every person’s share of the deficit</dt><dd>{dollars(c.deficitYear / POP)}</dd></div>
        <div><dt>The debt grows by</dt><dd>{moneyWords(d.perYear, 2)}</dd></div>
        <div><dt>Interest costs</dt><dd>{moneyWords(d.interestPerYear, 2)}</dd></div>
      </dl>
      <p className="small muted deficit-src">
        {c.counted ? `Treasury’s count through ${dateLabel(c.counted.through)}${c.counted.live ? ' (fetched live)' : ''}, then` : `Since Oct. 1: no monthly count yet this year, so`} an estimate at the pace of the past 12 months (through {dateLabel(c.paceThrough)}). Interest: FY{d.interestFY}, gross. <a href="#clock">The debt clock</a>
      </p>
    </section>
  );
}
