import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { budget, debt, dts as bakedDts } from '../data';
import { type TreasuryDay, treasuryDay } from './dts';
import type { NewsItem } from '../game/news';

// Standalone build only: refresh the headline numbers straight from the Treasury Fiscal Data API
// in the visitor's browser, when the page opens and again every half hour while it stays open
// (Treasury posts new figures once each business day). The artifact build ships with the data
// baked in (its sandbox blocks outside requests), so this provider stays idle there.
const API = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';
const EVERY = 30 * 60 * 1000;

export interface LiveState {
  status: 'off' | 'loading' | 'live' | 'error';
  debt?: { date: string; total: number; public: number; intragov: number };
  /** The debt about a year before `debt`, for the clock's pace. */
  debtYearAgo?: { date: string; total: number };
  limit?: { date: string; limit: number; subject: number };
  mts?: { date: string; fy: number; receiptsFYTD: number; outlaysFYTD: number; deficitFYTD: number; interestFYTD?: number };
  /** The Treasury's daily figures for the latest day (see lib/dts.ts), and for the last day of the month `mts` covers. */
  day?: TreasuryDay;
  dayMonthEnd?: TreasuryDay;
  /** Spending and tax bills on the Senate and House floors today, and sent to the President (Congress.gov). */
  news?: NewsItem[];
  fetchedAt?: number;
}

const Ctx = createContext<LiveState>({ status: 'off' });

async function getJSON(path: string) {
  const r = await fetch(API + path, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}
const isoDaysAgo = (date: string, days: number) => new Date(Date.parse(date + 'T12:00:00Z') - days * 86400000).toISOString().slice(0, 10);

async function fetchLive(): Promise<LiveState> {
  const [penny, mts, dts, today] = await Promise.all([
    getJSON('/v2/accounting/od/debt_to_penny?sort=-record_date&page%5Bsize%5D=1'),
    getJSON('/v1/accounting/mts/mts_table_9?sort=-record_date,src_line_nbr&page%5Bsize%5D=80'),
    getJSON(`/v1/accounting/dts/debt_subject_to_limit?sort=-record_date,src_line_nbr&page%5Bsize%5D=20`).catch(() => null),
    treasuryDay(new Date().toISOString().slice(0, 10)).catch(() => null),
  ]);
  const p = penny.data[0];
  const out: LiveState = { status: 'live', fetchedAt: Date.now() };
  if (p && p.record_date >= debt.latest.date) {
    out.debt = { date: p.record_date, total: +p.tot_pub_debt_out_amt, public: +p.debt_held_public_amt, intragov: +p.intragov_hold_amt };
    const back = await getJSON(`/v2/accounting/od/debt_to_penny?filter=record_date:lte:${isoDaysAgo(p.record_date, 365)}&sort=-record_date&page%5Bsize%5D=1&fields=record_date,tot_pub_debt_out_amt`).catch(() => null);
    const b = back?.data?.[0];
    if (b) out.debtYearAgo = { date: b.record_date, total: +b.tot_pub_debt_out_amt };
  }
  const rows: Record<string, string>[] = mts.data;
  const date = rows[0]?.record_date;
  if (date && date >= budget.mtsLatestDate) {
    const latestRows = rows.filter((r) => r.record_date === date);
    const find = (re: RegExp) => latestRows.find((r) => re.test(r.classification_desc));
    const rec = find(/^Total Receipts$/i);
    const out_ = find(/^Total Outlays$/i);
    const intr = find(/^Net Interest$/i);
    const scale = (v: string) => +v * (Math.abs(+v) < 1e10 ? 1e6 : 1);
    if (rec && out_) {
      const fy = Number(date.slice(0, 4)) + (Number(date.slice(5, 7)) >= 10 ? 1 : 0);
      const r = scale(rec.current_fytd_rcpt_outly_amt);
      const o = scale(out_.current_fytd_rcpt_outly_amt);
      out.mts = { date, fy, receiptsFYTD: r, outlaysFYTD: o, deficitFYTD: o - r, interestFYTD: intr ? scale(intr.current_fytd_rcpt_outly_amt) : undefined };
    }
  }
  // The Treasury's daily figures for this fiscal year; and, once a month of this year has its
  // official statement, the same figures on that month's last day (baked in, or fetched).
  if (today && today.date >= bakedDts.latest.date) out.day = today;
  if (out.mts && out.mts.fy === (out.day ?? bakedDts.latest).fy && !bakedDts.monthEnds.some((m) => m.month === out.mts!.date)) {
    const end = await treasuryDay(out.mts.date).catch(() => null);
    if (end && end.date.slice(0, 7) === out.mts.date.slice(0, 7)) out.dayMonthEnd = end;
  }
  // Debt subject to limit: amounts in millions (see scripts/lib/debtlimit.mjs, which bakes the same figure in).
  const d: Record<string, string>[] = dts?.data ?? [];
  const day = d.filter((r) => r.record_date === d[0]?.record_date);
  const amt = (c: string) => day.filter((r) => r.debt_catg === c).reduce((s, r) => s + Number(r.close_today_bal) * 1e6, 0);
  const limit = amt('Statutory Debt Limit');
  const subject = amt('Debt Held by the Public') + amt('Intragovernmental Holdings') - amt('Debt Not Subject to Limit') + amt('Other Debt Subject to Limit');
  if (limit > 0 && subject > 0) out.limit = { date: day[0].record_date, limit, subject };
  // (Congress.gov's floor feeds fed the main menu's headline line; the menu has a tab bar now, so
  // they aren't fetched. parseCongressFeed in game/news.ts still reads them, should they return.)
  return out;
}

export function LiveProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LiveState>({ status: __ARTIFACT__ ? 'off' : 'loading' });
  useEffect(() => {
    if (__ARTIFACT__) return;
    let cancelled = false;
    let last = 0;
    const run = async () => {
      last = Date.now();
      try {
        const s = await fetchLive();
        if (!cancelled) setState(s);
      } catch {
        if (!cancelled) setState((p) => (p.status === 'live' ? p : { status: 'error' }));
      }
    };
    void run();
    const iv = setInterval(() => { if (!document.hidden) void run(); }, EVERY);
    // Back to a tab left open for a while: catch up at once.
    const vis = () => { if (!document.hidden && Date.now() - last > EVERY) void run(); };
    document.addEventListener('visibilitychange', vis);
    return () => { cancelled = true; clearInterval(iv); document.removeEventListener('visibilitychange', vis); };
  }, []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useLive = () => useContext(Ctx);
