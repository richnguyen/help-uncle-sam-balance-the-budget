// Following bills and "new since your last visit". Supabase is a stand-in; nothing reaches the real project.
const { chromium, devices } = require('playwright');
const base = process.argv[2] || 'http://localhost:5173/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const J = (o = {}) => JSON.stringify({ v: 2, done: ['level-1'], stars: { 'level-1': 3 }, steps: {}, quiz: {}, choices: {}, started: '2026-11-01', marks: [], medals: [], built: [], decor: [], settings: { theme: 'light', freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false, voiceV: 2 }, ...o });
(async () => {
  const b = await chromium.launch(); const errs = [];
  const bills = await (async () => { const p = await b.newPage(); await p.goto(base + '#journey'); await p.waitForTimeout(800); const r = await p.evaluate(async () => (await import('/src/game/feed/items.ts')).BILLS.bills.map((x) => ({ id: x.id, label: x.label, title: x.title, status: x.status, url: x.url, summaryDate: x.summaryDate }))); await p.close(); return r; })();
  const B = bills[0];
  const mk = async (journey, extra = {}) => {
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    const calls = [];
    await ctx.route('**/auth/v1/**', (r) => r.fulfill({ json: { access_token: 'tok', refresh_token: 'ref', expires_in: 3600, user: { id: '00000000-0000-0000-0000-000000000009' } } }));
    await ctx.route('**/rest/v1/**', (r) => { const req = r.request(); calls.push({ m: req.method(), url: req.url().replace(/^.*\/rest\/v1\//, ''), body: req.postData() }); return r.fulfill({ status: req.method() === 'GET' ? 200 : 204, body: req.method() === 'GET' ? '[]' : '' }); });
    await ctx.route('**/challenges.cloudflare.com/**', (r) => r.abort());
    await ctx.addInitScript(([j, ex]) => {
      if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
      localStorage.setItem('ftd:journey', j);
      for (const [k, v] of Object.entries(ex)) v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
    }, [journey, extra]);
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    return { p, calls, ctx };
  };
  const toFeed = (p) => p.evaluate(() => scrollTo(0, document.querySelector('.feed').getBoundingClientRect().top + scrollY));
  const pinBill = async (p, id) => {
    await p.locator('.feed-filters .feed-pill', { hasText: 'Bills' }).click(); await p.waitForTimeout(400);
    const key = `bill:${id}`;
    for (let k = 0; k < 10; k++) { const f = await p.evaluate((key) => { const r = document.querySelector(`.feed-row[data-key="${CSS.escape(key)}"]`); if (!r) return false; r.scrollIntoView({ block: 'center' }); return true; }, key); if (f) break; await p.evaluate(() => scrollBy(0, 1200)); await p.waitForTimeout(250); }
    await p.waitForTimeout(300);
    return p.locator(`.feed-row[data-key="${key}"] .fc`);
  };

  // 1. First visit: nothing is "new", no count on the Feed tab.
  let { p, ctx } = await mk(J(), { 'ftd:feed-last': null });
  await p.goto(base + '#daily'); await p.waitForTimeout(1200);
  ok(await p.locator('.tabbar .tab-count').count() === 0, 'first visit: no count on the Feed tab');
  await p.goto(base + '#journey'); await p.waitForTimeout(1200); await toFeed(p); await p.waitForTimeout(400);
  ok(await p.locator('.fc-new').count() === 0, 'first visit: no post is marked New');
  ok(await p.evaluate(() => !!localStorage.getItem('ftd:feed-last')), 'opening the feed remembers when');
  await ctx.close();

  // 2. A return visit: posts since then are New; the Feed tab counts them until the feed is opened.
  const since = '2026-11-03T12:00:00Z';
  const expectNew = bills.filter((x) => x.summaryDate > '2026-11-03').length;
  ({ p, ctx } = await mk(J(), { 'ftd:feed-last': JSON.stringify(since) }));
  await p.goto(base + '#daily'); await p.waitForTimeout(1200);
  const countText = await p.locator('.tabbar a[data-tab="menu"] .tab-count').textContent().catch(() => '0'); const count = countText === '9+' ? 10 : Number(countText);
  ok((count >= expectNew || countText === '9+') && count > 0, `the Feed tab counts what's new since the last visit (${countText}; ${expectNew} bills)`);
  await p.goto(base + '#journey'); await p.waitForTimeout(1200); await toFeed(p); await p.waitForTimeout(500);
  const marks = await p.$$eval('.feed-row .fc', (l) => l.filter((c) => c.querySelector('.fc-new')).map((c) => c.dataset.kind));
  const first = await p.$$eval('.feed-row .fc', (l) => l.map((c) => c.dataset.kind));
  ok(marks.length > 0 && marks.every((k) => k === 'bill' || k === 'news') && first[0] === marks[0], `new bills and announcements lead the feed, marked New (${marks.join(' ')})`);
  for (let k = 0; k < 40 && !(await p.locator('.fc-caughtup').count()); k++) { await p.evaluate(() => scrollBy(0, 450)); await p.waitForTimeout(200); }
  const cu = await p.locator('.fc-caughtup').innerText();
  ok(/since your last visit \(Nov 3/.test(cu), 'the caught-up line names the last visit: ' + cu.slice(0, 90));
  await p.goto(base + '#daily'); await p.waitForTimeout(800);
  ok(await p.locator('.tabbar .tab-count').count() === 0, 'once the feed has been open, the count clears');
  await ctx.close();

  // 3. Follow a bill from its card; on the real site it's saved for alerts. Then unfollow.
  ({ p, ctx } = await mk(J(), { 'ftd:backend': '"on"', 'ftd:sb-session': JSON.stringify({ access_token: 'tok', refresh_token: 'ref', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: '00000000-0000-0000-0000-000000000009' } }) }));
  let calls = (await (async () => { return null; })()) ?? null;
  const env = await (async () => ({ p, ctx }))();
  await p.goto(base + '#journey'); await p.waitForTimeout(1200); await toFeed(p);
  let card = await pinBill(p, B.id);
  ok(/Follow this bill/.test(await card.locator('.fc-follow-btn').textContent()) && /Know when it moves/.test(await card.locator('.fc-follow').textContent()), 'a bill card offers Follow this bill');
  await card.locator('.fc-follow-btn').click(); await p.waitForTimeout(800);
  ok(await card.locator('.fc-follow-btn').getAttribute('aria-pressed') === 'true' && /Following/.test(await card.locator('.fc-follow-btn').textContent()) && /Turn on notifications/.test(await card.locator('.fc-follow').textContent()), 'Following: and, with notifications off, a link to turn them on');
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('ftd:journey')).follows);
  ok(st?.[B.id]?.status === B.status && st[B.id].seen === B.status && st[B.id].label === B.label, `the game remembers the stage it was at (${B.label}: ${B.status})`);
  await ctx.close();

  // The backend calls, checked on a fresh page that records them.
  const rec = await mk(J(), { 'ftd:backend': '"on"', 'ftd:sb-session': JSON.stringify({ access_token: 'tok', refresh_token: 'ref', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: '00000000-0000-0000-0000-000000000009' } }) });
  await rec.p.goto(base + '#journey'); await rec.p.waitForTimeout(1200); await toFeed(rec.p);
  card = await pinBill(rec.p, B.id);
  await card.locator('.fc-follow-btn').click(); await rec.p.waitForTimeout(900);
  const post = rec.calls.find((c) => c.m === 'POST' && c.url.startsWith('bill_follows'));
  ok(post && JSON.parse(post.body).bill === B.id && JSON.parse(post.body).status === B.status, 'on the real site, following saves the bill and its stage for alerts');
  await card.locator('.fc-follow-btn').click(); await rec.p.waitForTimeout(900);
  ok(rec.calls.some((c) => c.m === 'DELETE' && c.url === `bill_follows?bill=eq.${B.id}`), 'and unfollowing removes it');
  await rec.ctx.close();

  // 4. A followed bill moves: the card says so, the Feed tab counts it, a toast on the visit, and Your record lists it.
  const follows = { [B.id]: { label: B.label, title: B.title, url: B.url, status: 'Earlier stage', seen: 'Earlier stage', at: '2026-11-01T00:00:00Z' } };
  ({ p, ctx } = await mk(J({ follows }), { 'ftd:feed-last': JSON.stringify(new Date().toISOString()) }));
  await p.goto(base + '#daily'); await p.waitForTimeout(2600);
  ok(/^([1-9]|9\+)$/.test(await p.locator('.tabbar a[data-tab="menu"] .tab-count').textContent().catch(() => '0')), 'a followed bill that moved counts on the Feed tab');
  const toast = await p.locator('.toasts').innerText().catch(() => '');
  ok(new RegExp(`${B.label.replace('.', '\\.')} moved: ${B.status}`).test(toast), 'a toast on the visit: ' + toast.trim().slice(0, 60));
  await p.goto(base + '#journey'); await p.waitForTimeout(1200); await toFeed(p);
  card = await pinBill(p, B.id);
  ok(/Moved since you last looked: Earlier stage → /.test(await card.locator('.fc-moved').textContent()) && await card.locator('.fc-new').count() === 1, 'the card: Moved, from the stage you followed to now, and marked New');
  await p.goto(base + '#guide'); await p.waitForTimeout(1000);
  const fb = await p.locator('#following').textContent();
  ok(/Bills you follow/.test(fb) && /Moved/.test(fb) && new RegExp(B.label.replace('.', '\\.')).test(fb), 'Your record: Bills you follow, the moved one marked');
  await p.waitForTimeout(3000);
  ok(await p.evaluate((id) => { const f = JSON.parse(localStorage.getItem('ftd:journey')).follows[id]; return f.seen === f.status; }, B.id) && await p.locator('.fb-badge').count() === 0, 'seen there, it no longer shows as moved');
  await p.locator('.fb-item button', { hasText: 'Unfollow' }).click(); await p.waitForTimeout(300);
  ok(await p.locator('#following').count() === 0, 'Unfollow takes it off the list');
  await ctx.close();

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
})().catch((e) => { console.log('FAIL crashed:', e.message.split('\n')[0]); process.exit(1); });
