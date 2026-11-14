// Link previews for Sealed Showdown invites: a classified dossier for a sealed budget plan. The
// site is static, so the card can't be drawn per link; instead there is a pre-drawn dossier for
// every combination of what a sealed plan shows:
//   its rating (gentle / moderate / steep), how many cards it plays (3 or fewer, 4 to 11, 12 or
//   more), and where the debt lands (to the nearest 5% of GDP, from 70 to 90)
// which is 3 × 10 × 5 = 150 pages, public/p/duel-<rating>-c<cards>-d<debt>/index.html, each with
// its image, public/p/img/duel-<rating>-c<cards>-d<debt>.jpg. The invite link (src/game/duel.ts,
// inviteLink / dossierId) goes through the matching page; people are forwarded to the game with
// the showdown intact. The sender's name and the exact figures ride in the message text.
// (The three older pages, duel-gentle / -moderate / -steep, stay for links already sent.)
//   node scripts/make-duel-previews.mjs [http://localhost:5173/]
//   (needs Playwright and Google Fonts; with the dev server's address it reads the projection's
//    last year from the game, otherwise pass LAST_FY=2031)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const SITE = 'https://balancethebudget.us/';
const NAME = 'Help Uncle Sam Balance the Budget';
const root = new URL('../public/p/', import.meta.url);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const RATINGS = [['gentle', 'Gentle', '#2f7d51'], ['moderate', 'Moderate', '#a87c12'], ['steep', 'Steep', '#b8402b']];
const CARDS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const DEBTS = [70, 75, 80, 85, 90];
const cardsText = (c) => (c === 3 ? '3 or fewer' : c === 12 ? '12 or more' : String(c));
const debtText = (d) => (d === 70 ? '70% of GDP or less' : `about ${d}% of GDP`);

const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
let FY = Number(process.env.LAST_FY) || 0;
if (process.argv[2]) {
  await pg.goto(process.argv[2] + '#sources');
  FY = await pg.evaluate(async () => (await import('/src/lib/assess.ts')).LAST_FY);
}
if (!FY) throw new Error('Pass the dev server address, or LAST_FY=<year>.');

