// Spending and tax bills moving in Congress, for the main menu's feed: each with its official
// status, the Congressional Research Service's plain-English summary, its sponsor, and CBO's cost
// estimate when there is one. Run before each build (the Pages workflow runs it every few hours):
//
//   CONGRESS_API_KEY=... node scripts/fetch-bills.mjs   → src/data/generated/bills.json
//
// The key is a free api.data.gov key, kept as the repository secret CONGRESS_API_KEY (never in
// the code). Without one, the shared DEMO_KEY is tried with a small number of calls; if that is
// refused or Congress.gov can't be reached, the file is left as it was.
//
// Which bills: CRS summaries written or updated in the last 60 days for bills of the current
// Congress, kept when the bill's policy area is taxation or public finance, or when its title is
// about taxes, spending, the budget or the debt. Commemorative and naming bills are left out.
// Nothing here takes a side: the summary is CRS's, the status and sponsor are Congress.gov's.

import { readFileSync, writeFileSync } from 'node:fs';
import { parseRollCall } from './rollcall.mjs';

const OUT = new URL('../src/data/generated/bills.json', import.meta.url);
const PUBLIC = new URL('../public/bills.json', import.meta.url);
const KEY = process.env.CONGRESS_API_KEY || 'DEMO_KEY';
const DEMO = KEY === 'DEMO_KEY';
const API = 'https://api.congress.gov/v3';
const UA = 'HelpUncleSamBalanceTheBudget/1.0 (civic education game; +https://balancethebudget.us/)';
const CONGRESS = 119;
const DAYS = 60;
const MAX = 16;
// The DEMO_KEY allows only a few dozen calls an hour from one address, shared with everyone.
const DETAIL_BUDGET = DEMO ? 14 : 48;

const TOPIC = /\b(tax(es|ation|payers?)?|tariffs?|budget(s|ary)?|appropriations?|spending|deficits?|debt|fiscal|revenues?|shutdown|continuing appropriations|rescissions?|sequest\w*|medicare|medicaid|social security|internal revenue|irs|treasury|reconciliation|earmarks?|federal funds?)\b/i;
const AREAS = new Set(['Taxation', 'Economics and Public Finance']);
const SKIP = /\b(designate|post office|commemorat|to rename|coin\b|coins\b|congressional gold medal|awareness (week|month|day))\b/i;

const TYPE_PATH = { HR: 'house-bill', S: 'senate-bill', HJRES: 'house-joint-resolution', SJRES: 'senate-joint-resolution', HCONRES: 'house-concurrent-resolution', SCONRES: 'senate-concurrent-resolution', HRES: 'house-resolution', SRES: 'senate-resolution' };
const TYPE_LABEL = { HR: 'H.R.', S: 'S.', HJRES: 'H.J.Res.', SJRES: 'S.J.Res.', HCONRES: 'H.Con.Res.', SCONRES: 'S.Con.Res.', HRES: 'H.Res.', SRES: 'S.Res.' };

let calls = 0;
async function get(path, params = {}) {
  const u = new URL(API + path);
  for (const [k, v] of Object.entries({ format: 'json', ...params })) u.searchParams.set(k, String(v));
  u.searchParams.set('api_key', KEY);
  calls++;
  const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}

/**
 * A bill's floor votes, from the official records the Congress.gov actions point to (the House
 * Clerk's and the Senate's XML). Newest first, at most four per bill; a record that can't be read
 * is left out rather than guessed at.
 */
const VOTE_HOSTS = /^https:\/\/(clerk\.house\.gov|www\.senate\.gov)\//;
let voteRecords = 0;
async function floorVotes(congress, type, number) {
  let actions = [];
  try { actions = (await get(`/bill/${congress}/${type}/${number}/actions`, { limit: 250 })).actions ?? []; } catch (e) { console.warn(`no actions for ${type}${number}: ${e.message}`); return []; }
  const urls = [...new Set(actions.flatMap((a) => (a.recordedVotes ?? []).map((v) => v.url)).filter((u) => VOTE_HOSTS.test(u ?? '')))].slice(0, 4);
  const votes = [];
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) });
      if (!r.ok) throw new Error(String(r.status));
      const v = parseRollCall(await r.text(), url);
      if (v.roll && v.members.length && v.totals.yea + v.totals.nay > 0) { votes.push(v); voteRecords++; }
    } catch (e) { console.warn(`roll call ${url} unreadable: ${e.message}`); }
  }
  return votes.sort((a, b) => b.date.localeCompare(a.date));
}

