// The Treasury's daily figures for this fiscal year, so the main menu's deficit counter starts from
// what has actually happened, day by day, instead of spreading last year's total evenly over the
// calendar (October alone can be a sixth of a year's deficit).
//
// For a day, it keeps: the debt held by the public (Debt to the Penny); the cash in the Treasury
// General Account at the day's close; and the fiscal-year-to-date cash deposited into that account,
// leaving out money borrowed (public debt cash issues), from the Daily Treasury Statement. The
// deficit so far is about the new borrowing from the public less the cash it added to the
// account; revenue comes from the deposits (see DeficitClock.tsx). It keeps the same figures for
// the last day of last fiscal year (the starting point), the last day of each month this year
// (to join the official Monthly Treasury Statement once that month is published), and last year's
// year-end deposits (to put deposits on the monthly statement's footing).
//
// Writes src/data/generated/dts.json. Run with `npm run dts` (in this sandbox, with
// NODE_USE_ENV_PROXY=1). A failed fetch leaves the file in the repo as it was.
import { writeFileSync } from 'node:fs';

const API = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';
const OUT = new URL('../src/data/generated/dts.json', import.meta.url);

async function get(path) {
  const r = await fetch(API + path, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`${r.status} for ${path}`);
  return (await r.json()).data ?? [];
}
const onOrBefore = (date) => `filter=record_date:lte:${date}&sort=-record_date`;

/** Deposits so far this fiscal year, without borrowing, from Table II (amounts in millions). */
async function deposits(date) {
  const rows = await get(`/v1/accounting/dts/deposits_withdrawals_operating_cash?fields=record_date,record_fiscal_year,account_type,transaction_type,transaction_catg,transaction_fytd_amt&${onOrBefore(date)}&page%5Bsize%5D=400`);
  const day = rows[0].record_date;
  let dep = 0;
  for (const r of rows) {
    if (r.record_date !== day || r.account_type !== 'Treasury General Account (TGA)' || r.transaction_type !== 'Deposits') continue;
    if (/^Public Debt Cash/i.test(r.transaction_catg ?? '')) continue;
    dep += Number(r.transaction_fytd_amt) * 1e6;
  }
  return { date: day, fy: Number(rows[0].record_fiscal_year), deposits: dep };
}
/** The account's closing balance that day (Table I, in millions). */
async function cash(date) {
  const rows = await get(`/v1/accounting/dts/operating_cash_balance?fields=record_date,account_type,open_today_bal&${onOrBefore(date)}&page%5Bsize%5D=10`);
  const r = rows.find((x) => x.record_date === rows[0].record_date && /Closing Balance/i.test(x.account_type));
  return { date: r.record_date, cash: Number(r.open_today_bal) * 1e6 };
}
async function debtHeld(date) {
  const rows = await get(`/v2/accounting/od/debt_to_penny?fields=record_date,debt_held_public_amt&${onOrBefore(date)}&page%5Bsize%5D=1`);
  return { date: rows[0].record_date, debtHeldPublic: Number(rows[0].debt_held_public_amt) };
}
/** All three on one day: the latest day on or before `date` that has all three. */
async function dayOf(date) {
  for (let d = date, k = 0; k < 6; k++) {
    const [a, b, c] = await Promise.all([deposits(d), cash(d), debtHeld(d)]);
    if (a.date === b.date && b.date === c.date) return { date: a.date, fy: a.fy, deposits: a.deposits, cash: b.cash, debtHeldPublic: c.debtHeldPublic };
    d = [a.date, b.date, c.date].sort()[0]; // step back to the earliest of the three and try again
  }
  throw new Error('no day with all three figures near ' + date);
}

const today = new Date().toISOString().slice(0, 10);
const latest = await dayOf(today);
const start = await dayOf(`${latest.fy - 1}-09-30`); // last fiscal year's final day: this year starts from it
const monthEnds = [];
for (let m = new Date(Date.UTC(latest.fy - 1, 9, 1)); ; m.setUTCMonth(m.getUTCMonth() + 1)) {
  const end = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  if (end >= latest.date) break;
  monthEnds.push({ month: end, ...(await dayOf(end)) });
}

writeFileSync(OUT, JSON.stringify({
  source: 'U.S. Treasury Fiscal Data API: Daily Treasury Statement (Tables I and II) and Debt to the Penny',
  fetched: today,
  latest,
  start,
  monthEnds,
}, null, 1) + '\n');
const b = (x) => `$${(x / 1e9).toFixed(1)}B`;
console.log(`Through ${latest.date} (FY${latest.fy}): new borrowing from the public ${b(latest.debtHeldPublic - start.debtHeldPublic)}, cash ${b(latest.cash - start.cash)}, so a deficit of about ${b((latest.debtHeldPublic - start.debtHeldPublic) - (latest.cash - start.cash))}; deposits ${b(latest.deposits)}; ${monthEnds.length} month ends`);
