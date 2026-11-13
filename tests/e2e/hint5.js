// Level 5's hint on a phone: from the bottom bar before the goal, then from the scoreboard after it.
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['', 'm', 'duel', 'dock']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const out = __OUT + '/m/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], hasTouch: true });
  await ctx.addInitScript(() => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, done: ['level-1', 'level-2', 'level-3', 'level-4', 'level-economy', 'level-drag', 'level-fairness'], settings: { narration: false, sounds: false } })); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:5173/#level-5'); await p.waitForSelector('.pcard'); await p.waitForTimeout(600);
  console.log('opening line ends:', (await p.locator('.sam-strip .sr-only, .menu-sam-text').first().textContent()).slice(-60));
  console.log('hint buttons: scoreboard', await p.locator('.tb-actions .btn-hint').count(), '| bottom bar', await p.locator('.plan-bar .btn-hint').count());
  await p.locator('.tb-actions .btn-hint').tap(); await p.waitForTimeout(900);
  const h = await p.evaluate(() => { const c = document.querySelector('.pcard[data-hint]'); const r = c?.getBoundingClientRect(); return { card: c?.querySelector('.pcard-title')?.textContent, onScreen: !!r && r.top < innerHeight && r.bottom > 0, added: c?.querySelector('.pcard-add')?.classList.contains('on') }; });
  console.log('hint 1:', (await p.locator('.sam-strip .sr-only, .menu-sam-text').first().textContent()), '|', JSON.stringify(h));
  await p.screenshot({ path: out + 'hint-card.png' });
  await p.locator('.pcard[data-hint] .pcard-add').tap(); await p.waitForTimeout(900);
  console.log('after playing it:', await p.locator('.sb-big').textContent(), '| marked card left:', await p.locator('.pcard[data-hint]').count(), '| pop-up:', await p.locator('.celebrate').count());
  if (await p.locator('.celebrate').count()) { await p.locator('.celebrate-x').tap(); await p.waitForTimeout(300); }
  const stars = await p.locator('.starpop-btn').getAttribute('aria-label').catch(() => '?');
  await p.locator('.tb-actions .btn-hint').tap(); await p.waitForTimeout(400);
  console.log('stars:', (stars || '').slice(0, 12), '| hint 2:', await p.locator('.sam-strip .sr-only, .menu-sam-text').first().textContent());
  console.log('level 8 hint button:', await (async () => { await p.goto('http://localhost:5173/#journey'); await p.evaluate(() => { const j = JSON.parse(localStorage.getItem('ftd:journey')); j.settings.freeRoam = true; localStorage.setItem('ftd:journey', JSON.stringify(j)); }); await p.goto('http://localhost:5173/#level-8'); await p.reload(); await p.waitForSelector('.pcard'); return p.locator('.btn-hint').count(); })());
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
