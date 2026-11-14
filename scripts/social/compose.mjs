// Writes the brand accounts' Daily Dollar posts for review. DRY RUN: nothing is posted anywhere.
// The puzzles come from the game's own code and the crowd's counts from the public, read-only
// daily_stats() function (scripts/social/day.mjs), so the posts match the game.
//
//   node scripts/social/compose.mjs                  today (Eastern time)
//   node scripts/social/compose.mjs --date 2027-04-12 --days 7    a week ahead (no counts yet)
//   node scripts/social/compose.mjs --no-stats       without reading the counts
//
// Writes social/drafts/<date>.md and .json (git-ignored); on GitHub Actions also the run's
// summary page (.github/workflows/social-drafts.yml).
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { etToday, openPuzzles, shift } from './day.mjs';
import { toMarkdown } from './posts.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const start = opt('--date', etToday());
const days = Math.max(1, Math.min(31, Number(opt('--days', 1))));

const P = await openPuzzles({ useStats: !argv.includes('--no-stats') });
try {
  mkdirSync(new URL('../../social/drafts/', import.meta.url), { recursive: true });
  for (let d = 0; d < days; d++) {
    const key = shift(start, d);
    const day = await P.day(key);
    if (!day) { console.log(`${key}: before the first puzzle`); continue; }
    const md = toMarkdown(day.slots, key, day.puzzle);
    writeFileSync(new URL(`../../social/drafts/${key}.md`, import.meta.url), md + '\n');
    writeFileSync(new URL(`../../social/drafts/${key}.json`, import.meta.url), JSON.stringify({ key, puzzle: day.puzzle.n, dryRun: true, slots: day.slots }, null, 1) + '\n');
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
    const errors = day.slots.flatMap((s) => Object.entries(s.posts ?? {}).filter(([, p]) => p.error).map(([pf, p]) => `${s.slot}/${pf}: ${p.error}`));
    console.log(`${key} #${day.puzzle.n}: ${day.slots.map((s) => `${s.slot} ${s.skip ? 'skipped' : 'ok'}`).join(', ')}${errors.length ? ' · ' + errors.join('; ') : ''} → social/drafts/${key}.md`);
  }
} finally {
  await P.close();
}
