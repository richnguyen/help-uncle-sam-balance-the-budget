// Quick play: offered on a mission's intro, it goes straight to the game, then the takeaway in one
// line, and finishes the mission with at most two stars (even after a three-star game); the
// record and medals stay consistent, and the play counts get quick_start and quick_done.
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['', 'm', 'duel', 'dock']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const OUT = __OUT + '/';
(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const open = async (journey, hash) => {
    const ctx = await b.newContext({ ...devices['iPhone 13'], hasTouch: true });
    await ctx.addInitScript((j) => { window.__plays = []; if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem('ftd:journey', j); }, JSON.stringify(journey));
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:5173/#' + hash); await p.waitForTimeout(1300); await p.addStyleTag({ content: '.toasts{display:none!important}' }); return p;
  };
  const J = (extra = {}) => ({ v: 2, done: ['level-1'], settings: { freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false }, ...extra });
  const rec = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('ftd:journey')));
  const playGame = async (p) => {
    for (let r = 0; r < 8 && await p.locator('.game-round').count(); r++) {
      await p.evaluate(() => { const c = document.querySelector('.game-round .quiz-choice:not([disabled])'); if (c) c.click(); else [...document.querySelectorAll('.game-round button')].find((x) => /^(Lock in|Check)/.test(x.textContent.trim()))?.click(); }); await p.waitForTimeout(300);
      await p.evaluate(() => document.querySelector('.game-round .quiz-choice:not([disabled])')?.click()); await p.waitForTimeout(300);
      const next = await p.evaluate(() => { const n = [...document.querySelectorAll('button')].find((x) => /^Next round/.test(x.textContent.trim())); n?.click(); return !!n; }); await p.waitForTimeout(300);
      if (!next) break;
    }
  };

  // 1. A fresh mission (1.6): the offer, the game, the takeaway, then done with at most two stars.
  const p = await open(J(), 'level-economy');
  const offer = p.locator('.quick-offer .quick-btn');
  ok(await offer.count() === 1 && /Quick play/.test(await offer.textContent()), 'the mission’s intro offers Quick play');
  await p.screenshot({ path: OUT + 'quick-1.png' });
  await offer.tap(); await p.waitForTimeout(600);
  ok(await p.locator('.mgame').count() === 1 && await p.locator('.quick-offer').count() === 0, 'Quick play goes straight to the game');
  await playGame(p);
  const btn = p.locator('.level-nav .btn-primary');
  ok(/See the takeaway/.test(await btn.textContent()), 'after the game, the next step is the takeaway: ' + await btn.textContent());
  await btn.tap(); await p.waitForTimeout(500);
  const line = await p.locator('.quick-line').textContent().catch(() => '');
  const first = await p.evaluate(async () => (await import('/src/game/levels.tsx')).LEVELS.find((l) => l.id === 'level-economy').takeaways[0]);
  ok(line === first, 'the takeaway is the mission’s first one, in one line: ' + line.slice(0, 90));
  await p.screenshot({ path: OUT + 'quick-2.png' });
  await p.locator('.quick-takeaway .btn-primary').tap(); await p.waitForTimeout(900);
  const r1 = await rec(p);
  ok(r1.done.includes('level-economy') && r1.stars['level-economy'] <= 2 && r1.marks.includes('quick:level-economy'), `the mission is done, with ${r1.stars['level-economy']} star(s) (two at most)`);
  if (await p.locator('.celebrate').count()) { await p.locator('.celebrate-x').tap(); await p.waitForTimeout(300); }
  ok(/Quick play/.test(await p.locator('.quick-note').textContent().catch(() => '')), 'the completion screen says how to earn the third star');
  const plays = await p.evaluate(() => window.__plays.map((x) => x.join(':')));
  ok(plays.includes('quick_start:level-economy') && plays.includes('quick_done:level-economy'), 'Quick play is counted (start and finish): ' + plays.join(', '));

  // 2. Even after a three-star game, Quick play caps the mission at two; no "perfect" medal from it.
  const q = await open(J({ games: { 'g-econ': { best: 300, stars: 3, plays: 1 } } }), 'level-economy');
  await q.locator('.quick-offer .quick-btn').tap(); await q.waitForTimeout(600);
  await q.locator('.level-nav .btn-primary').tap(); await q.waitForTimeout(400);
  await q.locator('.quick-takeaway .btn-primary').tap(); await q.waitForTimeout(900);
  const r2 = await rec(q);
  ok(r2.stars['level-economy'] === 2 && !r2.medals.includes('perfect'), `a three-star game still gives the mission two stars in Quick play (${r2.stars['level-economy']}), and no three-star medal`);

  // 3. Back leaves Quick play; the step track still works.
  const s = await open(J(), 'level-growth');
  await s.locator('.quick-offer .quick-btn').tap(); await s.waitForTimeout(500);
  await s.locator('.level-nav .btn:not(.btn-primary)').tap(); await s.waitForTimeout(500);
  ok(await s.locator('.quick-offer').count() === 1, '“Leave quick play” goes back to the intro');
  ok(await s.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll');
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
})();
