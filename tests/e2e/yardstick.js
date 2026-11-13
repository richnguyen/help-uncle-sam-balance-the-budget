// Mission 3.4 "Compared to what?" and mission 2.4's "Cut or increase?" round: the numbers match
// OMB's tables, the rounds play and score, the long-view chart and its table render, the vote
// shows both yardsticks, the desk is now 3.5, and phones fit.
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['', 'm', 'duel', 'dock']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const H = require('./gamehelp');
const base = process.argv[2] || 'http://localhost:5173/';
const out = __OUT + '/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const J = JSON.stringify({ v: 2, done: [], stars: {}, steps: {}, quiz: {}, choices: {}, started: '2026-11-01', marks: [], medals: [], settings: { theme: 'light', freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false, voiceV: 2 } });
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (opts) => { const ctx = await b.newContext(opts); await ctx.addInitScript((j) => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', j); }, J); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
  let p = await mk({ viewport: { width: 1280, height: 900 } });
  await p.goto(base + '#sources'); await p.waitForTimeout(700);

  // 1. The numbers, straight from OMB's Table 1.2 and the program detail (dev server only: the
  // live site has no source modules to import).
  const dev = /localhost/.test(base);
  if (dev) {
  const D = await p.evaluate(async () => {
    const data = await import('/src/data/index.ts');
    const L = await import('/src/game/levels.tsx');
    const long = data.cbo.long; const yr = (fy) => long.find((r) => r.fy === fy);
    const mean = (a, b, k) => { const x = long.filter((r) => r.fy >= a && r.fy <= b); return x.reduce((s, r) => s + r[k], 0) / x.length; };
    const lvl = L.LEVELS.find((l) => l.id === 'level-yardstick'); const g = L.gameOf(lvl);
    const c3 = L.CAMPAIGNS.find((c) => c.n === 3);
    return {
      first: long[0].fy, last: long.at(-1).fy, n: long.length, out: mean(1946, 2000, 'out'), rev: mean(1946, 2000, 'rev'),
      twenty: long.filter((r) => r.rev >= 20).map((r) => r.fy), y2019: yr(2019).def,
      rounds: g.rounds.map((r) => ({ kind: r.kind, id: r.id, label: r.label, answer: r.quiz?.estimate?.answer, split: r.quiz?.split?.parts.map((x) => x.answer), sortN: r.quiz?.sort?.items.length, choices: r.quiz?.choices })),
      c3: c3.missions, stop: L.STOPS.find((s) => s.id === 'level-yardstick'), desk: L.STOPS.find((s) => s.id === 'level-10'),
    };
  });
  ok(D.first === 1930 && D.last === 2025 && D.n === 96, `OMB Table 1.2 series: FY${D.first}–FY${D.last}, ${D.n} years`);
  ok(Math.abs(D.out - 19.0) < 0.05 && Math.abs(D.rev - 17.4) < 0.05, `1946–2000 averages: spending ${D.out.toFixed(2)}%, revenue ${D.rev.toFixed(2)}% of GDP`);
  ok(D.twenty.join() === '1944,2000', 'revenue reached 20% of GDP only in FY1944 and FY2000');
  ok(D.rounds.map((r) => r.kind).join() === 'estimate,sort,split,choice' && Math.abs(D.rounds[0].answer - 4.6) < 0.01 && D.rounds[1].sortN === 7, 'the game: an estimate (FY2019 deficit 4.6% of GDP), a 7-statement sort, a split, and a bonus');
  ok(D.rounds[2].split.reduce((a, x) => a + x, 0) === 100 && D.rounds[2].split[0] >= 60 && D.rounds[2].split[0] <= 70, `growth split adds to 100: ${D.rounds[2].split.join(' / ')} (Social Security, Medicare, Medicaid / interest / everything else)`);
  ok(D.c3.join() === 'level-9,level-future,level-brakes,level-yardstick,level-10' && D.stop.campaign === 3 && D.stop.mission === 4 && D.desk.mission === 5, 'campaign 3: mission 3.4 is Compared to what?, and the budget desk is now 3.5');
  }

  // 2. Play it in the browser.
  await p.goto(base + '#level-yardstick'); await p.waitForTimeout(1000);
  ok(/Compared to what\?/i.test(await p.locator('h1').first().textContent()), 'the mission page opens at #level-yardstick');
  await H.toStep(p, 'Pick the yardstick'); await p.waitForTimeout(400);
  await p.locator('.game-round').screenshot({ path: out + 'yd-round1.png' });
  // Round 1: lock the slider at the answer.
  await p.evaluate(() => { const el = document.querySelector('.game-round .estimate-track input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '4.6'); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.waitForTimeout(100); await p.locator('.game-round .estimate-lock').click(); await p.waitForTimeout(400);
  const r1 = await p.locator('.game-round').innerText();
  ok(/4\.6% of GDP/.test(r1) && /structural/i.test(r1) && /29\.6%/.test(r1), 'round 1 reveal: 4.6% of GDP in FY2019, the emergencies, and what “structural” means');
  await p.locator('.game-next').click(); await p.waitForTimeout(400);
  await p.locator('.game-round').screenshot({ path: out + 'yd-round2.png' });
  ok((await p.locator('.sort-bin-head').allTextContents()).join('|').includes('Yardstick 1: history') && await p.locator('.sort-tray .sort-chip').count() === 1 && /Card 1 of 7/.test(await p.locator('.sort-deal-count').textContent()), 'round 2: seven true statements, dealt one at a time, to sort into history, today’s needs, or both agree');
  await H.playRound(p); await p.locator('.game-next').click(); await p.waitForTimeout(400);
  await p.locator('.game-round').screenshot({ path: out + 'yd-round3.png' });
  ok(await p.locator('.split-handle').count() === 2, 'round 3: a three-way split of the growth');
  await H.playRound(p); await p.locator('.game-next').click(); await p.waitForTimeout(400);
  ok(/reached 20% of GDP/.test(await p.locator('.game-round').innerText()), 'bonus: how often revenue has reached 20% of GDP');
  await H.playRound(p); await p.waitForTimeout(300);
  if (await p.locator('.game-next').count()) { await p.locator('.game-next').click(); await p.waitForTimeout(400); }
  ok(await p.locator('.game-over').count() === 1, 'the game ends with its score card');
  await p.locator('.game-over').screenshot({ path: out + 'yd-over.png' });

  // The long view and the vote.
  await H.toStep(p, 'The long view'); await p.waitForTimeout(600);
  await p.locator('.level-main, main').first().screenshot({ path: out + 'yd-long.png' }).catch(() => {});
  const dashes = await p.locator('.chart path[stroke-dasharray]').count();
  ok(await p.locator('.chart').count() >= 1 && dashes >= 2, `the long view: spending and revenue since 1930 with the dashed 1946–2000 averages (${dashes} dashed lines)`);
  await p.locator('.chart-foot .link-btn').click(); await p.waitForTimeout(200);
  ok(await p.locator('table.data tbody tr').count() === 96, 'its table view lists all 96 years');
  await p.locator('.chart-foot .link-btn').click();
  await H.toStep(p, 'Your vote'); await p.waitForTimeout(500);
  const vote = await p.locator('main').innerText();
  ok(/which yardstick fits best/i.test(vote) && /History: keep spending/.test(vote) && /Today’s needs: set taxes/.test(vote) && /cutting spending by about 4 points of GDP \(about \$1\.\d trillion in FY2025\)/.test(vote) && /only twice since 1930/.test(vote), 'the vote offers both yardsticks, with the cost of each');
  await p.locator('main').screenshot({ path: out + 'yd-vote.png' }).catch(() => {});

  // 3. Mission 2.4's new round: cut or increase?
  await p.goto(base + '#level-rules'); await p.waitForTimeout(900); await H.toStep(p, 'Blow the whistle');
  await H.toRound(p, 'Cut or increase?'); await p.waitForTimeout(300);
  ok(/Practice example/.test(await p.locator('.game-round').innerText()) && await p.locator('.base-row').count() === 3, 'mission 2.4 round 4: a labeled practice example with last year, the baseline, and the bill');
  await p.locator('.game-round').screenshot({ path: out + 'yd-baseline.png' });
  await p.locator('.base-call[data-call="up"]').click(); await p.waitForTimeout(150);
  await p.locator('.base-call[data-call="down"]').click(); await p.waitForTimeout(300);
  const br = await p.locator('.game-round').innerText();
  ok(/Both are true/.test(br) && /a baseline is a yardstick too/i.test(br) && (await p.locator('.game-plus').textContent()).includes('100'), 'perfect calls: an increase over last year, a cut against the baseline, 100 points');
  await p.locator('.game-round').screenshot({ path: out + 'yd-baseline-done.png' });
  // A wrong call scores half.
  await p.goto(base + '#levels'); await p.goto(base + '#level-rules'); await p.reload(); await p.waitForTimeout(900); await H.toStep(p, 'Blow the whistle');
  if (await p.locator('.game-over').count()) { await p.locator('.game-over button', { hasText: 'Play again' }).click(); await p.waitForTimeout(300); }
  await H.toRound(p, 'Cut or increase?');
  await p.locator('.base-call[data-call="up"]').click(); await p.waitForTimeout(150);
  await p.locator('.base-call[data-call="up"]').click(); await p.waitForTimeout(300);
  ok((await p.locator('.game-plus').textContent()).includes('50') && /Not this time/.test(await p.locator('.game-round').innerText()), 'one wrong call: 50 points, and it says why');

  // 4. Campaign 3 counts five missions, 3.4 Compared to what? and the desk at 3.5.
  const url = p.url();
  await p.goto(base + '#guide'); await p.waitForTimeout(800);
  const c3 = await p.locator('.rc-camp').nth(2).locator('.rc-camp-bar span').count();
  const names = await p.$$eval('.mb-tile', (l) => l.map((x) => x.querySelector('.mb-code').textContent));
  ok(c3 === 5 && names.includes('3.4') && names.includes('3.5'), `campaign 3 has five missions in Your record (${c3}), with badges 3.4 and 3.5`);
  await p.goto(url); await p.waitForTimeout(1200);

  // 5. Phones.
  p = await mk({ ...devices['iPhone 13'] });
  await p.goto(base + '#level-yardstick'); await p.waitForTimeout(1000); await H.toStep(p, 'Pick the yardstick', true);
  const fit = [];
  for (let k = 0; k < 4; k++) { fit.push(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await H.playRound(p, true); if (await p.locator('.game-next').count()) { await p.locator('.game-next').tap(); await p.waitForTimeout(350); } }
  await H.toStep(p, 'The long view', true); await p.waitForTimeout(500); fit.push(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await p.screenshot({ path: out + 'yd-phone-long.png' });
  ok(fit.every(Boolean), `phone: every round and the long view fit with no sideways scroll (${fit.join(',')})`);
  p = await mk({ ...devices['iPhone 13'] });
  await p.goto(base + '#level-rules'); await p.waitForTimeout(900); await H.toStep(p, 'Blow the whistle', true); await H.toRound(p, 'Cut or increase?', true);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: the cut-or-increase round fits');
  await p.locator('.game-round').screenshot({ path: out + 'yd-phone-baseline.png' });

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
})().catch((e) => { console.log('FAIL crashed:', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
