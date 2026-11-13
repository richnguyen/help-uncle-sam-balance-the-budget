// The budget-process missions: where they sit and unlock, and that each new game enforces its
// rule. Running the agency dry breaks the Antideficiency Act; a cut can't break a spending limit;
// 60 votes waive a point of order; one PAYGO debit is enough for a sequester; memory cards turn
// back over on a miss; and every practice example says it's one.
const { chromium } = require('playwright');
const H = require('./gamehelp');
const base = process.argv[2] || 'http://localhost:5173/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const J = (done, o = {}) => JSON.stringify({ v: 2, done, stars: {}, steps: {}, quiz: {}, choices: {}, started: '2026-11-01', marks: [], medals: [], settings: { theme: 'light', freeRoam: false, narration: false, voice: 'off', sounds: false, voiceV: 2, ...o } });
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (j) => { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.addInitScript((j) => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', j); }, j); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
  const open = async (p, id, title) => { await p.goto(base + '#' + id); await p.waitForTimeout(900); return H.toStep(p, title); };

  // 1. Unlocking: after 1.2, "Paying the bills" (1.3) opens next, and "Back home" waits for it.
  let p = await mk(J(['level-1', 'level-2']));
  await p.goto(base + '#levels'); await p.waitForTimeout(1000);
  const stops = await p.$$eval('#campaign-1 .stop', (l) => l.map((x) => ({ t: x.querySelector('.stop-title').textContent, open: x.dataset.open })));
  ok(stops[2].t === 'Paying the bills' && stops[2].open === 'true' && stops[3].open === 'false', `after 1.2, mission 1.3 “${stops[2].t}” is open and 1.4 “${stops[3].t}” is locked`);
  await p.goto(base + '#level-3'); await p.waitForTimeout(800);
  ok(/Paying the bills/.test(await p.locator('.action-bar, .level').first().innerText()), 'opening 1.4 early points to 1.3, Paying the bills');

  // 2. Running the agency: fund everything and payroll goes unpaid.
  p = await mk(J([], { freeRoam: true }));
  await open(p, 'level-spend', 'Make it last'); await H.toRound(p, 'Run the agency');
  ok(/Practice example/.test(await p.locator('.game-round').innerText()), 'the agency game says it is a practice example');
  for (let k = 0; k < 12; k++) { await p.locator('.ap-pick[data-pick="yes"]').click(); await p.waitForTimeout(60); }
  const ban = await p.locator('.game-banner').innerText();
  ok(/Payroll went unpaid/.test(ban) && Number((await p.locator('.game-plus').textContent()).slice(1)) <= 30 && await p.locator('.ap-months li[data-miss]').count() >= 1 && /Antideficiency/.test(await p.locator('.ap-log').innerText()), 'funding every request runs the money out: payroll unpaid, an Antideficiency Act violation, 30 points at most: ' + ban.replace(/\s+/g, ' ').slice(0, 80));

  // 3. Referee: a cut never breaks the limit; 62 votes waive a point of order and it counts.
  await open(p, 'level-rules', 'Blow the whistle');
  const calls = ['pass', 'pass', 'pass', 'poo', 'poo', 'poo'];
  const notes = [];
  for (let k = 0; k < 6; k++) {
    await p.locator(`.ref-call[data-call="${calls[k]}"]`).click(); await p.waitForTimeout(100);
    notes.push((await p.locator('.referee .quiz-feedback').innerText()).replace(/\s+/g, ' '));
    if (await p.locator('.referee .pairs-next').count()) { await p.locator('.referee .pairs-next').click(); await p.waitForTimeout(100); }
  }
  ok(/62 senators vote to waive/.test(notes[3]) && /Spending now: \$52 billion/.test(notes[3]), 'the wildfire bill breaks the limit, but 62 votes waive the point of order, and spending goes to $52 billion');
  ok(/54 senators/.test(notes[4]) && /out of order/.test(notes[4]) && /Spending now: \$52 billion/.test(notes[4]), 'the museum wing: 54 votes is short of 60, so it’s out of order and spending stays put');
  ok(/^Wrong call/.test(notes[5]) && /can’t break a spending limit/.test(notes[5]) && /\+83/.test(await p.locator('.game-banner').innerText()), 'calling a point of order on a bill that cuts spending is wrong: 5 of 6 right, +83');

  // 4. PAYGO: one scorecard in the red is enough for a sequester; only two picks allowed.
  await open(p, 'level-brakes', 'Pump the brakes'); await H.toRound(p, 'The scorecards');
  await p.locator('.paygo-offset', { hasText: 'Close a tax loophole' }).click();
  await p.locator('.paygo-offset', { hasText: 'Phase in a benefit change' }).click();
  ok(await p.locator('.paygo-offset:disabled').count() === 3, 'after two picks, the other three are off limits');
  const five = await p.locator('.paygo-card').first().innerText();
  await p.locator('.game-round .estimate-lock').click(); await p.waitForTimeout(300);
  const pb = await p.locator('.game-banner').innerText();
  ok(/\+\$3 billion/.test(five) && /5-year scorecard shows a debit/.test(pb) && /\+50/.test(pb), 'loophole + phase-in clears 10 years but leaves the 5-year card $3 billion in debit: a sequester, +50');

  // 5. Memory: a miss turns both cards back over.
  await open(p, 'level-roles', 'Meet the players');
  const who = p.locator('.mem-grid[data-side="who"] .mem-card').first();
  let missed = false;
  for (let x = 0; x < 8 && !missed; x++) {
    await who.click(); await p.locator('.mem-grid[data-side="what"] .mem-card').nth(x).click(); await p.waitForTimeout(100);
    if (await who.isDisabled()) continue;
    missed = true;
    const upNow = await p.locator('.mem-card[data-up]:not([data-matched])').count();
    await p.waitForTimeout(1300);
    ok(upNow === 2 && await p.locator('.mem-card[data-up]:not([data-matched])').count() === 0 && /1 turns|\d+ turns/.test(await p.locator('.memory .pairs-count').textContent()), 'a miss shows both cards, then turns them back over and counts the turn');
  }
  ok(missed, 'the board dealt at least one miss');

  // 6. Every practice example is labeled; the sources cite the CRS report.
  const labels = [];
  for (const [id, title, round] of [['level-rules', 'Blow the whistle', 'Strike it out'], ['level-brakes', 'Pump the brakes', 'The scorecards']]) { await open(p, id, title); await H.toRound(p, round); labels.push(/Practice example/.test(await p.locator('.game-round').innerText())); }
  await p.goto(base + '#sources'); await p.waitForTimeout(900);
  ok(labels.every(Boolean) && /Introduction to the Federal Budget Process \(R46240\)/.test(await p.locator('body').innerText()), 'the Byrd rule and PAYGO rounds are labeled practice examples, and Sources & methods lists CRS R46240');

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
})().catch((e) => { console.log('FAIL crashed:', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
