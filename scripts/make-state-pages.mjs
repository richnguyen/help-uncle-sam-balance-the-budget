// (The plan preview pages in /p/ stay crawlable: link-preview bots obey robots.txt, and those
// pages carry noindex themselves.)
// One page per state and territory (public/state/<ab>/index.html), an index of them
// (public/state/index.html), a sitemap and robots.txt. Unlike the game's own pages (#state-oh),
// these are real pages search engines can list and links can preview: federal money in the state
// (USAspending.gov), who paid federal income tax there (IRS), the sources, and links into the game.
// A partner code on the page's address (?via=code) is passed on to every link into the game.
//
//   node scripts/make-state-pages.mjs            pages, sitemap, robots.txt
//   node scripts/make-state-pages.mjs --images   also each page's 1200×630 card (public/state/img/<ab>.jpg);
//                                                needs Playwright (npm i -g playwright) and Google Fonts
//
// Rerun when the state figures change (npm run data refreshes them about once a year).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const SITE = 'https://balancethebudget.us/';
const NAME = 'Help Uncle Sam Balance the Budget';
const root = (p) => new URL(`../${p}`, import.meta.url);
const geo = JSON.parse(readFileSync(root('src/data/generated/geo.json'), 'utf8'));
const FLAGS = JSON.parse(readFileSync(root('src/data/generated/flags.json'), 'utf8')).flags;
const FY = geo.fy, PRIOR = geo.priorFY, NAT = geo.national;
const THE = new Set(['DC', 'MP', 'VI']);
const inName = (s) => (THE.has(s.abbr) ? 'the ' : '') + s.name;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dollars = (n) => '$' + Math.round(n).toLocaleString('en-US');
const money = (n) => {
  const a = Math.abs(n);
  const [d, u] = a >= 1e12 ? [1e12, 'trillion'] : a >= 1e9 ? [1e9, 'billion'] : a >= 1e6 ? [1e6, 'million'] : [1, ''];
  if (!u) return dollars(n);
  const v = n / d;
  return `$${v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(1).replace(/\.0$/, '')} ${u}`;
};
const people = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')} million` : Math.round(n).toLocaleString('en-US'));
const pct = (x) => `${Math.round(x * 100)}%`;
const pct1 = (x) => `${(x * 100).toFixed(1).replace(/\.0$/, '')}%`;
const TYPE = [['directPayments', 'Direct payments to people', 'Social Security, veterans’ benefits, farm payments and the like'], ['grants', 'Grants', 'mostly to state and local governments: Medicaid, highways, schools'], ['contracts', 'Contracts', 'goods and services the government buys'], ['loans', 'Loans', 'the cost recorded for federal loans'], ['other', 'Other', 'insurance and other assistance']];

/** The state's federal income tax picture from the IRS county file (50 states and DC only). */
function taxOf(ab) {
  const f = root(`public/county/${ab}.json`);
  if (!existsSync(f)) return null;
  const c = JSON.parse(readFileSync(f, 'utf8'));
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const R = sum(c.state.r), T = sum(c.state.t) * 1e3, uR = sum(c.us.r), uT = sum(c.us.t) * 1e3;
  return { ty: c.ty, returns: R, tax: T, perReturn: T / R, topR: c.state.r[4] / R, topT: (c.state.t[4] * 1e3) / T, uTopR: c.us.r[4] / uR, uTopT: (c.us.t[4] * 1e3) / uT };
}

const states = [...geo.states].sort((a, b) => a.name.localeCompare(b.name));
const facts = (s) => {
  const ratio = s.perCapita / NAT.perCapita;
  const change = s.priorTotal ? s.total / s.priorTotal - 1 : null;
  return { ratio, change, tax: taxOf(s.abbr) };
};

