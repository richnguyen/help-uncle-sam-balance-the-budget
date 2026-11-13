// Level 1 on a phone: the mission's game, played through by touch, sets the mission's stars.
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['', 'm', 'duel', 'dock']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const out = __OUT + '/m/';
const { answerAny } = require('./gamehelp');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], hasTouch: true });
  await ctx.addInitScript(() => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, settings: { narration: false, sounds: false } })); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  // Uncle Sam stands over the bottom of the screen; slide him away before tapping what he covers.
  const away = async () => { if (await p.locator('.samdock[data-shown]').count()) { await p.locator('.samdock-avatar').tap(); await p.waitForTimeout(450); } };
  await p.goto('http://localhost:5173/#level-1'); await p.waitForSelector('.level-stage'); await p.waitForTimeout(300);
  await p.locator('.level-nav .btn-primary').tap(); await p.waitForTimeout(400);
  console.log('step 2:', await p.locator('.step-count').textContent(), '| Sam:', (await p.locator('.sam-strip .sr-only, .menu-sam-text').first().textContent()).slice(0, 80), '| button:', await p.locator('.level-nav .btn-primary').textContent());
  // The game: three rounds, each played as dealt.
  await away(); await answerAny(p, true); await p.waitForTimeout(400);
  console.log('after the game:', (await p.locator('.game-over').innerText()).replace(/\s+/g, ' ').slice(0, 120), '| button:', await p.locator('.level-nav .btn-primary').textContent(), await p.locator('.level-nav .btn-primary').isEnabled());
  await p.screenshot({ path: out + 'guess-wrong.png' });
  // The rest of the level: right on the first try.
  for (let k = 0; k < 20 && !(await p.locator('.celebrate').count()); k++) {
    await p.locator('.level-nav .btn-primary').tap(); await p.waitForTimeout(350);
    if (await p.locator('.quiz-card').count() && !(await p.locator('.level-nav .btn-primary').isEnabled())) {
      const q = await p.locator('.quiz-q').textContent();
      const pick = /Social Security tax/.test(q) ? /trust funds/ : null;
      const cs = p.locator('.quiz-choice');
      await away();
      for (let c = 0; c < (await cs.count()); c++) if (pick && pick.test(await cs.nth(c).textContent())) { await cs.nth(c).tap(); break; }
      await p.waitForTimeout(300);
      console.log('quick check:', q.slice(0, 60), '->', (await p.locator('.quiz-feedback strong').textContent()));
    }
  }
  await p.waitForTimeout(800);
  console.log('stars at the end:', await p.locator('.celebrate-stars').getAttribute('aria-label'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  console.log('complete card:', (await p.locator('.complete .small.muted').first().textContent()));
  // Level 7: no law opens until one is tapped.
  await p.evaluate(() => { const j = JSON.parse(localStorage.getItem('ftd:journey')); j.settings.freeRoam = true; localStorage.setItem('ftd:journey', JSON.stringify(j)); });
  await p.goto('http://localhost:5173/#level-7'); await p.reload(); await p.waitForSelector('.level-stage');
  for (let k = 0; k < 12 && !(await p.locator('.lawx-detail').count()); k++) { if (!(await p.locator('.level-nav .btn-primary').isEnabled()) && await p.locator('.quiz-card').count()) { await away(); await answerAny(p, true); } await p.locator('.level-nav .btn-primary').tap(); await p.waitForTimeout(350); }
  await away();
  console.log('level 7 step:', await p.locator('.step-count').textContent(), '| law details before a tap:', (await p.locator('.lawx-detail').innerText()).slice(0, 70));
  await p.locator('.lawx-row').nth(1).tap(); await p.waitForTimeout(400);
  console.log('after a tap:', (await p.locator('.lawx-title').textContent()));
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
