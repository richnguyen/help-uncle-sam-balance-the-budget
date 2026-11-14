// Growth plumbing: the state pages (real pages for search and link previews) and partner codes
// (?via=code): the page passes the code on, the game counts the arrival once and takes the code
// out of the address, credits the partner with what the player does, and the stats page shows
// partner counts and makes partner links. Supabase is a stand-in; nothing reaches the real project.
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const geo = require('../../src/data/generated/geo.json');
const base = 'http://localhost:5173/';
(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const ctxWith = async (extra = {}) => {
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    await ctx.addInitScript((x) => { window.__plays = []; if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, done: [], settings: { freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false } })); for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v); }, extra);
    return ctx;
  };

  // 1. A state page: its own address, title, numbers and card; links into the game carry the code.
  const ctx = await ctxWith();
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base + 'state/oh/index.html?via=tangle'); await p.waitForTimeout(600);
  const oh = geo.states.find((s) => s.abbr === 'OH');
  const per = '$' + Math.round(oh.perCapita).toLocaleString('en-US');
  const meta = await p.evaluate(() => ({ title: document.title, canon: document.querySelector('link[rel=canonical]')?.href, og: document.querySelector('meta[property="og:image"]')?.content, robots: document.querySelector('meta[name=robots]')?.content ?? '' }));
  ok(meta.title.includes('Federal money in Ohio') && meta.title.includes(per) && meta.canon === 'https://balancethebudget.us/state/oh/' && meta.og === 'https://balancethebudget.us/state/img/oh.jpg' && !/noindex/.test(meta.robots), `the page has its own title, address and card, and may be listed: ${meta.title}`);
  const text = await p.locator('main').innerText();
  ok(text.includes(per) && /of the national \$12,154/.test(text) && /Who paid federal income tax/i.test(text) && /\$200,000 or more/.test(text), 'it states the figures: per person, against the nation, and who paid income tax');
  const ctas = await p.locator('a[data-game]').evaluateAll((l) => l.map((a) => a.getAttribute('href')));
  ok(ctas.includes('/?via=tangle#level-3') && ctas.includes('/?via=tangle#state-oh') && ctas.includes('/?via=tangle#daily'), 'links into the game carry the partner code: ' + ctas.slice(1, 4).join(' '));
  ok((await p.locator('a[data-page]').first().getAttribute('href')).includes('via=tangle'), 'and so do links to other state pages');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: no sideways scroll');
  const flag = p.locator('h1 img');
  ok(await flag.getAttribute('src') === '/flags/OH.png' && await flag.getAttribute('alt') === '', 'the state’s flag beside its name, decorative');
  await p.screenshot({ path: __OUT + '/state-oh.png', fullPage: false });
  // A territory: no IRS county data, and it says so.
  await p.goto(base + 'state/pr/index.html'); await p.waitForTimeout(300);
  ok(/50 states and DC/.test(await p.locator('main').innerText()) && !(await p.locator('a[data-game]').first().getAttribute('href')).includes('via'), 'Puerto Rico: the income-tax note; no code on the links when none was given');
  // Every state and territory, the index, the sitemap and robots.txt.
  const files = await p.evaluate(async (abs) => { const bad = []; for (const a of abs) { const r = await fetch(`/state/${a}/index.html`); const t = await r.text(); if (!r.ok || !t.includes('<link rel="canonical"')) bad.push(a); const i = await fetch(`/state/img/${a}.jpg`); if (!i.ok) bad.push(a + '.jpg'); } return bad; }, geo.states.map((s) => s.abbr.toLowerCase()));
  ok(!files.length, `a page and a card for all ${geo.states.length} states and territories` + (files.length ? ': missing ' + files.join(' ') : ''));
  const sm = await p.evaluate(async () => (await fetch('/sitemap.xml')).text());
  const robots = await p.evaluate(async () => (await fetch('/robots.txt')).text());
  ok((sm.match(/<loc>/g) || []).length === geo.states.length + 2 && sm.includes('https://balancethebudget.us/state/oh/'), 'the sitemap lists the game, the index and every state page');
  ok(/Sitemap: https:\/\/balancethebudget\.us\/sitemap\.xml/.test(robots) && !/Disallow: \/p\//.test(robots), 'robots.txt points to the sitemap and leaves link previews (/p/) crawlable');

  // 2. Into the game from the page: the arrival is counted once, and the code leaves the address.
  await p.goto(base + 'state/oh/index.html?via=tangle'); await p.waitForTimeout(300);
  await p.locator('a.btn.primary').click(); await p.waitForTimeout(1500);
  const plays1 = await p.evaluate(() => window.__plays.map((x) => x.join(':')));
  ok(plays1.includes('partner_arrival:tangle') && !/via=/.test(p.url()) && /#level-3$/.test(p.url()), 'the game counts the partner arrival and takes the code out of the address: ' + p.url().replace(base, '/'));
  const touch = await p.evaluate(() => JSON.parse(localStorage.getItem('ftd:via')));
  ok(touch?.code === 'tangle', 'the first partner is kept in this browser to credit later steps');
  // A second partner later doesn't take the credit, and a repeat arrival isn't counted twice.
  // (The log of what was sent starts empty on each page load.)
  await p.goto(base + '?via=other-letter#journey'); await p.waitForTimeout(900);
  const other = await p.evaluate(() => window.__plays.map((x) => x.join(':')));
  await p.goto(base + '?via=tangle#journey'); await p.waitForTimeout(900);
  const again = await p.evaluate(() => window.__plays.map((x) => x.join(':')));
  ok(other.includes('partner_arrival:other-letter') && !again.includes('partner_arrival:tangle') && JSON.parse(await p.evaluate(() => localStorage.getItem('ftd:via'))).code === 'tangle', 'another partner’s arrival counts for them, but the first partner keeps the credit; a repeat arrival isn’t counted twice');
  // Playing a step credits the first partner, once.
  await p.goto(base + '#level-1'); await p.waitForTimeout(1200);
  await p.evaluate(() => [...document.querySelectorAll('.level-nav .btn-primary')].at(-1)?.click()); await p.waitForTimeout(900);
  const plays3 = await p.evaluate(() => window.__plays.map((x) => x.join(':')));
  ok(plays3.filter((x) => x === 'partner_played:tangle').length === 1, 'finishing a mission step credits the partner as “played”, once');
  // A malformed code is ignored but still taken out of the address.
  const q = await (await ctxWith()).newPage();
  await q.goto(base + '?via=Not%20A%20Code#journey'); await q.waitForTimeout(900);
  ok(!(await q.evaluate(() => window.__plays.some((x) => x[0].startsWith('partner_')))) && !/via=/.test(q.url()) && !(await q.evaluate(() => localStorage.getItem('ftd:via'))), 'a malformed code counts nothing and is taken out of the address');
  // Coming back on a later day counts as "returned".
  const r = await (await ctxWith({ 'ftd:via': JSON.stringify({ code: 'tangle', day: '2026-01-01' }) })).newPage();
  await r.goto(base + '#journey'); await r.waitForTimeout(900);
  ok((await r.evaluate(() => window.__plays.map((x) => x.join(':')))).includes('partner_returned:tangle'), 'a player from a partner link who comes back on a later day counts as “returned”');

  // 3. The stats page (database mocked): partner counts, and the link maker.
  const sctx = await ctxWith({ 'ftd:backend': JSON.stringify('on') });
  const sent = [];
  await sctx.route(/supabase\.co\//, async (route) => {
    const u = route.request().url();
    if (/rpc\/count_partner/.test(u)) { sent.push(route.request().postData()); return route.fulfill({ status: 204, body: '' }); }
    if (/rpc\/partner_stats/.test(u)) return route.fulfill({ json: { window_days: 30, since: '2026-10-16', codes: { tangle: { arrival: 40, played: 22, finished: 9, returned: 12, shared: 3 }, 'ap-macro-1': { arrival: 8, played: 7 } }, daily: [{ day: '2026-11-13', code: 'tangle', metric: 'arrival', n: 40 }] } });
    if (/rpc\/play_stats/.test(u)) return route.fulfill({ json: { window_days: 30, since: '2026-10-16', totals: {}, daily: [] } });
    if (/rpc\/share_stats/.test(u)) return route.fulfill({ json: { window_days: 30, since: '2026-10-16', shares: {}, arrivals: {}, players: {}, players_all: 0, daily: [], funnel: null } });
    return route.fulfill({ status: 200, json: {} });
  });
  const s = await sctx.newPage(); s.on('pageerror', (e) => errs.push(e.message));
  await s.goto(base + '?via=tangle#stats'); await s.waitForTimeout(1600);
  ok(sent.length === 1 && Object.keys(JSON.parse(sent[0])).sort().join() === 'p_code,p_metric' && JSON.parse(sent[0]).p_code === 'tangle', 'what goes to the database is only a code and a metric: ' + sent[0]);
  const sec = s.locator('#partners');
  const t = (await sec.innerText()).replace(/\s+/g, ' ');
  ok(/tangle 40 22 55% 9 12 30% 3/.test(t) && /ap-macro-1 8 7 88%/.test(t), 'the stats page lists each partner: arrived, played (and the share of arrivals), finished, came back, shared');
  await s.fill('#pc-code', 'Bad Code'); await s.waitForTimeout(100);
  ok(await sec.locator('[role=alert]').count() === 1 && await sec.locator('.partner-url').count() === 0, 'the link maker refuses a malformed code');
  await s.fill('#pc-code', 'tangle'); await s.selectOption('#pc-dest', '#daily'); await s.waitForTimeout(100);
  ok(await sec.locator('.partner-url').textContent() === 'https://balancethebudget.us/?via=tangle#daily', 'it makes a partner link to the Daily Dollar');
  await s.selectOption('#pc-dest', 'state'); await s.selectOption('#pc-st', 'oh'); await s.waitForTimeout(100);
  ok(await sec.locator('.partner-url').textContent() === 'https://balancethebudget.us/state/oh/?via=tangle', 'and to a state’s page');
  await sec.scrollIntoViewIfNeeded(); await sec.screenshot({ path: __OUT + '/partners-stats.png' });
  const fit = await s.evaluate(() => ({ t: [...document.querySelectorAll('#partners .table-wrap')].map((x) => [x.scrollWidth, x.clientWidth]), page: [document.documentElement.scrollWidth, innerWidth] }));
  ok(fit.t.every(([a, c]) => a <= c + 1) && fit.page[0] <= fit.page[1], 'phone: the table and the link maker fit: ' + JSON.stringify(fit));

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