/** The summary's opening paragraphs, up to about 1,400 characters; the rest is on Congress.gov. */
function opening(text, max = 1400) {
  if (text.length <= max) return { text, cut: false };
  const paras = text.split('\n');
  let out = '';
  for (const p of paras) { if ((out + p).length > max && out) break; out += (out ? '\n' : '') + p; }
  if (out.length > max) out = out.slice(0, out.lastIndexOf(' ', max)) + '…';
  return { text: out, cut: true };
}

const plain = (html = '') => html
  .replace(/<\/(p|li|h\d)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

/** Where the bill stands, in the words Congress.gov uses, from its latest action and laws. */
function statusOf(latest = '', summaryStage = '', laws = []) {
  const t = `${latest} ${summaryStage}`;
  if (laws.length || /Became Public Law|Signed by President|^Public Law/i.test(latest) || /^Public Law/i.test(summaryStage)) return 'Became law';
  if (/Vetoed/i.test(latest)) return 'Vetoed';
  if (/Presented to President/i.test(latest)) return 'Sent to President';
  if (/Passed Senate|Passed\/agreed to in Senate/i.test(t) && /Passed House|Passed\/agreed to in House/i.test(t)) return 'Passed both chambers';
  if (/Passed Senate|Passed\/agreed to in Senate/i.test(t)) return 'Passed Senate';
  if (/Passed House|Passed\/agreed to in House|On passage Passed/i.test(t)) return 'Passed House';
  if (/Reported|Placed on .*Calendar|Ordered to be Reported/i.test(t)) return 'Reported by committee';
  if (/Referred to/i.test(t)) return 'In committee';
  return 'Introduced';
}

async function main() {
  const since = new Date(Date.now() - DAYS * 86400000).toISOString().replace(/\.\d+Z$/, 'Z');
  // The newest CRS summaries first; a bill's latest summary is the one kept.
  const pages = DEMO ? 1 : 3;
  const summaries = [];
  for (let p = 0; p < pages; p++) {
    const j = await get(`/summaries/${CONGRESS}`, { fromDateTime: since, sort: 'updateDate+desc', limit: 250, offset: p * 250 });
    summaries.push(...(j.summaries ?? []));
    if (!j.pagination?.next) break;
  }
  const byBill = new Map();
  for (const s of summaries) {
    const b = s.bill; if (!b?.type || !b?.number) continue;
    const id = `${b.type.toLowerCase()}${b.number}-${b.congress}`;
    if (byBill.has(id)) continue;
    const text = plain(s.text);
    if (SKIP.test(b.title)) continue;
    const score = (TOPIC.test(b.title) ? 3 : 0) + (text.match(new RegExp(TOPIC.source, 'gi'))?.length ?? 0);
    byBill.set(id, { id, b, s, text, score });
  }
  // The likeliest first, then the newest.
  const candidates = [...byBill.values()].filter((c) => c.score >= 2)
    .sort((a, b) => b.score - a.score || b.s.updateDate.localeCompare(a.s.updateDate));
  console.log(`${summaries.length} summaries since ${since.slice(0, 10)}, ${candidates.length} about spending or taxes`);

  const bills = [];
  // The bill's own record (sponsor, latest action, CBO estimate) when calls allow; otherwise the
  // summary's own fields. A refusal for too many calls stops the detail calls for this run.
  let limited = false;
  for (const c of candidates) {
    if (bills.length >= MAX) break;
    let d = null;
    if (!limited && calls < DETAIL_BUDGET) {
      try { d = (await get(`/bill/${c.b.congress}/${c.b.type.toLowerCase()}/${c.b.number}`)).bill; } catch (e) {
        console.warn(`no detail for ${c.id}: ${e.message}`);
        if (/^429/.test(e.message)) limited = true;
      }
    }
    if (!d && c.score < 3) continue;
    d ??= { title: c.b.title, updateDateIncludingText: c.b.updateDateIncludingText };
    const area = d.policyArea?.name ?? '';
    if (d.policyArea && !AREAS.has(area) && !TOPIC.test(d.title ?? c.b.title)) continue;
    const sp = d.sponsors?.[0];
    const cbo = (d.cboCostEstimates ?? []).sort((x, y) => (y.pubDate ?? '').localeCompare(x.pubDate ?? ''))[0];
    const latest = d.latestAction ?? {};
    bills.push({
      id: c.id,
      label: `${TYPE_LABEL[c.b.type] ?? c.b.type} ${c.b.number}`,
      title: d.title ?? c.b.title,
      area,
      status: statusOf(latest.text, c.s.actionDesc, d.laws ?? []),
      latestAction: { date: latest.actionDate ?? c.s.actionDate ?? '', text: (latest.text ?? c.s.actionDesc ?? '').replace(/\s+/g, ' ').trim() },
      introduced: d.introducedDate ?? '',
      // The sponsor exactly as Congress.gov lists them, e.g. "Sen. Crapo, Mike [R-ID]", plus its parts.
      sponsor: sp ? { name: sp.fullName?.replace(/\s*\[[^\]]+\]\s*$/, '') ?? '', display: sp.fullName ?? '', party: sp.party ?? '', state: sp.state ?? '', district: sp.district ?? null } : null,
      cosponsors: d.cosponsors?.count ?? 0,
      summary: opening(c.text).text,
      summaryCut: opening(c.text).cut,
      summaryStage: c.s.actionDesc ?? '',
      summaryDate: (c.s.updateDate ?? '').slice(0, 10),
      cbo: cbo ? { title: cbo.title ?? '', url: cbo.url, date: (cbo.pubDate ?? '').slice(0, 10) } : null,
      url: `https://www.congress.gov/bill/${c.b.congress}th-congress/${TYPE_PATH[c.b.type] ?? 'house-bill'}/${c.b.number}`,
      updated: (d.updateDateIncludingText ?? d.updateDate ?? c.s.updateDate ?? '').slice(0, 10),
      // Floor votes, only for bills past introduction (and only when the detail call worked).
      votes: d.sponsors && !/^introduced/i.test(statusOf(latest.text, c.s.actionDesc, d.laws ?? [])) && !limited && calls < DETAIL_BUDGET + 20
        ? await floorVotes(c.b.congress, c.b.type.toLowerCase(), c.b.number) : [],
    });
  }
  // A House bill and its Senate twin share a title: keep the one summarized last, and name the other.
  const seen = new Map();
  const out = [];
  for (const b of bills.sort((x, y) => y.summaryDate.localeCompare(x.summaryDate))) {
    const key = b.title.replace(/\s+of \d{4}$|\s+\d{4}$/, '').toLowerCase();
    const twin = seen.get(key);
    if (twin) { twin.companion = b.label; continue; }
    seen.set(key, b); out.push(b);
  }
  // Newest summary first: a fresh CRS summary is the news.
  return out;
}

let bills;
try { bills = await main(); } catch (e) {
  console.warn(`Congress.gov unreachable or refused (${e.message}); keeping ${OUT.pathname}`);
  process.exit(0);
}
if (!bills.length) { console.warn('No bills kept; keeping the file as it was.'); process.exit(0); }
const out = { fetchedAt: new Date().toISOString(), congress: CONGRESS, bills };
let before = '';
try { before = readFileSync(OUT, 'utf8'); } catch { /* first run */ }
const text = JSON.stringify(out, null, 1) + '\n';
writeFileSync(OUT, text);
// A small public copy next to the site (dist/bills.json), for the alert sender: which stage each
// bill is at. The sender compares it with what players follow (supabase/functions/daily-reminders).
writeFileSync(PUBLIC, JSON.stringify({ fetchedAt: out.fetchedAt, bills: bills.map((b) => ({ id: b.id, label: b.label, title: b.title, status: b.status, url: b.url })) }) + '\n');
console.log(`${bills.length} bills (${calls} calls${DEMO ? ', DEMO_KEY' : ''}, ${voteRecords} roll-call records) → src/data/generated/bills.json${before === text ? ' (unchanged)' : ''}`);
