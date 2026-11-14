// A day's Daily Dollar posts, from the game's own puzzle code (src/game/daily.ts, loaded through
// Vite) and the crowd's public, read-only counts (daily_stats()). Shared by the drafts
// (compose.mjs) and the poster (post.mjs), so what's reviewed is what's posted.
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { composeDay } from './posts.mjs';

export const SITE = 'https://balancethebudget.us/';
/** Today in Eastern time, the calendar the posts follow. */
export const etToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const shift = (key, d) => { const [y, m, dd] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd + d)).toISOString().slice(0, 10); };

// The site's public database address and publishable key, as the game uses them (read-only here).
const backend = readFileSync(new URL('../../src/lib/backend.ts', import.meta.url), 'utf8');
const DB = backend.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0];
const KEY = backend.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
async function statsOf(n) {
  if (!DB || !KEY) return null;
  try {
    const r = await fetch(`${DB}/rest/v1/rpc/daily_stats`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_puzzle: n }), signal: AbortSignal.timeout(15000) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

/** Opens the game's puzzle code once; call days(keys) as often as needed, then close(). */
export async function openPuzzles({ useStats = true } = {}) {
  const server = await createServer({ root: new URL('../../', import.meta.url).pathname, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  const D = await server.ssrLoadModule('/src/game/daily.ts');
  const plain = (key) => {
    const z = D.puzzleFor(key);
    if (z.n < 1) return null;
    const t = z.theme;
    const edition = t ? (t.finale ? D.editionName(t) : `${t.name}, day ${t.day} of ${t.days}`) : null;
    return { n: z.n, title: z.pool.title, edition, chain: z.chain.map((x) => ({ label: x.label, shown: x.shown, value: x.value, source: x.source })) };
  };
  return {
    /** The day's puzzle and its three posts (null before the first puzzle). */
    async day(key) {
      const puzzle = plain(key), yesterday = plain(shift(key, -1));
      if (!puzzle) return null;
      const [stats, yesterdayStats] = useStats ? await Promise.all([statsOf(puzzle.n), yesterday ? statsOf(yesterday.n) : null]) : [null, null];
      return { key, puzzle, slots: composeDay({ site: SITE, puzzle, yesterday, stats, yesterdayStats }) };
    },
    close: () => server.close(),
  };
}
