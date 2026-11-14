// Link previews for pass-the-budget chains, so the group chat sees whose turn it is: one 1200×630
// card (public/p/img/chain-t<turn>-p<percent>.jpg) and one small page (public/p/chain-t…/index.html)
// for each next turn (2 to 10, where 10 means 10 or later) and how far the chain has got (0, 20,
// 40, 60 or 80 percent and up), plus one for a chain that met its goal (chain-done).
// Link-preview crawlers read the page's tags and ignore the query string; people are forwarded to
// the game with the chain (and its turn clock) intact. The names in src/game/chainKit.ts
// (previewId, PREVIEW_TURNS, PREVIEW_PCTS) must match.
//   node scripts/make-chain-previews.mjs   (needs Playwright: npm i -g playwright, and Google Fonts)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const SITE = 'https://balancethebudget.us/';
const NAME = 'Help Uncle Sam Balance the Budget';
const TURNS = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const PCTS = [0, 20, 40, 60, 80];
const HOURS = 4;
const root = new URL('../public/p/', import.meta.url);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const kinds = [
  ...TURNS.flatMap((t) => PCTS.map((p) => {
    const turn = t === 10 ? '10+' : String(t);
    const far = p === 0 ? 'just getting started' : `${p}%+ of the way there`;
    return {
      id: `chain-t${t}-p${p}`, t, p, done: false,
      title: `Waiting on Turn ${turn}: your move on Uncle Sam’s budget`,
      description: `A pass-the-budget chain is ${far}. Make one change to Uncle Sam’s budget without wrecking the economy, then pass it on. ${HOURS}-hour turn clock. Real CBO numbers.`,
      alt: `Pass the budget: waiting on Turn ${turn}. The chain is ${far}.`,
    };
  })),
  {
    id: 'chain-done', t: 0, p: 100, done: true,
    title: 'Budget closed! See every hand in the chain',
    description: 'A pass-the-budget chain met its goal. See who taxed, who cut, and who closed the deal. Everyone in the chain gets credit. Real CBO numbers.',
    alt: 'Pass the budget: the chain met its goal. Budget closed.',
  },
];

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
<p>Opening the chain… <a id="go" href="../../?chain">Continue to the game</a></p>
<script>document.getElementById('go').href = new URL('../../', location.href).pathname + location.search + location.hash;</script>
</body>
</html>
`;

const card = (k) => {
  const hands = k.done ? '' : Array.from({ length: Math.min(k.t, 10) }, (_, i) => i < k.t - 1 ? '<div class="h on">✓</div>' : '<div class="h you">?</div>').join('');
  return `<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800&family=Public+Sans:wght@500;700;800&display=block"><style>
  body{margin:0;width:1200px;height:630px;background:#f2f4ef;color:#111b16;font-family:"Public Sans",sans-serif;display:flex;flex-direction:column;justify-content:space-between;padding:54px 68px;box-sizing:border-box}
  .top{display:flex;justify-content:space-between;align-items:center}
  .k{font:800 40px/1 "Big Shoulders Display",sans-serif;letter-spacing:.02em;text-transform:uppercase;color:#2467c4}
  .clock{font-size:28px;font-weight:800;padding:10px 22px;border-radius:999px;background:#111b16;color:#fff}
  .big{font:800 112px/.95 "Big Shoulders Display",sans-serif;margin-top:26px}
  .hands{display:flex;gap:14px;margin-top:26px}.h{width:62px;height:62px;border-radius:50%;display:grid;place-items:center;font-size:30px;font-weight:800}
  .h.on{background:#2467c4;color:#fff}.h.you{border:5px dashed #2467c4;color:#2467c4;box-sizing:border-box}
  .bar{position:relative;height:34px;border-radius:17px;background:#dde3dc;overflow:hidden;margin-top:30px}.bar i{position:absolute;inset:0 auto 0 0;width:${Math.max(4, k.p)}%;background:linear-gradient(90deg,#2467c4,#2f8a57);border-radius:17px}
  .sub{display:flex;justify-content:space-between;font-size:28px;font-weight:700;margin-top:12px}.sub span{color:#47524c;font-weight:500}
  .trophy{font-size:150px;line-height:1}.done{display:flex;gap:40px;align-items:center;margin-top:20px}
  .foot{display:flex;justify-content:space-between;font-size:22px;color:#47524c;font-weight:500}.foot b{font:800 28px/1 "Big Shoulders Display",sans-serif;color:#111b16;text-transform:uppercase}
</style></head><body>
  <div>
    <div class="top"><div class="k">Pass the budget</div>${k.done ? '' : `<div class="clock">⏳ ${HOURS}-hour turn clock</div>`}</div>
    ${k.done
      ? `<div class="done"><div class="trophy">🏆</div><div><div class="big">Budget closed!</div><div class="sub" style="display:block;margin-top:18px">See every hand in the chain,<br><span>and who closed the deal.</span></div></div></div>`
      : `<div class="big">Waiting on Turn ${k.t === 10 ? '10+' : k.t}…</div><div class="hands">${hands}</div>
    <div class="bar"><i></i></div><div class="sub">${k.p === 0 ? 'Just getting started' : `${k.p}%+ of the way there`}<span>Make one change, then pass it on</span></div>`}
  </div>
  <div class="foot"><b>${NAME}</b><span>balancethebudget.us · real CBO numbers</span></div>
</body></html>`;
};

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
console.log(`${kinds.length} chain previews → public/p/chain-*/ and public/p/img/chain-*.jpg${ok ? '' : ' (WARNING: the display font did not load)'}`);
