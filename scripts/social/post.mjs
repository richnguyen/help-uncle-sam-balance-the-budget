// Posts one of today's Daily Dollar posts to the brand account on Bluesky, the same text the drafts
// show (scripts/social/day.mjs). Without --live it only prints what it would post.
//
//   node scripts/social/post.mjs --slot morning|midday|evening          dry run
//   BLUESKY_HANDLE=… BLUESKY_APP_PASSWORD=… node scripts/social/post.mjs --slot morning --live
//
// A slot the composer skipped (the midday post before every call has 20 answers) isn't posted,
// and a text already among the account's recent posts isn't posted again (a re-run is safe).
// On GitHub Actions it runs only when the repository variable SOCIAL_POSTING is "on"
// (.github/workflows/social-drafts.yml), with the handle in the variable BLUESKY_HANDLE and the
// app password in the secret BLUE_SKY_APP_KEY.
import { appendFileSync, readFileSync } from 'node:fs';
import { bluesky, postRecord } from './bluesky.mjs';
import { etToday, openPuzzles } from './day.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const slot = opt('--slot', '');
const live = argv.includes('--live');
const key = opt('--date', etToday());
const say = (s) => { console.log(s); if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, s + '\n\n'); };
if (!['morning', 'midday', 'evening'].includes(slot)) { console.error('Use --slot morning, midday or evening.'); process.exit(2); }

const P = await openPuzzles();
let day;
try { day = await P.day(key); } finally { await P.close(); }
if (!day) { say(`${key}: before the first puzzle; nothing to post.`); process.exit(0); }
const s = day.slots.find((x) => x.slot === slot);
if (s.skip) { say(`Bluesky, ${slot} of ${key} (#${day.puzzle.n}): skipped, ${s.skip}.`); process.exit(0); }
const p = s.posts.bluesky;
if (p.error) { say(`Bluesky, ${slot}: not posted, ${p.error}.`); process.exit(1); }
if (!live) { say(`Dry run, Bluesky, ${slot} of ${key} (#${day.puzzle.n}), ${p.length}/${p.limit}:\n\n${p.text}`); process.exit(0); }

const handle = process.env.BLUESKY_HANDLE, password = process.env.BLUESKY_APP_PASSWORD;
if (!handle || !password) { say('Not posted: BLUESKY_HANDLE (a repository variable) and BLUESKY_APP_PASSWORD (from the secret BLUE_SKY_APP_KEY) are both needed.'); process.exit(1); }
const bs = await bluesky({ handle: handle.replace(/^@/, ''), password });
if ((await bs.recentTexts()).includes(p.text)) { say(`Bluesky, ${slot} of ${key}: already posted; not posting it again.`); process.exit(0); }
// A link card for the game, with the site's preview image.
const thumb = await bs.uploadImage(readFileSync(new URL('../../public/og-image.png', import.meta.url)), 'image/png');
const uri = p.text.match(/https?:\/\/\S+/)?.[0];
const embed = uri ? { $type: 'app.bsky.embed.external', external: { uri, title: `The Daily Dollar #${day.puzzle.n}`, description: 'Five quick calls on real federal numbers: higher or lower? Same puzzle for everyone today. No sign-up.', thumb } } : null;
const r = await bs.post(postRecord(p.text, embed));
say(`Posted to Bluesky, ${slot} of ${key} (#${day.puzzle.n}): ${r.web}`);
