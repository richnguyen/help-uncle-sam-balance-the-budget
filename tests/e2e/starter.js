// Mission 1.9's starter deck: a few cards that reach the goal, a link to show all, the hint picks
// from what's on screen, and the 2.7 desk (level 8) opens with the full deck.
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const open = async (lvl) => {
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    await ctx.addInitScript(() => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, done: ['level-1'], settings: { freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false } })); });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:5173/#' + lvl); await p.waitForSelector('.pcard'); await p.waitForTimeout(800);
    await p.addStyleTag({ content: '.toasts{display:none!important}' }); return p;
  };
  const p = await open('level-5');
  const note = () => p.evaluate(() => document.querySelector('.deck-starter')?.textContent ?? '');
  const n0 = await p.locator('.pcard').count();
  const more = await p.evaluate(() => [...document.querySelectorAll('.pcard-more')].map((d) => d.textContent));
  console.log('[1.9] every card says who pays and who benefits:', more.length && more.every((t) => /Who pays: .+\..*Who benefits: .+\./s.test(t)) ? 'PASS' : 'FAIL');
  console.log('[1.9] starter cards:', n0, '(want 4-8)', n0 >= 4 && n0 <= 8 ? 'PASS' : 'FAIL');
  await p.evaluate(() => document.querySelector('.tb-actions .btn-hint')?.click()); await p.waitForTimeout(500);
  const hinted = await p.evaluate(() => !!document.querySelector('.pcard[data-hint]'));
  console.log('[1.9] hint points at a card on screen:', hinted ? 'PASS' : 'FAIL');
  await p.evaluate(() => document.querySelector('.deck-starter .link-btn').click()); await p.waitForTimeout(400);
  const nAll = await p.locator('.pcard').count();
  console.log('[1.9] show all:', nAll, nAll > n0 && /All \d+ cards/.test(await note()) ? 'PASS' : 'FAIL');
  await p.evaluate(() => document.querySelector('.deck-starter .link-btn').click()); await p.waitForTimeout(400);
  console.log('[1.9] back to starter:', await p.locator('.pcard').count() === n0 ? 'PASS' : 'FAIL');
  await p.evaluate(() => document.querySelectorAll('.pcard .pcard-add:not(.on)').forEach((x) => x.click())); await p.waitForTimeout(800);
  const done = await p.locator('.sb-big').first().textContent();
  console.log('[1.9] whole starter deck meets the goal:', done, /complete|met/i.test(done) ? 'PASS' : 'FAIL');
  const q = await open('level-8');
  const n8 = await q.locator('.pcard').count(), note8 = await q.locator('.deck-starter').count();
  console.log('[2.7] full deck, no starter note:', n8, note8, n8 >= 15 && note8 === 0 ? 'PASS' : 'FAIL');
  console.log('errors:', errs.length ? errs.join(' | ') : 'none');
  await b.close();
})();
