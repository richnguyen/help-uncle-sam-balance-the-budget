// Desk twists: 2.7 has a rate shock, 3.5 a recession; 1.9 has none. Each desk says its twist in one
// line with a method panel, Uncle Sam says it, the model and the stars include it, and a shared
// plan is scored the same way as on the desk.
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['', 'm', 'duel', 'dock']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const OUT = __OUT + '/';
(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const open = async (lvl) => {
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    await ctx.addInitScript(() => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, done: ['level-1'], settings: { freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false } })); });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:5173/#' + lvl); await p.waitForSelector('.pcard'); await p.waitForTimeout(900); return p;
  };
  const sam = (p) => p.evaluate(() => document.querySelector('.sam-strip .sr-only, .menu-sam-text')?.textContent ?? '');
  const goalOf = { 'level-8': 'deficit3', 'level-10': 'balance' };

  const d5 = await open('level-5');
  ok(await d5.locator('.tb-twist').count() === 0, '1.9: no twist');

  const CASES = [
    ['level-8', /rate on the debt rises 0\.\d points, as it did from 20\d\d to 20\d\d/, /a twist: interest rates are jumping/],
    ['level-10', /A recession hits in FY20\d\d: revenue falls \d+\.\d%, as it did in FY2002/, /a twist: a recession hits/],
  ];
  for (const [lvl, re, say] of CASES) {
    const goal = goalOf[lvl];
    const p = await open(lvl);
    const tw = p.locator('.tb-twist'); const chip = (await tw.count()) ? await tw.textContent() : '';
    ok(/^Twist\s/.test(chip) && chip.length < 30, `${lvl}: a short twist chip on the scoreboard: ${chip}`);
    ok(say.test(await sam(p)), `${lvl}: Uncle Sam says the twist`);
    await tw.locator('.rated-i').click(); await p.waitForTimeout(300);
    const sh = p.locator('.rated-sheet'); const m = await sh.textContent();
    ok(re.test(m), `${lvl}: its info sheet states the twist in one line`);
    ok(/Method/.test(m) && /Sources/.test(m) && (await sh.locator('.rated-src a').count()) >= 1, `${lvl}: "How the twist works" gives the method and sources`);
    if (lvl === 'level-8') await sh.screenshot({ path: OUT + 'twist-8.png' });
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    const chk = await p.evaluate(async (goal) => {
      const A = await import('/src/lib/assess.ts'); const P = await import('/src/lib/plan.ts'); const S = await import('/src/lib/sandbox.ts');
      return { withT: P.shortfall(goal, A.runPlan([], S.ZERO, true, goal), A.CTX.startRatio), without: P.shortfall(goal, A.runPlan([], S.ZERO, true), A.CTX.startRatio) };
    }, goal);
    ok(chk.withT > chk.without, `${lvl}: the twist widens the gap ($${Math.round(chk.without / 1e9)}B to $${Math.round(chk.withT / 1e9)}B)`);
    // Play every card: the desk's stars equal a shared plan's score (assess) for the same plan.
    await p.evaluate(() => document.querySelectorAll('.pcard .pcard-add:not(.on)').forEach((x) => x.click())); await p.waitForTimeout(900);
    const desk = await p.evaluate(() => { const el = document.querySelector('.starpop-btn [aria-label]'); return (el?.getAttribute('aria-label') ?? '').match(/(\d) of 3/)?.[1] ?? null; });
    const shared = await p.evaluate(async (goal) => { const A = await import('/src/lib/assess.ts'); const S = await import('/src/lib/sandbox.ts'); return A.assess(goal, A.CTX.options.map((o) => o.id), S.ZERO, true).ev.stars; }, goal);
    ok(String(shared) === desk, `${lvl}: the desk and a shared plan give the same stars (${desk} vs ${shared})`);
    if (lvl === 'level-10') {
      const g = (on) => p.evaluate(async (on) => { const A = await import('/src/lib/assess.ts'); const S = await import('/src/lib/sandbox.ts'); return A.assess('balance', A.CTX.options.map((o) => o.id), S.ZERO, on).econ.peakStep; }, on);
      const ph = await g(true), no = await g(false);
      ok(no > ph * 2, `3.5: in the recession, not phasing in is far steeper (${(no * 100).toFixed(1)}% vs ${(ph * 100).toFixed(1)}% of GDP)`);
    } else {
      const best = await p.evaluate(async () => { const A = await import('/src/lib/assess.ts'); const P = await import('/src/lib/plan.ts'); return P.optimize(A.ctxFor('deficit3'), 'deficit3', { retirees: true, lowIncome: true, investment: true }, true, 1 / 3).met; });
      ok(best, '2.7: still winnable within the protections');
    }
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${lvl}: no sideways scroll`);
  }
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
})();
