// The first batch of simulations: slider guesses scored by closeness, the revenue tank, the
// speedometer, the interest-rate slider, the Social Security mixer and the wait slider. Each sim
// is checked against the numbers it is built from.
const { chromium, devices } = require('playwright');
const H = require('./gamehelp');
const base = process.argv[2] || 'http://localhost:5173/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const J = JSON.stringify({ v: 2, done: [], stars: {}, steps: {}, quiz: {}, choices: {}, started: '2026-11-01', marks: [], medals: [], settings: { theme: 'light', freeRoam: true, narration: false, voice: 'off', sounds: false, voiceV: 2 } });
const num = (t) => Number(String(t).replace(/[^0-9.]/g, ''));
const usd = (t) => { const m = String(t).match(/\$([\d.,]+)\s*(T|B|trillion|billion)/); return m ? num(m[1]) * (/^T|trillion/.test(m[2]) ? 1e12 : 1e9) : NaN; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (opts) => { const ctx = await b.newContext(opts); await ctx.addInitScript((j) => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', j); }, J); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
  let p = await mk({ viewport: { width: 1280, height: 900 } });
  const setRange = (sel, v) => p.evaluate(([sel, v]) => { const el = document.querySelector(sel); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, v]);
  const prim = () => p.locator('.level-nav .btn-primary');
  // Mission steps and game rounds (shared helpers: play anything in the way).
  const toStep = (label) => H.toStep(p, label);
  const toRound = (label) => H.toRound(p, label);
  const next = async () => { await p.locator('.game-next').click(); await p.waitForTimeout(350); };

  // 1. A guess by slider (1.4's first round): locking in shows the real number and how close it was.
  await p.goto(base + '#level-4'); await p.waitForTimeout(1000);
  await toStep('Fill the tank');
  ok(await p.locator('.estimate-track input[type=range]').count() === 1 && await p.locator('.quiz-choice').count() === 0 && !(await prim().isEnabled()), '1.4’s first round is a slider guess, and Continue waits for the game');
  await setRange('.estimate-track input', 1999); await p.waitForTimeout(150);
  ok(/FY1999/.test(await p.locator('.estimate-lock').textContent()), 'the button shows the value being locked in');
  await p.locator('.estimate-lock').click(); await p.waitForTimeout(500);
  const fb = (await p.locator('.estimate .quiz-feedback').innerText()).replace(/\s+/g, ' ');
  ok(/^Close!/.test(fb) && /FY2001/.test(fb) && /2 years off/.test(fb) && await p.locator('.estimate-answer').count() === 1 && (await p.locator('.game-plus').textContent()) === '+60', 'two years off is close (+60); the answer appears on the track: ' + fb.slice(0, 70));

  // 2. The tank (the next round): a tap pours one bill in; pouring every bill overflows by the deficit.
  await next();
  await p.locator('.tank-chip').first().click(); await p.waitForTimeout(200);
  ok((await p.locator('.tank-layer').count()) === 1 && /of revenue/.test(await p.locator('.tank-readout').innerText()), 'a tap pours one bill in');
  for (let k = 0; k < 7; k++) { const c = p.locator('.tank-chip:not([disabled])'); if (await c.count()) { await c.first().click(); await p.waitForTimeout(150); } }
  const tank = await p.evaluate(() => ({ text: document.querySelector('.tank-readout').innerText, spill: document.querySelector('.tank-spill em')?.textContent, chips: [...document.querySelectorAll('.tank-chip')].map((c) => c.getAttribute('aria-label')) }));
  const parts = tank.chips.map((c) => usd(c));
  const rev = usd(await p.locator('.tank-brim em').textContent());
  ok(tank.spill && Math.abs(usd(tank.spill) - (parts.reduce((a, x) => a + x, 0) - rev)) < 0.02e12, `poured in full, the tank overflows by the deficit: ${tank.spill}`);

  // 3. The speedometer: phasing in brings the needle out of steep.
  await p.goto(base + '#level-drag'); await p.waitForTimeout(1000); await toStep('Keep it gentle'); await toRound('Keep it gentle');
  const zone = async () => (await p.locator('.dial .dial-zone-name').textContent()).trim();
  const z1 = await zone(); await p.locator('.concept-try input[type=checkbox]').check(); await p.waitForTimeout(600); const z2 = await zone();
  ok(z1 === 'steep' && z2 === 'moderate', `the speedometer: all at once “${z1}”, phased in “${z2}”`);

  // 4. The interest rate: the bill is the debt held by the public times the rate; it passes defense.
  await p.goto(base + '#level-6'); await p.waitForTimeout(1000); await toStep('Rate shock'); await toRound('The crossover');
  const read = async () => p.evaluate(() => ({ big: document.querySelector('.sim-result .concept-big').textContent, held: document.querySelector('.sim-result .stat-label').textContent, rows: [...document.querySelectorAll('.sim-bars li')].map((l) => l.querySelector('.sim-bar-v').textContent) }));
  await setRange('.sim-slider input', 2); await p.waitForTimeout(300); const lo = await read();
  await setRange('.sim-slider input', 5); await p.waitForTimeout(300); const hi = await read();
  const held = usd(lo.held);
  ok(Math.abs(usd(lo.big) - held * 0.02) / (held * 0.02) < 0.01 && Math.abs(usd(hi.big) - held * 0.05) / (held * 0.05) < 0.01, `2% → ${lo.big.split(',')[0]}, 5% → ${hi.big.split(',')[0]} (debt held by the public ${lo.held.match(/\$[\d.]+T/)[0]} × the rate)`);
  ok(usd(lo.rows[0]) < usd(lo.rows[1]) && usd(hi.rows[0]) > usd(hi.rows[1]), 'at 2% interest is below defense; at 5% above it');

  // 5. The Social Security mixer: each fix alone closes the gap; waiting takes more.
  await p.goto(base + '#level-9'); await p.waitForTimeout(1000); await toStep('Close the gap'); await toRound('Close it now');
  const gauge = async () => num(await p.locator('.dial-readout').textContent());
  await setRange('.sim-two .sim-slider:nth-child(1) input', 16.65); await p.waitForTimeout(300); const taxOnly = await gauge();
  await setRange('.sim-two .sim-slider:nth-child(1) input', 12.4); await setRange('.sim-two .sim-slider:nth-child(2) input', 25.2); await p.waitForTimeout(300); const cutOnly = await gauge();
  await p.locator('.game-round .sim-lock').click(); await p.waitForTimeout(300); await next();
  await setRange('.sim-two .sim-slider:nth-child(2) input', 25.2); await p.waitForTimeout(300); const late = await gauge();
  ok(taxOnly === 100 && cutOnly === 100 && late < 100 && /gap remains/.test(await p.locator('.dial-zone-name').textContent()), `a 16.65% tax alone closes ${taxOnly}%, a 25.2% cut alone ${cutOnly}%; waiting until 2034, the same cut closes only ${late}%`);

  // 6. The wait slider: the later the fix starts, the bigger each year's share.
  await p.goto(base + '#level-future'); await p.waitForTimeout(1000); await toStep('Try waiting');
  const bars = await p.$$eval('.wait-bars .wait-v', (l) => l.map((x) => Number(x.textContent.replace('%', ''))));
  ok(bars.length >= 4 && bars.every((v, i) => i === 0 || v > bars[i - 1]), 'each year of waiting makes the yearly fix bigger: ' + bars.map((v) => v + '%').join(' → '));
  await setRange('.sim-slider input', 2); await p.waitForTimeout(300);
  ok(/times the yearly fix of starting now/.test(await p.locator('.sim-result').innerText()) && await p.locator('.wait-bars li[data-on] button[aria-pressed="true"]').count() === 1, 'moving the slider highlights that year and compares it with starting now');

  // 7. On a phone: no sideways scroll, and the tank and sliders work by touch.
  p = await mk({ ...devices['iPhone 13'] });
  for (const [id, label, round] of [['level-4', 'Fill the tank', 'Fill the tank'], ['level-9', 'Close the gap', 'Close it now'], ['level-6', 'Rate shock', 'The crossover']]) {
    await p.goto(base + '#' + id); await p.waitForTimeout(900); await toStep(label); await toRound(round);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `phone, ${id} (${round}): no sideways scroll`);
  }
  await p.goto(base + '#level-4'); await p.waitForTimeout(900); await toStep('Fill the tank'); await toRound('Fill the tank');
  await p.locator('.tank-chip').first().tap(); await p.waitForTimeout(300);
  ok(await p.locator('.tank-layer').count() === 1, 'phone: a tap pours a bill into the tank');

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
})().catch((e) => { console.log('FAIL crashed:', e.message.split('\n')[0]); process.exit(1); });
