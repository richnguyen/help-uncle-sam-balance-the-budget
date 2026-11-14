// Writes the brand accounts' Daily Dollar posts for review. DRY RUN: nothing is posted anywhere.
// The puzzles come from the game's own code (src/game/daily.ts, loaded through Vite), and the
// crowd's counts from the public, read-only daily_stats() function, so the posts match the game.
//
//   node scripts/social/compose.mjs                  today (Eastern time)
//   node scripts/social/compose.mjs --date 2027-04-12 --days 7    a week ahead (no counts yet)
//   node scripts/social/compose.mjs --no-stats       without reading the counts
//
// Writes social/drafts/<date>.md and .json (git-ignored); on GitHub Actions also the run's
// summary page (.github/workflows/social-drafts.yml).
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { composeDay, toMarkdown } from './posts.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const etToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const start = opt('--date', etToday);
const days = Math.max(1, Math.min(31, Number(opt('--days', 1))));
const useStats = !argv.includes('--no-stats');
const SITE = 'https://balancethebudget.us/';
const shift = (key, d) => { const [y, m, dd] = key.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, dd + d)); return t.toISOString().slice(0, 10); };

// The site's public database address and publishable key, as the game uses them (read-only here).
const backend = readFileSync(new URL('../../src/lib/backend.ts', import.meta.url), 'utf8');
const DB = backend.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0];
const KEY = backend.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
async function statsOf(n) {
  if (!useStats || !DB || !KEY) return null;
  try {
    const r = await fetch(`${DB}/rest/v1/rpc/daily_stats`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_puzzle: n }), signal: AbortSignal.timeout(15000) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

const server = await createServer({ root: new URL('../../', import.meta.url).pathname, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const D = await server.ssrLoadModule('/src/game/daily.ts');
  const plain = (key) => {
    const z = D.puzzleFor(key);
    if (z.n < 1) return null;
    const t = z.theme;
    const edition = t ? (t.finale ? D.editionName(t) : `${t.name}, day ${t.day} of ${t.days}`) : null;
    return { n: z.n, title: z.pool.title, edition, chain: z.chain.map((x) => ({ label: x.label, shown: x.shown, value: x.value, source: x.source })) };
  };
  mkdirSync(new URL('../../social/drafts/', import.meta.url), { recursive: true });
  for (let d = 0; d < days; d++) {
    const key = shift(start, d);
    const puzzle = plain(key), yesterday = plain(shift(key, -1));
    if (!puzzle) { console.log(`${key}: before the first puzzle`); continue; }
    const [stats, yesterdayStats] = await Promise.all([statsOf(puzzle.n), yesterday ? statsOf(yesterday.n) : null]);
    const day = composeDay({ site: SITE, puzzle, yesterday, stats, yesterdayStats });
    const md = toMarkdown(day, key, puzzle);
    writeFileSync(new URL(`../../social/drafts/${key}.md`, import.meta.url), md + '\n');
    writeFileSync(new URL(`../../social/drafts/${key}.json`, import.meta.url), JSON.stringify({ key, puzzle: puzzle.n, dryRun: true, slots: day }, null, 1) + '\n');
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
    const errors = day.flatMap((s) => Object.entries(s.posts ?? {}).filter(([, p]) => p.error).map(([pf, p]) => `${s.slot}/${pf}: ${p.error}`));
    console.log(`${key} #${puzzle.n}: ${day.map((s) => `${s.slot} ${s.skip ? 'skipped' : 'ok'}`).join(', ')}${errors.length ? ' · ' + errors.join('; ') : ''} → social/drafts/${key}.md`);
  }
} finally {
  await server.close();
}