const CSS = `
:root{--paper:#f2f4ef;--surface:#fbfcfa;--ink:#111b16;--ink-2:#47524c;--muted:#5f6a64;--line:#dde2dc;--accent:#1d5a43;--wash:#dcebe3;--bar:#2f7a5a;--bar-2:#a9b4ae;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--paper:#0b100e;--surface:#131a17;--ink:#e8eee9;--ink-2:#b7c1bb;--muted:#9aa59f;--line:#25302b;--accent:#7cc3a3;--wash:#1c3329;--bar:#7cc3a3;--bar-2:#4a5650;color-scheme:dark}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 "Public Sans",system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--accent)}main{max-width:760px;margin:0 auto;padding:16px 16px 48px}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0 4px;font-size:.875rem}
.brand{font:800 1.1rem/1 "Big Shoulders Display","Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:.01em;color:var(--ink);text-decoration:none}
.crumb{font:500 .75rem/1.4 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:18px 0 6px}
.crumb a{color:var(--muted)}
h1{font:800 clamp(2.2rem,8vw,3.4rem)/.95 "Big Shoulders Display","Arial Narrow",sans-serif;text-transform:uppercase;margin:0 0 12px;display:flex;align-items:center;gap:14px}
h1 img{width:54px;height:36px;object-fit:contain;flex:none;border-radius:3px;outline:1px solid color-mix(in srgb,var(--ink) 14%,transparent);outline-offset:-1px}
h2{font:800 1.5rem/1.05 "Big Shoulders Display","Arial Narrow",sans-serif;text-transform:uppercase;margin:32px 0 10px}
.lede{font-size:1.125rem;color:var(--ink-2);margin:0 0 18px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:0 0 8px}
.stat{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.stat b{display:block;font:800 1.9rem/1 "Big Shoulders Display","Arial Narrow",sans-serif}
.stat span{display:block;margin-top:6px;line-height:1.35;font-size:.8125rem;color:var(--muted)}
.bars{list-style:none;padding:0;margin:0;display:grid;gap:10px}
.bars li{display:grid;gap:3px}.bars .row{display:flex;justify-content:space-between;gap:10px;font-size:.9375rem}
.bars .track{height:10px;background:var(--line);border-radius:5px;overflow:hidden}.bars .fill{display:block;height:100%;background:var(--bar);border-radius:5px}
.bars small{color:var(--muted);font-size:.8125rem}
ol.top5{margin:0;padding-left:1.3em}ol.top5 li{margin:4px 0}.num{font-variant-numeric:tabular-nums}
.compare{display:grid;gap:6px;margin:6px 0 4px}.compare .track{height:14px}.compare .fill.us{background:var(--bar-2)}
.cta{display:grid;gap:10px;margin:28px 0 8px}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:10px 18px;border-radius:10px;font-weight:700;text-decoration:none;border:1px solid var(--line);background:var(--surface);color:var(--ink);text-align:center}
.btn.primary{background:var(--accent);border-color:var(--accent);color:var(--paper)}
.note{font-size:.875rem;color:var(--muted)}
.sources{font-size:.875rem;color:var(--ink-2)}.sources li{margin:4px 0}
.all{columns:2 11rem;list-style:none;padding:0;margin:0;font-size:.9375rem}.all li{break-inside:avoid;padding:2px 0}
.idx{width:100%;border-collapse:collapse;font-size:.9375rem}.idx th,.idx td{padding:8px 6px;border-bottom:1px solid var(--line);text-align:left}.idx td.r,.idx th.r{text-align:right}
.idx img{width:24px;height:16px;object-fit:contain;vertical-align:-3px;margin-right:8px;outline:1px solid color-mix(in srgb,var(--ink) 14%,transparent);outline-offset:-1px}
footer{margin-top:36px;padding-top:14px;border-top:1px solid var(--line)}
`;

