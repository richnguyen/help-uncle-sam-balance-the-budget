// Sharing a feed post: every post has a Share button beside Save; it opens the share sheet (or
// copies) and each social network, with the post in a line (a quick check shares its question,
// never its answer) and a link that opens the feed with that post first, marked "Shared with you".
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const base = 'http://localhost:5173/';
(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const mk = async () => {
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    await ctx.addInitScript(() => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, done: ['level-1'], settings: { freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false } })); });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p;
  };
  const find = async (p, pred) => {
    for (let i = 0; i < 80; i++) {
      const k = await p.evaluate((src) => { const f = new Function('k', `return (${src})(k)`); const r = [...document.querySelectorAll('.feed-row')].find((x) => f(x.dataset.key ?? '')); if (r) { r.scrollIntoView({ block: 'start' }); scrollBy(0, -130); return r.dataset.key; } scrollBy(0, innerHeight * 0.8); return null; }, pred.toString());
      if (k) { await p.waitForTimeout(300); return p.locator(`.feed-row[data-key="${k}"]`); }
      await p.waitForTimeout(120);
    }
    return null;
  };
  const xOf = async (row) => { const h = decodeURIComponent(await row.locator('.fc-share .social-link[data-net="x"]').getAttribute('href')); return { text: h.match(/text=([\s\S]*?)&url=/)[1], url: h.split('&url=')[1] }; };

  // 1. Every post has a Share button; it opens the networks.
  const p = await mk();
  await p.goto(base + '#menu'); await p.waitForTimeout(1500);
  for (let i = 0; i < 6; i++) { await p.evaluate(() => scrollBy(0, innerHeight)); await p.waitForTimeout(250); }
  const counts = await p.evaluate(() => { const c = [...document.querySelectorAll('.feed-row .fc')]; return [c.length, c.filter((x) => x.querySelector('.fc-share-btn')).length]; });
  ok(counts[0] > 3 && counts[0] === counts[1], `every post has a Share button (${counts[1]} of ${counts[0]})`);
  await p.evaluate(() => scrollTo(0, 0));
  await p.locator('.feed-filters .feed-pill', { hasText: 'Bills' }).first().click(); await p.waitForTimeout(800);
  let row = await find(p, (k) => k === 'bill:hr1-119');
  await row.locator('.fc-share-btn').click(); await p.waitForTimeout(250);
  const nets = await row.locator('.fc-share .social-link').evaluateAll((l) => l.map((a) => a.dataset.net));
  ok(await row.locator('.fc-share-btn').getAttribute('aria-expanded') === 'true' && await row.locator('.fc-share button.btn').count() === 1 && ['x', 'facebook', 'linkedin', 'bluesky', 'threads', 'whatsapp'].every((n) => nets.includes(n)), 'Share opens the share sheet (or copy) and the networks: ' + nets.join(', '));
  let x = await xOf(row);
  ok(/^📜 H\.R\. 1: .+\(Became law\)\. The plain-English summary/u.test(x.text), 'a bill shares its number, title and status: ' + x.text.slice(0, 80));
  ok(x.url === `${base}?post=bill%3Ahr1-119&s=x`, 'and a link to the post, tagged with the network: ' + x.url.replace(base, '/'));
  await row.locator('.fc-share').screenshot({ path: __OUT + '/feed-share.png' });
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: the open panel fits');
  // A quick check: the question, never the answer.
  await p.locator('.feed-filters .feed-pill', { hasText: 'Lessons' }).first().click(); await p.waitForTimeout(800);
  row = await find(p, (k) => k.startsWith('check:'));
  if (row) {
    await row.locator('.fc-share-btn').click(); await p.waitForTimeout(250);
    x = await xOf(row);
    const choices = await row.locator('.fc-choice').allTextContents();
    const right = await p.evaluate(async (id) => { const I = await import('/src/game/feed/items.ts'); const it = I.buildItems().find((i) => i.id === id); return it.quiz.choices[it.quiz.correct]; }, await row.getAttribute('data-key'));
    ok(/^🧠 Quick check: .+ Can you get it\?$/u.test(x.text) && !x.text.includes(right) && choices.length > 1, 'a quick check shares its question, not its answer');
  } else ok(false, 'found a quick check');

  // 2. Opening a shared link: the feed, with that post first.
  const q = await mk();
  await q.goto(base + '?post=bill%3As4647-119'); await q.waitForTimeout(1800);
  const first = await q.evaluate(() => { const r = document.querySelector('.feed-row'); return { k: r?.dataset.key, badge: r?.querySelector('.fc-shared')?.textContent }; });
  ok(/#menu$/.test(q.url()) && !/post=/.test(q.url()) && first.k === 'bill:s4647-119' && first.badge === 'Shared with you', 'a shared post’s link opens the feed with that post first, marked “Shared with you”: ' + first.k);
  await q.reload(); await q.waitForTimeout(1500);
  ok(await q.locator('.fc-shared').count() === 0, 'only once: coming back later, the feed is as usual');
  const r = await mk();
  await r.goto(base + '?post=%3Cscript%3E#menu'); await r.waitForTimeout(1200);
  ok(await r.locator('.fc-shared').count() === 0, 'a malformed post id is ignored');
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
