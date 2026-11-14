// Link previews for shared Daily Dollar results: one 1200×630 card (public/p/img/daily-<grid>.jpg)
// and one small page (public/p/daily-<grid>/index.html) for each of the 32 right/wrong patterns of
// five calls, e.g. daily-11011 for right, right, wrong, right, right. Spoiler-free: the card shows
// only the pattern and the score, never the numbers. Link-preview crawlers read the page's tags;
// people are forwarded to the game with the link's query string (the puzzle, pattern and name)
// intact, where the game shows the two results side by side once they've played.
//   node scripts/make-daily-previews.mjs   (needs Playwright: npm i -g playwright, and Google Fonts)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const SITE = 'https://balancethebudget.us/';
const NAME = 'Help Uncle Sam Balance the Budget';
const ROUNDS = 5;
const root = new URL('../public/p/', import.meta.url);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const patterns = Array.from({ length: 2 ** ROUNDS }, (_, i) => i.toString(2).padStart(ROUNDS, '0'));
const textFor = (b) => {
  const score = [...b].filter((c) => c === '1').length;
  return {
    title: `The Daily Dollar: ${score} of ${ROUNDS}. Your turn.`,
    description: 'Five quick calls on real federal numbers: is the next one higher or lower? Same puzzle for everyone today. No sign-up, about a minute.',
    alt: `A Daily Dollar result: ${score} of ${ROUNDS} calls right (${[...b].map((c) => (c === '1' ? 'right' : 'wrong')).join(', ')}).`,
    score,
  };
};

const page = (b, t) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.title)} · ${NAME}</title>
<meta name="description" content="${esc(t.description)}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${NAME}">
<meta property="og:title" content="${esc(t.title)}">
<meta property="og:description" content="${esc(t.description)}">
<meta property="og:image" content="${SITE}p/img/daily-${b}.jpg">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(t.alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(t.title)}">
<meta name="twitter:description" content="${esc(t.description)}">
<meta name="twitter:image" content="${SITE}p/img/daily-${b}.jpg">
<meta name="twitter:image:alt" content="${esc(t.alt)}">
<link rel="icon" href="../../favicon.svg" type="image/svg+xml">
<script>location.replace(new URL('../../', location.href).pathname + location.search + location.hash);</script>
<style>body{margin:0;padding:32px 16px;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;background:#f2f4ef;color:#111b16}a{color:#1d5a43}</style>
</head>
<body>
<p>Opening the Daily Dollar… <a id="go" href="../../?daily">Continue to the game</a></p>
<script>document.getElementById('go').href = new URL('../../', location.href).pathname + location.search + location.hash;</script>
</body>
</html>
`;

const card = (b, t) => `<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800&family=Public+Sans:wght@500;700&display=block"><style>
  body{margin:0;width:1200px;height:630px;background:#f2f4ef;color:#111b16;font-family:"Public Sans",sans-serif;display:flex;flex-direction:column;justify-content:space-between;padding:58px 68px;box-sizing:border-box}
  .k{font:800 40px/1 "Big Shoulders Display",sans-serif;letter-spacing:.02em;text-transform:uppercase;color:#1d5a43}
  .row{display:flex;align-items:center;gap:56px;margin-top:26px}
  .grid{display:flex;gap:16px}.sq{width:112px;height:112px;border-radius:14px;background:#2467c4}.sq.w{background:#fff;outline:4px solid #c9d0ca;outline-offset:-4px}
  .score{font:800 156px/.85 "Big Shoulders Display",sans-serif}.score small{font-size:64px;color:#47524c}
  .sub{font-size:34px;font-weight:700;margin-top:30px}.sub span{display:block;font-weight:500;color:#47524c;font-size:28px;margin-top:6px}
  .foot{display:flex;justify-content:space-between;font-size:22px;color:#47524c;font-weight:500}.foot b{font:800 28px/1 "Big Shoulders Display",sans-serif;color:#111b16;text-transform:uppercase}
</style></head><body>
  <div><div class="k">The Daily Dollar</div>
  <div class="row"><div class="grid">${[...b].map((c) => `<div class="sq${c === '1' ? '' : ' w'}"></div>`).join('')}</div><div class="score">${t.score}<small> / ${ROUNDS}</small></div></div>
  <div class="sub">Higher or lower, on real federal numbers. Your turn.<span>Same puzzle for everyone today · about a minute · no sign-up</span></div></div>
  <div class="foot"><b>${NAME}</b><span>balancethebudget.us</span></div>
</body></html>`;

mkdirSync(new URL('img/', root), { recursive: true });
const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const b of patterns) {
  const t = textFor(b);
  await pg.setContent(card(b, t), { waitUntil: 'networkidle' });
  await pg.evaluate(async () => { await document.fonts.ready; });
  await pg.screenshot({ path: new URL(`img/daily-${b}.jpg`, root).pathname, type: 'jpeg', quality: 84 });
  mkdirSync(new URL(`daily-${b}/`, root), { recursive: true });
  writeFileSync(new URL(`daily-${b}/index.html`, root), page(b, t));
}
const ok = await pg.evaluate(() => document.fonts.check('800 40px "Big Shoulders Display"'));
await browser.close();
console.log(`${patterns.length} Daily Dollar previews → public/p/daily-*/ and public/p/img/daily-*.jpg${ok ? '' : ' (WARNING: the display font did not load)'}`);
