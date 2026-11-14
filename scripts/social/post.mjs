// Posts one of today's Daily Dollar posts to the brand accounts (Bluesky and Mastodon), the same
// text the drafts show (scripts/social/day.mjs). Without --live it only prints what it would post.
//
//   node scripts/social/post.mjs --slot morning|midday|evening             dry run, both platforms
//   node scripts/social/post.mjs --slot morning --live [--to bluesky]       post
//
// Each platform posts on its own: one that isn't set up is skipped with a note, and one that fails
// doesn't stop the other (the run still ends in an error, so it shows in Actions).
//   Bluesky:  BLUESKY_HANDLE (variable) and BLUESKY_APP_PASSWORD (from the secret BLUE_SKY_APP_KEY)
//   Mastodon: MASTODON_INSTANCE (variable, e.g. https://mastodon.social) and MASTODON_ACCESS_TOKEN (secret)
// A slot the composer skipped isn't posted, and a text already among the account's recent posts
// isn't posted again (a re-run is safe). On GitHub Actions it runs only when the repository
// variable SOCIAL_POSTING is "on" (.github/workflows/social-drafts.yml).
import { appendFileSync, readFileSync } from 'node:fs';
import { bluesky, postRecord } from './bluesky.mjs';
import { etToday, openPuzzles } from './day.mjs';
import { mastodon } from './mastodon.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const slot = opt('--slot', '');
const live = argv.includes('--live');
const key = opt('--date', etToday());
const to = opt('--to', 'bluesky,mastodon').split(',').filter((x) => ['bluesky', 'mastodon'].includes(x));
const say = (s) => { console.log(s); if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, s + '\n\n'); };
if (!['morning', 'midday', 'evening'].includes(slot)) { console.error('Use --slot morning, midday or evening.'); process.exit(2); }

const P = await openPuzzles();
let day;
try { day = await P.day(key); } finally { await P.close(); }
if (!day) { say(`${key}: before the first puzzle; nothing to post.`); process.exit(0); }
const s = day.slots.find((x) => x.slot === slot);
const label = `${slot} of ${key} (#${day.puzzle.n})`;
if (s.skip) { say(`${label}: skipped, ${s.skip}.`); process.exit(0); }

const env = process.env;
const POSTERS = {
  async bluesky(text) {
    if (!env.BLUESKY_HANDLE || !env.BLUESKY_APP_PASSWORD) return { note: 'not set up (needs BLUESKY_HANDLE and the secret BLUE_SKY_APP_KEY)' };
    const handle = env.BLUESKY_HANDLE.replace(/^@/, '');
    const bs = await bluesky({ handle, password: env.BLUESKY_APP_PASSWORD });
    if ((await bs.recentTexts()).includes(text)) return { note: 'already posted; not posting it again' };
    // A link card for the game, with the site's preview image.
    const thumb = await bs.uploadImage(readFileSync(new URL('../../public/og-image.png', import.meta.url)), 'image/png');
    const uri = text.match(/https?:\/\/\S+/)?.[0];
    const embed = uri ? { $type: 'app.bsky.embed.external', external: { uri, title: `The Daily Dollar #${day.puzzle.n}`, description: 'Five quick calls on real federal numbers: higher or lower? Same puzzle for everyone today. No sign-up.', thumb } } : null;
    return { web: (await bs.post(postRecord(text, embed))).web };
  },
  async mastodon(text) {
    if (!env.MASTODON_INSTANCE || !env.MASTODON_ACCESS_TOKEN) return { note: 'not set up (needs the variable MASTODON_INSTANCE and the secret MASTODON_ACCESS_TOKEN)' };
    const m = mastodon({ instance: env.MASTODON_INSTANCE, token: env.MASTODON_ACCESS_TOKEN });
    if (await m.posted(text)) return { note: 'already posted; not posting it again' };
    return { web: (await m.post(text, `daily-dollar-${key}-${slot}`)).web };
  },
};

let failed = 0;
for (const pf of to) {
  const p = s.posts[pf];
  const name = pf[0].toUpperCase() + pf.slice(1);
  if (!p) { say(`${name}, ${label}: no post for this platform.`); continue; }
  if (p.error) { say(`${name}, ${label}: not posted, ${p.error}.`); failed++; continue; }
  if (!live) { say(`Dry run, ${name}, ${label}, ${p.length}/${p.limit}:\n\n${p.text}`); continue; }
  try {
    const r = await POSTERS[pf](p.text);
    say(r.web ? `Posted to ${name}, ${label}: ${r.web}` : `${name}, ${label}: ${r.note}.`);
  } catch (e) {
    failed++;
    say(`${name}, ${label}: failed, ${String(e.message).replace(/Bearer \S+/g, 'Bearer …')}`);
  }
}
process.exit(failed ? 1 : 0);