const kinds = RATINGS.flatMap(([id, word, color]) => CARDS.flatMap((c) => DEBTS.map((d) => ({
  id: `duel-${id}-c${c}-d${d}`, word, color, c, d,
  title: `🔒 Sealed budget plan · Classified. Rating: ${word} · ${cardsText(c)} CBO options · debt ${debtText(d)} by FY${FY}`,
  description: 'A friend balanced Uncle Sam’s budget and sealed the plan. Build yours to unseal their moves, then face off across 3 rounds: Debt, Economy, Balance. Plans compared, never people. Real CBO numbers.',
  alt: `A classified dossier for a sealed budget plan. Rating: ${word}. Cards played: ${cardsText(c)} CBO options. Debt by FY${FY}: ${debtText(d)}. The moves are blacked out.`,
}))));

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
<p>Opening the Sealed Showdown… <a id="go" href="../../">Continue to the game</a></p>
<script>document.getElementById('go').href = new URL('../../', location.href).pathname + location.search + location.hash;</script>
</body>
</html>
`;

// The blacked-out moves: one bar per card (six at most), lengths from a fixed scramble.
const bars = (k) => Array.from({ length: Math.min(6, k.c) }, (_, i) => 170 + ((k.c * 37 + k.d * 13 + i * 71 + k.word.length * 29) % 160));
const card = (k) => `<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800&family=Public+Sans:wght@500;700;800&display=block"><style>
  body{margin:0;width:1200px;height:630px;background:#14261f;font-family:"Public Sans",sans-serif;display:flex;align-items:center;justify-content:center}
  .folder{position:relative;width:1080px;height:508px;margin-top:50px;background:#ead7ab;border-radius:6px 26px 26px 26px;box-shadow:inset 0 0 0 4px #c9a86a,0 10px 0 #b8955a;padding:34px 52px;box-sizing:border-box;color:#2b2213}
  .tab{position:absolute;top:-50px;left:0;padding:12px 28px 10px;background:#ead7ab;border-radius:16px 16px 0 0;box-shadow:inset 0 4px 0 #c9a86a,inset 4px 0 0 #c9a86a,inset -4px 0 0 #c9a86a;font-weight:800;font-size:25px;letter-spacing:.12em;text-transform:uppercase}
  .stamp{position:absolute;top:26px;right:44px;transform:rotate(-9deg);border:7px solid #b4232f;color:#b4232f;border-radius:12px;padding:2px 20px;font:800 58px/1.05 "Big Shoulders Display",sans-serif;letter-spacing:.08em}
  .facts{display:grid;grid-template-columns:auto auto;gap:14px 26px;align-items:center;justify-content:start;margin-top:4px;max-width:760px}
  .k{font-size:22px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#6b5a36}
  .v{font:800 46px/1 "Big Shoulders Display",sans-serif;letter-spacing:.01em}
  .r{display:inline-block;padding:4px 22px 6px;border-radius:999px;background:${k.color};color:#fff;font:800 42px/1 "Big Shoulders Display",sans-serif;letter-spacing:.06em;text-transform:uppercase}
  .moves{margin-top:26px;width:700px}
  .moves .k{display:block;margin-bottom:10px}
  .bars{display:grid;grid-template-columns:1fr 1fr;gap:11px 26px}
  .bar{height:24px;background:#17130b;border-radius:3px}
  .seal{position:absolute;right:86px;top:196px;width:170px;height:170px;border-radius:50%;background:#b4232f;box-shadow:0 0 0 12px #8f1b25;display:grid;place-items:center;font-size:84px;transform:rotate(-7deg)}
  .cta{position:absolute;left:52px;right:52px;bottom:56px;font-size:29px;font-weight:800;line-height:1.25}
  .cta span{font-weight:500;color:#5b4c2e}
  .foot{position:absolute;left:52px;bottom:20px;font-size:19px;color:#5b4c2e}
</style></head><body><div class="folder">
  <div class="tab">Sealed budget plan · Classified</div><div class="stamp">CLASSIFIED</div>
  <div class="facts">
    <div class="k">Plan rating</div><div><span class="r">${k.word}</span></div>
    <div class="k">Cards played</div><div class="v">${cardsText(k.c)} CBO options</div>
    <div class="k">Debt by FY${FY}</div><div class="v">${debtText(k.d)}</div>
  </div>
  <div class="moves"><span class="k">Moves</span><div class="bars">${bars(k).map((w) => `<div class="bar" style="width:${w}px"></div>`).join('')}</div></div>
  <div class="seal">🔒</div>
  <div class="cta">Build your own plan to unseal the moves. <span>Then face off across 3 rounds: Debt · Economy · Balance</span></div>
  <div class="foot"><b>${NAME}</b> · balancethebudget.us · real CBO numbers</div>
</div></body></html>`;

mkdirSync(new URL('img/', root), { recursive: true });
for (const k of kinds) {
  await pg.setContent(card(k), { waitUntil: 'networkidle' });
  await pg.evaluate(async () => { await document.fonts.ready; });
  await pg.screenshot({ path: new URL(`img/${k.id}.jpg`, root).pathname, type: 'jpeg', quality: 74 });
  mkdirSync(new URL(`${k.id}/`, root), { recursive: true });
  writeFileSync(new URL(`${k.id}/index.html`, root), page(k));
}
const ok = await pg.evaluate(() => document.fonts.check('800 40px "Big Shoulders Display"'));
await browser.close();
console.log(`${kinds.length} sealed-plan dossiers → public/p/duel-*/ and public/p/img/duel-*.jpg (FY${FY})${ok ? '' : ' (WARNING: the display font did not load)'}`);
