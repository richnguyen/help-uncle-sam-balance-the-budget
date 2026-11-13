// Quick play posts in the feed: one for each mission with a game, saying what it is (the game, its
// rounds, up to two stars); one tap opens the mission straight into Quick play and counts it; a
// locked mission's post says what unlocks it instead of offering the button.
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const open = async (settings) => {
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    await ctx.addInitScript((s) => { window.__plays = []; if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, done: ['level-1'], settings: { narration: false, voice: 'off', sounds: false, haptics: false, ...s } })); }, settings);
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:5173/#menu'); await p.waitForTimeout(1300);
    await p.locator('.feed-filters .feed-pill', { hasText: 'Lessons' }).first().click(); await p.waitForTimeout(600);
    return p;
  };
  // Scroll the (windowed) feed until a row is in the page, and pin it there.
  // (The feed is shuffled daily, so this takes the first Quick play post it meets that `want` accepts.)
  const find = async (p, want = () => true) => {
    for (let i = 0; i < 120; i++) {
      const keys = await p.evaluate(() => [...document.querySelectorAll('.feed-row[data-key^="quick:"]')].map((r) => r.dataset.key));
      const key = [];
      for (const k of keys) if (await want(k.slice(6))) { key.push(k); break; }
      if (key.length) {
        await p.evaluate((k) => document.querySelector(`.feed-row[data-key="${k}"]`).scrollIntoView({ block: 'center' }), key[0]); await p.waitForTimeout(300);
        return { id: key[0].slice(6), row: p.locator(`.feed-row[data-key="${key[0]}"]`) };
      }
      await p.evaluate(() => scrollBy(0, innerHeight * 0.8)); await p.waitForTimeout(150);
    }
    return null;
  };
  const unlocked = (p, id) => p.evaluate(async (x) => { const L = await import('/src/game/levels.tsx'); const j = JSON.parse(localStorage.getItem('ftd:journey')); return L.isUnlocked(x, j.done, !!j.settings.freeRoam); }, id);

  // 1. Free roam: the post, then one tap into the game.
  const p = await open({ freeRoam: true });
  const want = await p.evaluate(async () => { const L = await import('/src/game/levels.tsx'); return L.LEVELS.filter((l) => L.gameOf(l)).map((l) => l.id); });
  const have = await p.evaluate(async () => (await import('/src/game/feed/items.ts')).buildItems?.().filter((i) => i.kind === 'quick').map((i) => i.stop.id) ?? null);
  if (have) ok(have.length === want.length && want.every((id) => have.includes(id)), `a Quick play post for each of the ${want.length} missions with a game`);
  const hit = await find(p);
  ok(!!hit, 'the Lessons feed carries Quick play posts');
  if (hit) {
    const { id, row } = hit;
    const t = (await row.innerText()).replace(/\s+/g, ' ');
    ok(/Quick play/.test(t) && /About a minute/i.test(t) && /up to 2 stars/.test(t) && /round/.test(t), 'the post says what it is: about a minute, its rounds, up to two stars: ' + t.slice(0, 120));
    await row.screenshot({ path: __OUT + '/feed-quick.png' });
    await row.locator('.fc-quick-go').evaluate((e) => e.click()); await p.waitForTimeout(1200);
    ok(p.url().endsWith('#' + id) && await p.locator('.mgame').count() === 1 && await p.locator('.quick-offer').count() === 0, 'one tap opens the mission straight into Quick play: ' + p.url().split('#')[1]);
    ok((await p.evaluate(() => window.__plays.map((x) => x.join(':')))).includes('quick_start:' + id), 'and it counts as a Quick play start');
    await p.goto('http://localhost:5173/#menu'); await p.waitForTimeout(800);
    await p.goto('http://localhost:5173/#' + id); await p.waitForTimeout(1000);
    ok(await p.locator('.quick-offer').count() === 1, 'opening the mission on its own later starts normally, at the intro');
  }
  // 2. Locked (no free roam): it says what unlocks the mission, with no button.
  const q = await open({ freeRoam: false });
  const lhit = await find(q, async (id) => !(await unlocked(q, id)));
  if (lhit) {
    const lrow = lhit.row;
    ok(await lrow.locator('.fc-quick-go').count() === 0 && /🔒/.test(await lrow.locator('.fc-quick-locked').textContent()), `a locked mission’s post (${lhit.id}) says what unlocks it: ` + (await lrow.locator('.fc-quick-locked').textContent()).trim());
  } else ok(false, 'found a locked mission’s post');
  ok(await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll');
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