const head = ({ title, description, path, image, imageAlt }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${path}">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f2f4ef">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b100e">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${NAME}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${image}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800&family=IBM+Plex+Mono:wght@500&family=Public+Sans:wght@400;700&display=swap">
<style>${CSS}</style>
</head>
<body>
<main>
<div class="top"><a class="brand" href="/" data-game>${NAME}</a><a href="/state/">All states</a></div>
`;

// Links into the game carry a partner code from this page's address (?via=…), so the partner
// who sent the reader here is credited when they play.
const tail = `<footer class="note">An educational game with official figures; no ads, no sign-up. <a href="/#sources" data-game>Sources and methods</a>.</footer>
</main>
<script>
(function () {
  var v = new URLSearchParams(location.search).get('via');
  if (!v || !/^[a-z0-9][a-z0-9-]{1,23}$/.test(v)) return;
  document.querySelectorAll('a[data-game]').forEach(function (a) {
    var u = new URL(a.getAttribute('href'), location.href);
    u.searchParams.set('via', v);
    a.setAttribute('href', u.pathname + u.search + u.hash);
  });
  document.querySelectorAll('a[data-page]').forEach(function (a) {
    var u = new URL(a.getAttribute('href'), location.href);
    u.searchParams.set('via', v);
    a.setAttribute('href', u.pathname + u.search);
  });
})();
</script>
</body>
</html>
`;

const bar = (label, value, max, sub) => `<li><div class="row"><span>${esc(label)}</span><span class="num">${money(value)}</span></div><div class="track"><span class="fill" style="width:${Math.max(1, Math.round((value / max) * 100))}%"></span></div>${sub ? `<small>${esc(sub)}</small>` : ''}</li>`;

function statePage(s) {
  const ab = s.abbr.toLowerCase();
  const { ratio, change, tax } = facts(s);
  const where = inName(s);
  const title = `Federal money in ${where}: ${dollars(s.perCapita)} per person (FY${FY})`;
  const description = `In fiscal year ${FY}, federal agencies recorded ${money(s.total)} in grants, contracts and payments in ${where}: ${dollars(s.perCapita)} per person, ${pct(ratio)} of the national ${dollars(NAT.perCapita)}.${tax ? ` Plus who paid federal income tax there, on ${tax.ty} returns.` : ''}`;
  const types = TYPE.map(([k, l, sub]) => [l, s.byType?.[k] ?? 0, sub]).filter(([, v]) => v > 0);
  const tmax = Math.max(...types.map(([, v]) => v));
  const flag = FLAGS[s.abbr];
  const cmpMax = Math.max(s.perCapita, NAT.perCapita);
  return head({ title, description, path: `state/${ab}/`, image: `${SITE}state/img/${ab}.jpg`, imageAlt: `${s.name}: ${dollars(s.perCapita)} in federal money per person in FY${FY}, ${pct(ratio)} of the national average.` }) + `
<nav class="crumb" aria-label="Breadcrumb"><a href="/state/" data-page>All states</a> › ${esc(s.name)}</nav>
<h1>${flag ? `<img src="/flags/${s.abbr}.png" alt="" width="54" height="36">` : ''}Federal money in ${esc(where)}</h1>
<p class="lede">In fiscal year ${FY}, federal agencies recorded <strong>${money(s.total)}</strong> in grants, contracts and payments in ${esc(where)}: <strong>${dollars(s.perCapita)}</strong> for each of its ${people(s.population)} people, ${pct(ratio)} of the national ${dollars(NAT.perCapita)}.</p>
<div class="stats">
  <div class="stat"><b class="num">${money(s.total)}</b><span>federal awards, FY${FY}</span></div>
  <div class="stat"><b class="num">${dollars(s.perCapita)}</b><span>per person</span></div>
  <div class="stat"><b class="num">${pct(ratio)}</b><span>of the national ${dollars(NAT.perCapita)} per person</span></div>
  ${change != null ? `<div class="stat"><b class="num">${change >= 0 ? '+' : '−'}${pct1(Math.abs(change))}</b><span>from FY${PRIOR} (${money(s.priorTotal)})</span></div>` : ''}
</div>
<div class="compare" aria-hidden="true">
  <div class="bars"><li><div class="row"><span>${esc(s.name)}</span><span class="num">${dollars(s.perCapita)}</span></div><div class="track"><span class="fill" style="width:${Math.round((s.perCapita / cmpMax) * 100)}%"></span></div></li>
  <li><div class="row"><span>United States</span><span class="num">${dollars(NAT.perCapita)}</span></div><div class="track"><span class="fill us" style="width:${Math.round((NAT.perCapita / cmpMax) * 100)}%"></span></div></li></div>
</div>

<h2>What kind of money</h2>
<ul class="bars">${types.map(([l, v, sub]) => bar(l, v, tmax, sub)).join('')}</ul>

<h2>The biggest programs</h2>
<ol class="top5">${(s.programs ?? []).slice(0, 5).map((p) => `<li>${esc(p.name)}: <span class="num">${money(p.amount)}</span></li>`).join('')}</ol>
${s.agencies?.length ? `<p class="note">The agencies that sent the most: ${s.agencies.slice(0, 3).map((a) => `${esc(a.name)} (${money(a.amount)})`).join(', ')}.</p>` : ''}

${tax ? `<h2>Who paid federal income tax</h2>
<p>On ${tax.ty} tax returns, ${people(tax.returns)} returns from ${esc(where)} paid <strong>${money(tax.tax)}</strong> in federal income tax, about ${dollars(tax.perReturn)} per return. Returns with $200,000 or more of income were <strong>${pct1(tax.topR)}</strong> of the returns and paid <strong>${pct1(tax.topT)}</strong> of the tax (nationally: ${pct1(tax.uTopR)} and ${pct1(tax.uTopT)}).</p>
<p class="note">County by county, with your ZIP code, in the game.</p>` : `<h2>Federal income tax</h2>
<p class="note">The IRS’s county figures cover the 50 states and DC; returns filed from Puerto Rico and the territories aren’t in them.</p>`}

<div class="cta">
  <a class="btn primary" href="/#level-3" data-game>Find your county and state with your ZIP code</a>
  <a class="btn" href="/#state-${ab}" data-game>Every district in ${esc(where)}</a>
  <a class="btn" href="/#daily" data-game>Play today’s Daily Dollar</a>
</div>

<h2>Sources</h2>
<ul class="sources">
  <li>Federal awards: <a href="https://www.usaspending.gov/">USAspending.gov</a>, obligations in FY${FY} by place of performance. Obligations are commitments to spend, not outlays, and not every federal dollar is recorded as an award. Medicare (${money(NAT.medicare)} nationally) is left out because it is recorded where insurers and claims processors are based.</li>
  ${tax ? `<li>Income tax: <a href="https://www.irs.gov/statistics/soi-tax-stats-county-data">IRS Statistics of Income, county data</a>, tax year ${tax.ty}.</li>` : ''}
  <li>Population: U.S. Census Bureau. ${flag ? `Flag: <a href="${esc(flag.page)}">Wikimedia Commons</a> (${esc(flag.license)}).` : ''}</li>
</ul>

<h2>Other states</h2>
<ul class="all">${states.filter((x) => x.abbr !== s.abbr).map((x) => `<li><a href="/state/${x.abbr.toLowerCase()}/" data-page>${esc(x.name)}</a></li>`).join('')}</ul>
` + tail;
}

function indexPage() {
  const title = `Federal money by state, FY${FY}`;
  const description = `Federal grants, contracts and payments in every state and territory in fiscal year ${FY}, per person and against the national ${dollars(NAT.perCapita)}, with who paid federal income tax there.`;
  return head({ title, description, path: 'state/', image: `${SITE}og-image.png`, imageAlt: NAME }) + `
<nav class="crumb" aria-label="Breadcrumb"><a href="/" data-game>The game</a> › States</nav>
<h1>Federal money by state</h1>
<p class="lede">What federal agencies recorded in grants, contracts and payments in each state and territory in fiscal year ${FY}, per person, next to the national ${dollars(NAT.perCapita)}. In alphabetical order.</p>
<table class="idx"><thead><tr><th scope="col">State</th><th scope="col" class="r">Per person</th><th scope="col" class="r">Of national</th><th scope="col" class="r">Total</th></tr></thead>
<tbody>${states.map((s) => `<tr><th scope="row">${FLAGS[s.abbr] ? `<img src="/flags/${s.abbr}.png" alt="" width="24" height="16">` : ''}<a href="/state/${s.abbr.toLowerCase()}/" data-page>${esc(s.name)}</a></th><td class="r num">${dollars(s.perCapita)}</td><td class="r num">${pct(s.perCapita / NAT.perCapita)}</td><td class="r num">${money(s.total)}</td></tr>`).join('')}</tbody></table>
<p class="note">Source: <a href="https://www.usaspending.gov/">USAspending.gov</a>, obligations by place of performance; Medicare is left out (it is recorded where insurers are based).</p>
` + tail;
}

// ---- write the pages, sitemap and robots.txt
mkdirSync(root('public/state/'), { recursive: true });
for (const s of states) {
  mkdirSync(root(`public/state/${s.abbr.toLowerCase()}/`), { recursive: true });
  writeFileSync(root(`public/state/${s.abbr.toLowerCase()}/index.html`), statePage(s));
}
writeFileSync(root('public/state/index.html'), indexPage());
const day = new Date().toISOString().slice(0, 10);
const urls = ['', 'state/', ...states.map((s) => `state/${s.abbr.toLowerCase()}/`)];
writeFileSync(root('public/sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${day}</lastmod></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(root('public/robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`);
console.log(`${states.length} state pages, an index, sitemap.xml (${urls.length} URLs) and robots.txt → public/`);

