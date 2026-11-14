// Before building the claude.ai copy: take the bills the public site shows (the deploy fetches them
// from Congress.gov with the repository's key and publishes them as /bills-full.json), so the copy
// has the same sponsors, floor votes and summaries. Replaces src/data/generated/bills.json only with
// a newer, well-formed file; if the site can't be reached, the build goes on with the file as it is.
//   node scripts/pull-bills.mjs   (run by npm run build:artifact)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const URL_ = 'https://balancethebudget.us/bills-full.json';
const OUT = new URL('../src/data/generated/bills.json', import.meta.url);
let local = { fetchedAt: '' };
try { local = JSON.parse(readFileSync(OUT, 'utf8')); } catch { /* none yet */ }
try {
  // Node's fetch first; where it can't reach the site directly (some build machines only get out
  // through an HTTPS proxy, which curl uses), curl.
  let live;
  try {
    const r = await fetch(URL_, { headers: { 'User-Agent': 'HelpUncleSamBalanceTheBudget/1.0 (build)' }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(String(r.status));
    live = await r.json();
  } catch (e) {
    if (/^\d{3}$/.test(e.message)) throw e;
    live = JSON.parse(execFileSync('curl', ['-sfL', '--max-time', '20', URL_], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  }
  const ok = live && typeof live.fetchedAt === 'string' && Array.isArray(live.bills) && live.bills.length > 0
    && live.bills.every((b) => b && typeof b.id === 'string' && typeof b.title === 'string' && typeof b.url === 'string');
  if (!ok) throw new Error('not a bills file');
  if (live.fetchedAt <= (local.fetchedAt ?? '')) { console.log(`bills: the local file (${local.fetchedAt}) is as new as the site's; kept`); process.exit(0); }
  writeFileSync(OUT, JSON.stringify(live, null, 1) + '\n');
  const sp = live.bills.filter((b) => b.sponsor).length, v = live.bills.filter((b) => b.votes?.length).length;
  console.log(`bills: ${live.bills.length} from the site (fetched ${live.fetchedAt}; ${sp} with sponsors, ${v} with floor votes)`);
} catch (e) {
  console.warn(`bills: couldn't take the site's (${e.message}); building with the local file (${local.fetchedAt || 'none'})`);
}
