// Link previews for budget-duel invites: a sealed congressional briefing folder, one per rating
// of the sealed plan (how hard it hits the economy), so the group chat sees "Rating: Moderate"
// without seeing the plan. public/p/img/duel-<rating>.jpg and public/p/duel-<rating>/index.html.
// The invite link (src/game/duel.ts, inviteLink) goes through the matching page; people are
// forwarded to the game with the duel intact.
//   node scripts/make-duel-previews.mjs   (needs Playwright: npm i -g playwright, and Google Fonts)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const SITE = 'https://balancethebudget.us/';
const NAME = 'Help Uncle Sam Balance the Budget';
const root = new URL('../public/p/', import.meta.url);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const RATINGS = [['gentle', 'Gentle', '#2f8a57'], ['moderate', 'Moderate', '#c99a1e'], ['steep', 'Steep', '#c4462f']];

const kinds = RATINGS.map(([id, word, color]) => ({
  id: `duel-${id}`, word, color,
  title: `🔒 A sealed budget plan (Rating: ${word}). Build yours to unseal it`,
  description: 'A friend balanced Uncle Sam’s budget and sealed the plan. Build yours to unseal theirs, then face off in 3 rounds: Debt, Economy, Balance. Plans compared, never people. Real CBO numbers.',
  alt: `A sealed budget briefing folder. Rating: ${word}. Face off in three rounds: debt, economy, balance.`,
}));

const page = (k) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(k.title)} · ${NAME}</title>
<meta name="description" content="${esc(k.description)}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${NAME}">
<meta property="og:title" content="${esc(k.title)}">
<meta property="og:description" content="${esc(k.description)}">
<meta property="og:image" content="${SITE}p/img/${k.id}.jpg">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(k.alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(k.title)}">
<meta name="twitter:description" content="${esc(k.description)}">
<meta name="twitter:image" content="${SITE}p/img/${k.id}.jpg">
<meta name="twitter:image:alt" content="${esc(k.alt)}">
<link rel="icon" href="../../favicon.svg" type="image/svg+xml">
<script>location.replace(new URL('../../', location.href).pathname + location.search + location.hash);</script>
<style>body{margin:0;padding:32px 16px;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;background:#f2f4ef;color:#111b16}a{color:#1d5a43}</style>
</head>
<body>
<p>Opening the duel… <a id="go" href="../../">Continue to the game</a></p>
<script>document.getElementById('go').href = new URL('../../', location.href).pathname + location.search + location.hash;</script>
</body>
</html>
`;

const card = (k) => `<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800&family=Public+Sans:wght@500;700;800&display=block"><style>
  body{margin:0;width:1200px;height:630px;background:#14261f;font-family:"Public Sans",sans-serif;display:flex;align-items:center;justify-content:center}
  .folder{position:relative;width:1040px;height:500px;margin-top:44px;background:#e8d3a3;border-radius:6px 26px 26px 26px;box-shadow:inset 0 0 0 4px #c9a86a,0 10px 0 #b8955a;padding:44px 60px;box-sizing:border-box;color:#2b2213}
  .tab{position:absolute;top:-46px;left:0;padding:10px 26px;background:#e8d3a3;border-radius:16px 16px 0 0;box-shadow:inset 0 4px 0 #c9a86a;font-weight:800;font-size:22px;letter-spacing:.14em;text-transform:uppercase}
  .stamp{position:absolute;top:44px;right:56px;transform:rotate(-10deg);border:6px solid #b4232f;color:#b4232f;border-radius:10px;padding:4px 18px;font:800 46px/1 "Big Shoulders Display",sans-serif;letter-spacing:.08em}
  .seal{position:absolute;bottom:46px;right:70px;width:150px;height:150px;border-radius:50%;background:#b4232f;box-shadow:0 0 0 10px #8f1b25;display:grid;place-items:center;font-size:72px;transform:rotate(-8deg)}
  .k{font-size:24px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#6b5a36}
  .t{font:800 80px/.95 "Big Shoulders Display",sans-serif;margin-top:22px;max-width:700px}
  .r{display:inline-block;margin-top:24px;padding:10px 26px;border-radius:999px;background:${k.color};color:#fff;font-size:30px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
  .s{margin-top:20px;font-size:27px;font-weight:700;max-width:720px}.s span{font-weight:500;color:#5b4c2e}
  .foot{position:absolute;left:60px;bottom:22px;font-size:19px;color:#5b4c2e}
</style></head><body><div class="folder">
  <div class="tab">Confidential · budget briefing</div><div class="stamp">SEALED</div><div class="seal">🔒</div>
  <div class="k">Budget duel · plan vs. plan</div>
  <div class="t">A budget plan, sealed.</div>
  <div class="r">Rating: ${k.word}</div>
  <div class="s">Build yours to unseal it, then face off in 3 rounds:<br><span>Debt · Economy · Balance</span></div>
  <div class="foot"><b>${NAME}</b> · balancethebudget.us · real CBO numbers</div>
</div></body></html>`;

mkdirSync(new URL('img/', root), { recursive: true });
const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const k of kinds) {
  await pg.setContent(card(k), { waitUntil: 'networkidle' });
  await pg.evaluate(async () => { await document.fonts.ready; });
  await pg.screenshot({ path: new URL(`img/${k.id}.jpg`, root).pathname, type: 'jpeg', quality: 84 });
  mkdirSync(new URL(`${k.id}/`, root), { recursive: true });
  writeFileSync(new URL(`${k.id}/index.html`, root), page(k));
}
const ok = await pg.evaluate(() => document.fonts.check('800 40px "Big Shoulders Display"'));
await browser.close();
console.log(`${kinds.length} duel previews → public/p/duel-*/ and public/p/img/duel-*.jpg${ok ? '' : ' (WARNING: the display font did not load)'}`);
