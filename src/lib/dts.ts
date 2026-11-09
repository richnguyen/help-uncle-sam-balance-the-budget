// The Treasury's daily figures, for this fiscal year's running deficit: the debt held by the public
// (Debt to the Penny), the cash in the Treasury General Account at the day's close, and the cash
// deposited so far this fiscal year without borrowing (Daily Treasury Statement, Tables I and II).
// scripts/fetch-dts.mjs bakes the same figures into src/data/generated/dts.json.

export interface TreasuryDay { date: string; fy: number; deposits: number; cash: number; debtHeldPublic: number }
export interface DtsData { source: string; fetched: string; latest: TreasuryDay; start: TreasuryDay; monthEnds: (TreasuryDay & { month: string })[] }

export const API = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';
const get = async (path: string) => {
  const r = await fetch(API + path, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(String(r.status));
  return ((await r.json()).data ?? []) as Record<string, string>[];
};
const onOrBefore = (date: string) => `filter=record_date:lte:${date}&sort=-record_date`;

/** The latest day on or before `date` with all three figures (null if the Treasury can't be reached). */
export async function treasuryDay(date: string): Promise<TreasuryDay | null> {
  for (let d = date, k = 0; k < 4; k++) {
    const [ops, bal, penny] = await Promise.all([
      get(`/v1/accounting/dts/deposits_withdrawals_operating_cash?fields=record_date,record_fiscal_year,account_type,transaction_type,transaction_catg,transaction_fytd_amt&${onOrBefore(d)}&page%5Bsize%5D=400`),
      get(`/v1/accounting/dts/operating_cash_balance?fields=record_date,account_type,open_today_bal&${onOrBefore(d)}&page%5Bsize%5D=10`),
      get(`/v2/accounting/od/debt_to_penny?fields=record_date,debt_held_public_amt&${onOrBefore(d)}&page%5Bsize%5D=1`),
    ]);
    const a = ops[0]?.record_date, b = bal[0]?.record_date, c = penny[0]?.record_date;
    if (!a || !b || !c) return null;
    if (a === b && b === c) {
      let deposits = 0;
      for (const r of ops) {
        if (r.record_date !== a || r.account_type !== 'Treasury General Account (TGA)' || r.transaction_type !== 'Deposits' || /^Public Debt Cash/i.test(r.transaction_catg ?? '')) continue;
        deposits += Number(r.transaction_fytd_amt) * 1e6; // Table II is in millions
      }
      const close = bal.find((r) => r.record_date === a && /Closing Balance/i.test(r.account_type));
      if (!close || !(deposits > 0)) return null;
      return { date: a, fy: Number(ops[0].record_fiscal_year), deposits, cash: Number(close.open_today_bal) * 1e6, debtHeldPublic: Number(penny[0].debt_held_public_amt) };
    }
    d = [a, b, c].sort()[0];
  }
  return null;
}
