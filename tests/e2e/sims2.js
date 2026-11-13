// Batch 2: guesses by hand (split, sized bars, sort), the state gauge, the ripple, the budget
// calendar, the debt pie and the bridge. Each is checked against the numbers it's built from.
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
  const toStep = (label) => H.toStep(p, label);
  const toRound = (label) => H.toRound(p, label);
  const next = async () => { await p.locator('.game-next').click(); await p.waitForTimeout(350); };
  const go = async (id, label, round) => { await p.goto(base + '#' + id); await p.waitForTimeout(1000); await toStep(label); return round ? toRound(round) : true; };
  const center = (sel) => p.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'center' }));

  // 1. 1.1's split: the dividers move by keyboard, the arrows don't change the step, and locking in shows the real split.
  await go('level-1', 'Fill the piggy bank', 'Split the $100');
  ok(await p.locator('.split-handle').count() === 3 && !(await prim().isEnabled()), '1.1’s second round is a split with three dividers, and Continue waits for the game');
  const shares = async () => p.$$eval('.split-key strong', (l) => l.map((x) => Number(x.textContent.replace('$', ''))));
  const s0 = await shares();
  // A divider can't pass its neighbor: pushing the first one right stops a dollar short of the second.
  const press = async (k, key, n, shift) => { await p.locator('.split-handle').nth(k).focus(); if (shift) await p.keyboard.down('Shift'); for (let i = 0; i < n; i++) await p.keyboard.press(key); if (shift) await p.keyboard.up('Shift'); };
  await press(0, 'ArrowRight', 30);
  const sBlocked = await shares();
  await press(0, 'ArrowLeft', 24);
  await press(2, 'ArrowRight', 18);
  await press(1, 'ArrowRight', 15); await press(1, 'ArrowRight', 4, true);
  await press(0, 'ArrowRight', 25);
  const s1 = await shares();
  ok(sBlocked.join() === '49,1,25,25', `a divider stops a dollar short of the next one: ${sBlocked.join('/')}`);
  ok(s0.join() === '25,25,25,25' && s1.join() === '50,35,8,7' && /Fill the piggy bank/.test(await p.locator('#step-label').textContent()), `the arrows (and Shift for $5) move the dividers, and the step stays put: ${s0.join('/')} → ${s1.join('/')}`);
  await center('.split-bar');
  const bb = await p.locator('.split-bar').boundingBox();
  await p.mouse.move(bb.x + bb.width * 0.85, bb.y + bb.height / 2); await p.mouse.down(); await p.mouse.move(bb.x + bb.width * 0.83, bb.y + bb.height / 2, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(150);
  const s2 = await shares();
  ok(s2[1] === 33 && s2[2] === 10 && s2.reduce((a, v) => a + v, 0) === 100, `a drag moves the nearest divider: payroll $${s1[1]} → $${s2[1]}`);
  await p.locator('.estimate-lock').click(); await p.waitForTimeout(500);
  const real = (await p.$$eval('.split-key-real', (l) => l.map((x) => x.textContent))).map(num);
  const fb1 = (await p.locator('.quiz-feedback').innerText()).replace(/\s+/g, ' ');
  const off = Math.round(s2.reduce((a, v, i) => a + Math.abs(v - real[i]), 0) / 2);
  ok(real.reduce((a, v) => a + v, 0) === 100 && real[0] > real[1] && await p.locator('.split-real .split-seg').count() === 4 && fb1.includes(`${off} of the $100`) && (await p.locator('.game-plus').textContent()) === `+${Math.max(10, 100 - 3 * off)}`, `the real split appears ($${real.join('/$')}); ${off} misplaced dollars score ${await p.locator('.game-plus').textContent()}`);

  // 2. 1.2's bars: keyboard and drag size them; the real amounts appear; the biggest is graded.
  await go('level-2', 'Size the bills');
  const vals = async () => p.$$eval('.sizes-v', (l) => l.map((x) => x.textContent));
  await p.locator('.sizes-track').nth(2).focus();
  for (let k = 0; k < 4; k++) await p.keyboard.press('PageUp');
  const v1 = await vals();
  ok(usd(v1[2]) === 750e9 + 16 * 25e9 && /Size the bills/.test(await p.locator('#step-label').textContent()), `PageUp raises a bar four steps at a time: Social Security ${v1[2]}`);
  await center('.sizes-chart');
  const t0 = await p.locator('.sizes-track').nth(0).boundingBox();
  await p.mouse.move(t0.x + t0.width / 2, t0.y + t0.height * 0.5); await p.mouse.down(); await p.mouse.move(t0.x + t0.width / 2, t0.y + t0.height * 0.75, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(150);
  const v2 = await vals();
  ok(Math.abs(usd(v2[0]) - 0.25 * 2e12) <= 25e9, `a drag sets a bar to where it's let go: defense ${v2[0]}`);
  await p.locator('.estimate-lock').click(); await p.waitForTimeout(500);
  const fb2 = (await p.locator('.quiz-feedback').innerText()).replace(/\s+/g, ' ');
  const ans = await p.$$eval('.sizes-answer em', (l) => l.map((x) => x.textContent));
  ok(ans.length === 4 && usd(ans[2]) === Math.max(...ans.map(usd)) && /You made Social Security the biggest, and it is/.test(fb2) && /^(Spot on|Close)/.test(fb2), `four real amounts appear (${ans.join(', ')}), and making Social Security the biggest counts`);

  // 3. 1.3's gauge: the needle's zone matches the state's dollars per person against the nation's.
  await go('level-3', 'Your state');
  const nat = num((await p.locator('.dial figcaption .small').textContent()).split('national')[1]);
  for (const [st, z] of [['VA', '22301'], ['UT', '84101']]) {
    await p.evaluate(() => { const d = document.querySelector('.zip-from details'); if (d) d.open = true; }); await p.selectOption('#try-st2', st); await p.waitForTimeout(400);
    const per = num(await p.locator('.dial-readout').textContent());
    const zone = (await p.locator('.dial-zone-name').textContent()).trim();
    const want = per / nat > 1.15 ? 'above average' : per / nat < 0.85 ? 'below average' : 'near average';
    ok(zone === want, `${st}: $${per.toLocaleString()} a person vs. $${nat.toLocaleString()} → “${zone}”`);
  }

  // 4. 1.5's ripple: the ends of the slider are CBO's low and high estimates.
  await go('level-economy', 'Same savings');
  await p.locator('.concept-try .seg button').nth(3).click(); await p.waitForTimeout(200);
  const hitAt = async (v) => { await setRange('.sim-slider input', v); await p.waitForTimeout(250); return num((await p.locator('.concept-big').textContent()).match(/\$[\d.]+/)[0]); };
  const lo = await hitAt(0), md = await hitAt(50), hi = await hitAt(100);
  ok(lo === 50 && hi === 250 && md === 150 && await p.locator('.ripple-ring').count() === 3, `defense cuts: CBO low $${lo}B, middle $${md}B, high $${hi}B per $100B saved, with a ripple`);
  const r = async (v) => { await setRange('.sim-slider input', v); await p.waitForTimeout(500); return p.$eval('.ripple-fill', (c) => Number(c.getAttribute('r'))); };
  const rLo = await r(0), rHi = await r(100);
  ok(Math.abs((rHi * rHi) / (rLo * rLo) - 5) < 0.01, 'the ripple’s area grows with the effect: five times the drag, five times the area');

  // 5. 1.7's sort: locking waits for every card; tap-to-place and drag both work; mistakes say where a card belongs.
  await go('level-fairness', 'Who pays');
  ok(await p.locator('.sort-tray .sort-chip').count() === 1 && /Card 1 of 6/.test(await p.locator('.sort-deal-count').textContent()) && await p.locator('.estimate-lock').isDisabled(), 'six cards, dealt one at a time (Card 1 of 6), and the lock-in waits until all are placed');
  const plan = [['chained CPI', 'Current retirees'], ['Medicaid', 'Low-income'], ['carried interest', 'Higher-income'], ['itemized', 'Higher-income'], ['250,000', 'Higher-income']];
  // The dealt card is already picked up: one tap on a group places it. The one card not in the
  // plan goes by drag, into the wrong group on purpose.
  for (let k = 0; k < 6; k++) {
    const t = await p.locator('.sort-tray .sort-chip').first().innerText();
    const hit = plan.find(([c]) => t.includes(c));
    if (hit) { await p.locator('.sort-bin-head', { hasText: hit[1] }).click(); await p.waitForTimeout(120); continue; }
    await center('.sort-tray');
    const chip = await p.locator('.sort-tray .sort-chip').first().boundingBox();
    const bin = await p.locator('.sort-bin').nth(2).boundingBox();
    await p.mouse.move(chip.x + 20, chip.y + chip.height / 2); await p.mouse.down(); await p.mouse.move(bin.x + bin.width / 2, bin.y + bin.height - 20, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(250);
  }
  ok(await p.locator('.sort-tray').count() === 0 && await p.locator('.sort-bin').nth(2).locator('.sort-chip').count() === 4 && !(await p.locator('.estimate-lock').isDisabled()), 'a drag drops a card into a group; with all six placed, it can be locked in');
  await p.locator('.estimate-lock').click(); await p.waitForTimeout(500);
  const fb5 = (await p.locator('.quiz-feedback').innerText()).replace(/\s+/g, ' ');
  ok(/^Close!/.test(fb5) && /5 of 6/.test(fb5) && /belongs with current retirees/.test(await p.locator('.sort-chip[data-ok="false"]').innerText()), 'five of six is close, and the miss says where it belongs: ' + fb5.slice(0, 40));

  // 6. 2.2: the guess is a year slider; the calendar is checked once; October 1 tells both stories from the record.
  await go('level-7', 'Beat the deadline');
  await setRange('.estimate-track input', 1997); await p.locator('.estimate-lock').click(); await p.waitForTimeout(400);
  ok(/^Spot on!/.test(await p.locator('.quiz-feedback').innerText()) && (await p.locator('.game-plus').textContent()) === '+100', '2.2’s first round is a year slider: FY1997 is spot on, +100');
  await next();
  ok(await p.locator('.cal-oct').count() === 0 && await p.locator('.game-round .cal-row').count() === 4, 'the calendar round: four steps to order, and October 1 waits for the check');
  await p.locator('.game-round .estimate-lock').click(); await p.waitForTimeout(300);
  ok(/0 of 4 in the right spot/.test(await p.locator('.game-banner').innerText()) && (await p.locator('.game-plus').textContent()) === '+0' && /First Monday in February/.test(await p.locator('.cal-list').innerText()), 'checked as dealt, none is in place (+0), and the right order appears with each date');
  await p.locator('.cal-pick', { hasText: 'stopgap' }).click(); await p.waitForTimeout(200);
  const cr = await p.locator('.cal-oct .sim-result').innerText();
  const crs = (await p.evaluate(async () => (await import('/src/data/index.ts')).process.years.reduce((a, y) => a + y.crs, 0)));
  await p.locator('.cal-pick', { hasText: 'No deal' }).click(); await p.waitForTimeout(200);
  const sd = await p.locator('.cal-oct .sim-result').innerText();
  ok(cr.includes(`passed ${crs} stopgaps`) && /FY2019, 35 days/.test(sd) && /4 fiscal years/.test(sd), `a stopgap: ${crs} since FY1998, from the record; no deal: the record of lapses`);

  // 7. 2.3's pie: CBO's comparison, and the game's straight line beyond it.
  await go('level-growth', 'Debt and your income');
  const lossAt = async (v) => { await setRange('.sim-slider input', v); await p.waitForTimeout(250); const t = await p.locator('.sim-result .concept-big').textContent(); return /whole pie/.test(t) ? 0 : num(t.match(/([\d.]+)%/)[1]); };
  const a156 = await lossAt(156), a100 = await lossAt(100), a200 = await lossAt(200);
  ok(a156 === 4 && a100 === 0 && a200 === 7.1 && await p.locator('.pie-lost').count() === 1, `income per person in 2055: whole pie at 100%, ${a156}% smaller at CBO’s 156%, ${a200}% at 200%`);

  // 8. 2.4: the share guess is a slider; the bridge's savings match the card, and the loss is 5 cents a dollar.
  await go('level-investment', 'Bridge inspector');
  ok(await p.locator('.estimate-mark', { hasText: '1980' }).count() === 1, '2.4’s first round is a slider with 1980 marked');
  await toStep('A double hit');
  const read = async () => p.$$eval('.sim-two .concept-big', (l) => l.map((x) => x.textContent));
  const [s33, l33] = await read();
  ok(usd(s33) === 339e9, `at the card’s cut of a third, the savings match CBO’s estimate: ${s33}`);
  ok(Math.abs(usd(l33) - 0.05 * usd(s33)) < 0.6e9, `every year after, output is about 5 cents a dollar lower: ${l33}`);
  await setRange('.sim-slider input', 0); await p.waitForTimeout(250);
  ok(/Nothing lost/.test((await read())[1]) && await p.locator('.bridge').getAttribute('data-wear') === null, 'no cut: nothing lost, and the bridge is in good repair');
  await setRange('.sim-slider input', 50); await p.waitForTimeout(250);
  ok(await p.locator('.bridge').getAttribute('data-wear') === 'high' && await p.locator('.bridge-cone').count() === 1, 'a deep cut wears the bridge down');

  // 9. On a phone: no sideways scroll, and the sort works by touch.
  p = await mk({ ...devices['iPhone 13'] });
  for (const [id, label, round] of [['level-1', 'Fill the piggy bank', 'Split the $100'], ['level-2', 'Size the bills'], ['level-fairness', 'Who pays'], ['level-7', 'Beat the deadline', 'The calendar'], ['level-growth', 'Debt and your income'], ['level-investment', 'A double hit']]) {
    await go(id, label, round);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `phone, ${id} (${label}): no sideways scroll`);
  }
  await go('level-fairness', 'Who pays');
  await center('.sort-tray');
  await p.locator('.sort-tray .sort-chip').first().tap(); await p.waitForTimeout(150);
  await p.locator('.sort-bin-head').first().tap(); await p.waitForTimeout(200);
  ok(await p.locator('.sort-bin').first().locator('.sort-chip').count() === 1, 'phone: tap a card, then a group, and it moves there');

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
})().catch((e) => { console.log('FAIL crashed:', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
