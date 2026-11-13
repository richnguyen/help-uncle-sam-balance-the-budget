const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['', 'm', 'duel', 'dock']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const fs = require('fs');
const out = __OUT + '/m/';
const base = 'http://localhost:5173/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  // 1. The service worker's date rules match the game's, every day for 14 years.
  const sw = fs.readFileSync(require('path').join(__dirname, '../../public/sw.js'), 'utf8');
  const block = sw.slice(sw.indexOf('// THEMED WEEKS'), sw.indexOf('// END THEMED WEEKS'));
  const p0 = await b.newPage(); await p0.goto(base + '#sources'); await p0.waitForTimeout(500);
  const mism = await p0.evaluate(async (block) => {
    const D = await import('/src/game/daily.ts');
    const themeOn = new Function(block + '; return themeOn;')();
    const bad = []; let themed = 0;
    for (let d = new Date(2026, 10, 1); d < new Date(2041, 0, 1); d.setDate(d.getDate() + 1)) {
      const t = D.themeFor(D.todayKey(d));
      const a = t ? (t.finale ? (t.id === 'tax' ? 'taxday' : t.id + 'day') : t.id) : null;
      const s = themeOn(new Date(d.getTime() + 15 * 3600e3)); // a reminder at 3 p.m. local
      if (a) themed++;
      if (a !== s) bad.push(`${D.todayKey(d)} game=${a} sw=${s}`);
    }
    return { themed, bad: bad.slice(0, 5) };
  }, block);
  ok(mism.bad.length === 0 && mism.themed === 14 * 14 + 14, `service worker and game agree on every day, Nov. 2026–2040, with the two shutdown deadlines (${mism.themed} themed days)${mism.bad.length ? ': ' + mism.bad.join('; ') : ''}`);
  await p0.close();

  // 1b. Shutdown Watch: the week before funding runs out (Dec. 11, 2026), and the deadline itself.
  {
    const c2 = await b.newContext({ ...devices['iPhone 13'] });
    await c2.addInitScript(() => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, done: ['level-1'], started: '2026-11-01', settings: { narration: false, sounds: false } })); });
    const q = await c2.newPage();
    await q.clock.install({ time: new Date(2026, 11, 8, 9, 0) });
    await q.goto(base + '#daily'); await q.waitForTimeout(800);
    ok(/Shutdown Watch/.test(await q.locator('h1').textContent()) && /day 4 of 7/.test(await q.locator('.daily-theme-tag').textContent()), `Dec. 8, 2026: "${await q.locator('h1').textContent()}" · ${await q.locator('.daily-theme-tag').textContent()}`);
    ok(/Stopgap|Washington spent|Congress approves/i.test(await q.locator('.page-head .lede').textContent()), 'Shutdown Watch puzzle: ' + (await q.locator('.page-head .lede').textContent()).slice(0, 80));
    await c2.close();
    const c3 = await b.newContext({ ...devices['iPhone 13'] });
    const r = await c3.newPage();
    await r.clock.install({ time: new Date(2026, 11, 11, 9, 0) });
    await r.goto(base + '#daily'); await r.waitForTimeout(800);
    ok(/Deadline day/.test(await r.locator('h1').textContent()) && /Deadline day/.test(await r.locator('.daily-theme-tag').textContent()), `Dec. 11, 2026: "${await r.locator('h1').textContent()}"`);
    await c3.close();
  }

  // 2. A real themed day (the clock set to Tax Day 2027), on a phone.
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, done: ['level-1'], started: '2026-11-01', settings: { narration: false, sounds: false } })); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.clock.install({ time: new Date(2027, 3, 15, 9, 0) });
  await p.goto(base + '#daily'); await p.waitForTimeout(800);
  ok(/Tax Day/.test(await p.locator('h1').textContent()) && /Tax Day/.test(await p.locator('.daily-theme-tag').textContent()), `Tax Day 2027: "${await p.locator('h1').textContent()}" · ${await p.locator('.daily-theme-tag').textContent()}`);
  ok(/paycheck/i.test(await p.locator('.page-head .lede').textContent()), 'Tax Day’s puzzle: federal taxes on a paycheck');
  ok(/It’s Tax Day!/.test(await p.locator('.sam-strip .sr-only, .menu-sam-text').first().textContent()), 'Uncle Sam: ' + (await p.locator('.sam-strip .sr-only, .menu-sam-text').first().textContent()).slice(0, 70));
  await p.screenshot({ path: out + 'taxday.png' });
  for (let k = 0; k < 5; k++) { await p.getByRole('button', { name: /Higher/ }).tap(); await p.waitForTimeout(120); await p.locator('.daily-actions .btn-primary').tap(); await p.waitForTimeout(120); }
  const share = await p.evaluate(() => JSON.parse(localStorage.getItem('ftd:daily') || '{}'));
  ok(!!share['2027-04-15'] && share['2027-04-15'].length === 5, 'a themed day is saved like any other');
  const done = await p.locator('.daily-done').innerText();
  ok(!/Coming up/.test(done), 'no "coming up" note on the last day of a theme');

  // 3. Three weeks before Budget Week: the road map's Today card says what's coming.
  const p2 = await ctx.newPage();
  await p2.clock.install({ time: new Date(2027, 0, 14, 9, 0) });
  await p2.goto(base + '#journey'); await p2.waitForTimeout(800);
  await p2.goto(base + '#daily'); await p2.waitForTimeout(500);
  for (let k = 0; k < 5; k++) { await p2.getByRole('button', { name: /Lower/ }).tap(); await p2.waitForTimeout(100); await p2.locator('.daily-actions .btn-primary').tap(); await p2.waitForTimeout(100); }
  ok(/Coming up: Budget Week, Feb\. 1–7\./.test(await p2.locator('.daily-upcoming').innerText()), 'Daily Dollar done screen: ' + (await p2.locator('.daily-upcoming').innerText()).slice(0, 90));

  // 4. Previews of other days: nothing saved, and back to today without the preview's answers.
  await p2.goto(base + '#daily?d=2027-02-01'); await p2.waitForTimeout(600);
  ok(/Budget Week · day 1 of 7/.test(await p2.locator('.daily-theme-tag').textContent()) && /budget function/i.test(await p2.locator('.page-head .lede').textContent()), 'preview of Budget Week, day 1: spending by budget function');
  ok(/Monday, Feb\. 1/.test(await p2.locator('.daily-theme').innerText()), 'it names the day the budget request is due: ' + (await p2.locator('.daily-theme').innerText()).replace(/\s+/g, ' ').slice(0, 140));
  await p2.getByRole('button', { name: /Higher/ }).tap(); await p2.waitForTimeout(150);
  await p2.screenshot({ path: out + 'budgetweek.png' });
  const saved = await p2.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ftd:daily') || '{}')));
  ok(!saved.includes('2027-02-01'), 'a preview is not saved');
  await p2.locator('a[href="#daily"]').first().tap(); await p2.waitForTimeout(500);
  ok(!(await p2.locator('.daily-theme').count()) && (await p2.locator('.daily-done').count()) === 1, 'back on today’s puzzle, with today’s own result');
  await p2.goto(base + '#daily?d=2027-04-12'); await p2.waitForTimeout(500);
  ok(/Tax Week · day 4 of 7/.test(await p2.locator('.daily-theme-tag').textContent()) && /Thursday, April 15/.test(await p2.locator('.daily-theme').innerText()), 'Tax Week, day 4 names Tax Day: Thursday, April 15');
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
