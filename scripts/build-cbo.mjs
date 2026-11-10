// Long-run budget history and projections.
//  History (FY1962 to the latest actual year): OMB Historical Tables, FY2027 Budget
//    Table 8.1 (outlays by Budget Enforcement Act category), 2.1 (receipts by source),
//    7.1 (debt held by the public), 10.1 (GDP).
//  Long history (FY1930 to the latest actual year): Table 1.2, receipts, outlays and the surplus or
//    deficit as percentages of GDP (`long`).
//  Projections: CBO's current-law baseline when its workbook is in data/raw/cbo/, otherwise
//    OMB's estimates from the same tables (which assume the President's proposals are enacted).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './lib/http.mjs';

const OMB_BASE = 'https://www.whitehouse.gov/wp-content/uploads/2026/04/';
const sheet = async (name) => Object.values(JSON.parse(await readFile(path.join(ROOT, 'data', 'raw', 'omb', name + '.sheets.json'), 'utf8')))[0];
const n = (v) => (typeof v === 'number' ? v : v == null || /^\.+$/.test(String(v).trim()) ? 0 : Number(String(v).replace(/,/g, '')));

function rowsByYear(s) {
  const out = new Map();
  for (const r of s) {
    const m = String(r[0] ?? '').trim().match(/^(\d{4})( estimate)?$/);
    if (m) out.set(Number(m[1]), { r, estimate: !!m[2] });
  }
  return out;
}

export async function buildCBO(addSource) {
  const [t81, t21, t71, t101] = await Promise.all(['hist08z1', 'hist02z1', 'hist07z1', 'hist10z1'].map(sheet));
  const retrieved = (await readFile(path.join(ROOT, 'data', 'raw', 'omb', 'retrieved.txt'), 'utf8')).trim();
  const o = rowsByYear(t81);
  const rcp = rowsByYear(t21);
  const debt = rowsByYear(t71);
  const gdp = rowsByYear(t101);
  const all = [];
  for (const [fy, { r, estimate }] of o) {
    if (fy < 1962) continue;
    const B = 1e9;
    const M = 1e6;
    const rr = rcp.get(fy)?.r;
    const g = gdp.get(fy)?.r;
    if (!rr || !g) continue;
    const mandatory = n(r[6]) * B;
    const ss = n(r[8]) * B;
    const medicare = n(r[9]) * B;
    const medicaid = n(r[10]) * B;
    const revenues = n(rr[8]) * M;
    const outlays = n(r[1]) * B;
    all.push({
      fy, actual: !estimate,
      revenues, individual: n(rr[1]) * M, corporate: n(rr[2]) * M, payroll: n(rr[3]) * M, otherRevenue: (n(rr[6]) + n(rr[7])) * M,
      outlays, socialSecurity: ss, medicare, medicaid, otherMandatory: mandatory - ss - medicare - medicaid, mandatory,
      defense: n(r[3]) * B, nondefense: n(r[4]) * B, discretionary: n(r[2]) * B, netInterest: n(r[14]) * B,
      deficit: outlays - revenues,
      debtPublic: debt.get(fy) ? n(debt.get(fy).r[3]) * M : null,
      gdp: n(g[1]) * B,
    });
  }
  const history = all.filter((y) => y.actual);
  let baseline = all.filter((y) => !y.actual);
  let vintage = 'FY2027 President’s Budget estimates (OMB)';
  let baselineSourceId = 'omb-hist';
  let proj = { projBy: 'OMB', projShort: 'OMB estimate', projAssumes: 'assuming the President’s budget proposals are enacted' };
  // Prefer CBO's current-law baseline if it has been downloaded and parsed.
  try {
    const cbo = JSON.parse(await readFile(path.join(ROOT, 'data', 'raw', 'cbo', 'baseline.parsed.json'), 'utf8'));
    baseline = cbo.years;
    vintage = cbo.vintage;
    baselineSourceId = 'cbo-baseline';
    proj = { projBy: 'CBO', projShort: 'CBO projection', projAssumes: 'assuming current law stays the same' };
    addSource(cbo.source);
  } catch {
    console.warn('[build] CBO baseline not available; using OMB estimates for projections');
  }
  // Debt held by the public for estimate years is in Table 7.1 only through the last actual year;
  // carry it forward with each year's deficit when the projection source lacks it.
  let prevDebt = history.at(-1).debtPublic;
  for (const y of baseline) {
    if (y.debtPublic == null) y.debtPublic = prevDebt + y.deficit;
    prevDebt = y.debtPublic;
  }
  addSource({
    id: 'omb-hist',
    title: 'Historical Tables, Budget of the U.S. Government, Fiscal Year 2027 (Tables 1.1, 1.2, 2.1, 7.1, 8.1, 10.1)',
    publisher: 'White House Office of Management and Budget',
    url: 'https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/',
    retrieved,
    note: `Files: ${OMB_BASE}hist08z1_fy2027.xlsx and companions`,
  });
  console.log(`[build] long-run: history FY${history[0].fy}–FY${history.at(-1).fy}, projections FY${baseline[0]?.fy}–FY${baseline.at(-1)?.fy} (${vintage})`);
  // Table 1.2: receipts, outlays and the surplus or deficit as percentages of GDP, FY1930 on.
  const long = [];
  for (const [fy, { r, estimate }] of rowsByYear(await sheet('hist01z2'))) {
    if (estimate || fy > history.at(-1).fy) continue;
    long.push({ fy, rev: n(r[2]), out: n(r[3]), def: n(r[4]) });
  }
  return { vintage, history, baseline, long, historySourceId: 'omb-hist', baselineSourceId, historyBy: 'OMB', ...proj };
}
