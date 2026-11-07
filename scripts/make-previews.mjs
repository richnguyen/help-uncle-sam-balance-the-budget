// Makes the link previews for shared plans: one 1200×630 card (public/p/img/<kind>.jpg) and one
// small static page (public/p/<kind>/index.html) per level × stars × budget personality.
// Link-preview crawlers read the page's tags and ignore the query string; people are forwarded to
// the game with the query string intact. Run with the dev server up:
//   npx vite --port 5173 &  node scripts/make-previews.mjs http://localhost:5173/
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Playwright is not a project dependency; use a global install (npm i -g playwright) or npx.
const { chromium } = createRequire(import.meta.url)('playwright');

const base = process.argv[2] || 'http://localhost:5173/';
const SITE = 'https://balancethebudget.us/';
const NAME = 'Help Uncle Sam Balance the Budget';
const root = new URL('../public/p/', import.meta.url);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const page_ = (k, t) => `<!doctype html>
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
<meta property="og:image" content="${SITE}p/img/${k.id}.jpg">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(t.alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(t.title)}">
<meta name="twitter:description" content="${esc(t.description)}">
<meta name="twitter:image" content="${SITE}p/img/${k.id}.jpg">
<meta name="twitter:image:alt" content="${esc(t.alt)}">
<link rel="icon" href="../../favicon.svg" type="image/svg+xml">
<script>location.replace(new URL('../../', location.href).pathname + location.search + location.hash);</script>
<style>body{margin:0;padding:32px 16px;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;background:#f2f4ef;color:#111b16}a{color:#1d5a43}</style>
</head>
<body>
<p>Opening the plan… <a id="go" href="../../">Continue to the game</a></p>
<script>document.getElementById('go').href = new URL('../../', location.href).pathname + location.search + location.hash;</script>
</body>
</html>
`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(base + '#og-card?k=10-3-mix-gentle');
await page.waitForSelector('.ogcard');
const { kinds, legacy } = await page.evaluate(async () => {
  const P = await import('/src/game/previews.ts');
  return {
    kinds: [...P.PREVIEW_KINDS.map((k) => ({ k, t: P.previewText(k) })), ...P.SPECIAL_PREVIEWS.map((x) => ({ k: { id: x.id }, t: x }))],
    legacy: P.LEGACY_PREVIEW_KINDS.map((k) => ({ k, t: P.previewText(k) })),
  };
});
mkdirSync(new URL('img/', root), { recursive: true });
for (const { k, t } of kinds) {
  await page.evaluate((id) => { location.hash = 'og-card?k=' + id; }, k.id);
  await page.waitForSelector(`.ogcard[data-kind="${k.id}"]`);
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(120);
  await page.screenshot({ path: new URL(`img/${k.id}.jpg`, root).pathname, type: 'jpeg', quality: 86, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  mkdirSync(new URL(`${k.id}/`, root), { recursive: true });
  writeFileSync(new URL(`${k.id}/index.html`, root), page_(k, t));
}
// Pages for links shared before the personalities went lean-neutral: the same preview as the
// matching new kind, image included.
for (const { k, t } of legacy) {
  mkdirSync(new URL(`${k.id}/`, root), { recursive: true });
  writeFileSync(new URL(`${k.id}/index.html`, root), page_({ ...k, id: k.image }, t));
}
const fontsOk = await page.evaluate(() => document.fonts.check('800 96px "Big Shoulders Display"') && document.fonts.check('600 28px "Public Sans"'));
await browser.close();
console.log(`${kinds.length} previews (plans, the People's Budget, chains, rooms) written to public/p/ (web fonts loaded: ${fontsOk})`);