// ---- the cards
if (process.argv.includes('--images')) {
  const { chromium } = createRequire(import.meta.url)('playwright');
  mkdirSync(root('public/state/img/'), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const s of states) {
    const { ratio } = facts(s);
    const flag = existsSync(root(`public/flags/${s.abbr}.png`)) ? `data:image/png;base64,${readFileSync(root(`public/flags/${s.abbr}.png`)).toString('base64')}` : '';
    const max = Math.max(s.perCapita, NAT.perCapita);
    await page.setContent(`<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800&family=Public+Sans:wght@500;700&display=block"><style>
      body{margin:0;width:1200px;height:630px;background:#f2f4ef;color:#111b16;font-family:"Public Sans",sans-serif;display:flex;flex-direction:column;justify-content:space-between;padding:56px 64px;box-sizing:border-box}
      .t{display:flex;align-items:center;gap:22px;font:800 64px/1 "Big Shoulders Display",sans-serif;text-transform:uppercase}
      .t img{width:96px;height:64px;object-fit:contain;border-radius:4px;outline:2px solid rgba(17,27,22,.14);outline-offset:-2px}
      .big{font:800 150px/.9 "Big Shoulders Display",sans-serif;color:#1d5a43;margin-top:18px}
      .sub{font-size:30px;font-weight:500;color:#47524c;margin-top:8px}
      .bars{display:grid;gap:12px;margin-top:22px}.r{display:grid;grid-template-columns:210px 1fr 150px;align-items:center;gap:16px;font-size:24px;font-weight:700}
      .tr{height:22px;background:#dde2dc;border-radius:11px;overflow:hidden}.f{height:100%;background:#2f7a5a;border-radius:11px}.f.us{background:#a9b4ae}.v{text-align:right}
      .foot{display:flex;justify-content:space-between;font-size:22px;color:#47524c;font-weight:500}.foot b{font:800 28px/1 "Big Shoulders Display",sans-serif;color:#111b16;text-transform:uppercase}
    </style></head><body>
      <div><div class="t">${flag ? `<img src="${flag}">` : ''}${esc(s.name)}</div>
      <div class="big">${dollars(s.perCapita)}</div>
      <div class="sub">in federal grants, contracts and payments per person, FY${FY} · ${pct(ratio)} of the national average</div>
      <div class="bars"><div class="r"><span>${esc(s.abbr)}</span><div class="tr"><div class="f" style="width:${(s.perCapita / max) * 100}%"></div></div><span class="v">${dollars(s.perCapita)}</span></div>
      <div class="r"><span>United States</span><div class="tr"><div class="f us" style="width:${(NAT.perCapita / max) * 100}%"></div></div><span class="v">${dollars(NAT.perCapita)}</span></div></div></div>
      <div class="foot"><b>${NAME}</b><span>balancethebudget.us · USAspending.gov</span></div>
    </body></html>`, { waitUntil: 'networkidle' });
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.screenshot({ path: root(`public/state/img/${s.abbr.toLowerCase()}.jpg`).pathname, type: 'jpeg', quality: 84 });
  }
  const ok = await page.evaluate(() => document.fonts.check('800 64px "Big Shoulders Display"'));
  await browser.close();
  console.log(`${states.length} cards → public/state/img/${ok ? '' : ' (WARNING: the display font did not load; the cards used a fallback)'}`);
}
