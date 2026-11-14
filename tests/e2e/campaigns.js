// Three campaigns, twenty missions: the road map, unlocking in order, the new concept missions,
// the campaign-complete pop-up, the top bar's mission list, and the plan ideas on every desk.
const { chromium, devices } = require('playwright');
const H = require('./gamehelp');
const base = process.argv[2] || 'http://localhost:5173/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const ORDER = ['level-1', 'level-2', 'level-spend', 'level-3', 'level-4', 'level-economy', 'level-drag', 'level-fairness', 'level-5', 'level-6', 'level-roles', 'level-7', 'level-rules', 'level-growth', 'level-investment', 'level-8', 'level-9', 'level-future', 'level-brakes', 'level-yardstick', 'level-10'];
const J = (done, o = {}) => JSON.stringify({ v: 2, done, stars: {}, steps: {}, quiz: {}, choices: {}, started: '2026-11-01', marks: [], medals: [], settings: { text: 'normal', theme: 'light', freeRoam: false, narration: false, voice: 'off', haptics: false, sounds: false, voiceV: 2, ...o } });
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (opts, j) => { const ctx = await b.newContext(opts); await ctx.addInitScript((j) => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', j); }, j); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
  const away = async (p) => { if (await p.locator('.samdock[data-shown]').count()) { await p.mouse.click(3, 300); await p.waitForTimeout(600); } };
  const desk = { viewport: { width: 1280, height: 900 } };

  // 1. The road map: three campaigns, 9 + 7 + 4 missions, easy to hard, each ending at a desk.
  let p = await mk(desk, J(ORDER.slice(0, 5)));
  await p.goto(base + '#levels'); await p.waitForTimeout(1200); await away(p);
  const camps = await p.$$eval('.journey section[id^="campaign-"]', (l) => l.map((s) => ({ title: s.querySelector('h2')?.textContent, stops: [...s.querySelectorAll('.stop')].map((x) => ({ meta: x.querySelector('.stop-meta span').textContent, title: x.querySelector('.stop-title').textContent, open: x.dataset.open, kind: x.dataset.kind })) })));
  ok(camps.length === 3 && camps.map((c) => c.stops.length).join() === '9,7,5', 'three campaigns of 9, 7 and 5 missions: ' + camps.map((c) => c.title).join(' · '));
  ok(camps.every((c) => c.stops.at(-1).meta === 'Final mission' && c.stops.at(-1).kind === 'desk' && c.stops.slice(0, -1).every((s) => s.kind === 'chapter')), 'each campaign ends at its budget desk, the final mission');
  ok(camps[0].stops[5].title === 'How a policy hits the economy' && camps[0].stops[5].open === 'true' && camps[0].stops[6].open === 'false', 'after mission 1.5, mission 1.6 (the economy) is open and 1.7 is locked');
  const lockText = await p.locator('.stop').nth(6).locator('.small').textContent();
  ok(/Finish Mission 1\.6 to unlock/.test(lockText), 'the lock says what opens it: ' + lockText);
  const newOnes = camps.flatMap((c) => c.stops.map((s) => s.title)).filter((t) => /economy|moderate|Who pays|Growing|investment|later/i.test(t));
  ok(newOnes.length >= 6, 'the six new missions are on the map: ' + newOnes.join(' · '));
  ok(await p.locator('.roadmap .stop').count() === 21 && await p.locator('.rp-gate').count() === 2 && await p.locator('.stop[data-next="true"]').count() === 1, 'the path: 21 stops, a gate before campaigns 2 and 3, and one stop you are on');
  const process4 = camps.flatMap((c) => c.stops.map((s) => s.title)).filter((t) => /Paying the bills|Who’s who|Rules of the road|Brakes/.test(t));
  ok(process4.length === 4 && camps[0].stops[2].title === 'Paying the bills' && camps[1].stops[1].title === 'Who’s who in the budget' && camps[1].stops[3].title === 'Rules of the road' && camps[2].stops[2].title === 'Brakes and the debt limit', 'the four budget-process missions sit at 1.3, 2.2, 2.4 and 3.3');

  // 2. The top bar: "Mission 1.6", and the mission list grouped by campaign.
  await p.goto(base + '#level-economy'); await p.waitForTimeout(1200); await away(p);
  ok(/^Mission 1\.6$/.test(await p.locator('.hud-title').textContent()), 'the top bar says Mission 1.6');
  ok(await p.locator('.level-head').count() === 0 && await p.locator('.steptrack .steptrack-seg').count() >= 3, 'the mission page opens on its one line of steps (the top bar names the mission)');
  // Progress lives in Your record, on the Guide tab: one bar per campaign.
  await p.goto(base + '#guide'); await p.waitForTimeout(800);
  const heads = await p.$$eval('.rc-camp .rc-camp-k', (l) => l.map((x) => x.textContent));
  ok(heads.length === 3 && /Campaign 1/.test(heads[0]) && /Campaign 3/.test(heads[2]) && await p.locator('.rc-camp-bar span').count() === 21, 'Your record shows progress by campaign: three bars, 21 missions');
  await p.goto(base + '#level-economy'); await p.waitForTimeout(1200); await away(p);

  // 3. A concept mission plays through: its game (ripple ranking), same savings four ways, a vote.
  const prim = p.locator('.level-nav .btn-primary');
  let sawRanges = false, sawSame = false;
  for (let k = 0; k < 20 && await prim.count(); k++) {
    if (!(await prim.isEnabled())) { await H.answerAny(p); if (await p.locator('.game-over').count()) sawRanges = (await p.locator('.game-dots li[data-done]').count()) === 3; }
    if (await p.locator('.concept-result').count()) {
      const a = await p.locator('.concept-big').textContent();
      await p.locator('.concept-try .seg button').nth(3).click(); await p.waitForTimeout(200);
      sawSame = a !== (await p.locator('.concept-big').textContent());
    }
    await prim.click(); await p.waitForTimeout(500);
  }
  ok(sawRanges && sawSame, 'mission 1.5: a three-round game, then the same $100 billion hits the economy differently by kind');
  const cel = await p.locator('.celebrate').innerText().catch(() => '');
  ok(/Mission 1\.7/.test(cel), 'its pop-up points to Mission 1.7 next');

  // 4. Mission 1.6's pace demo: phasing in turns a steep year gentle or moderate.
  p = await mk(desk, J(ORDER.slice(0, 6)));
  await p.goto(base + '#level-drag'); await p.waitForTimeout(1200);
  const prim2 = p.locator('.level-nav .btn-primary');
  await H.toStep(p, 'Keep it gentle'); await H.toRound(p, 'Keep it gentle');
  const cap = async () => (await p.locator('.phase figcaption strong').textContent());
  const atOnce = await cap(); await p.locator('.concept-try input[type=checkbox]').check(); await p.waitForTimeout(200); const phased = await cap();
  ok(/steep/.test(atOnce) && /moderate|gentle/.test(phased), `the pace demo: all at once “${atOnce}”, phased in “${phased}”`);

  // 5. Plan ideas: readable before the goal, loadable only after it (or in free roam).
  p = await mk(desk, J(ORDER.slice(0, 8)));
  await p.goto(base + '#level-5'); await p.waitForSelector('.pcard'); await p.waitForTimeout(800); await away(p);
  const before = await p.$$eval('#plan-ideas .idea', (l) => l.map((x) => ({ t: x.querySelector('.idea-title').textContent, btn: !!x.querySelector('.ccard-load:not([disabled])'), stars: x.querySelector('.ccard-score [aria-label]').getAttribute('aria-label') })));
  ok(before.length === 4 && before.every((x) => !x.btn && x.stars === '3 of 3 stars'), 'desk 1.8: four plans that work well, each 3 stars, none loadable yet: ' + before.map((x) => x.t).join(' · '));
  ok(/Meet the goal once/.test(await p.locator('#plan-ideas').textContent()), 'it says how to unlock loading');
  await p.locator('#ideas-tab-congress').click(); await p.waitForTimeout(200);
  const cg = await p.$$eval('#plan-ideas .idea', (l) => l.map((x) => ({ t: x.querySelector('.idea-title').textContent, link: x.querySelector('.ccard-more a')?.href })));
  ok(cg.length === 3 && cg.every((x) => /^https:\/\//.test(x.link)), 'Proposals in Congress, a separate tab with links: ' + cg.map((x) => x.t.slice(0, 40)).join(' · '));

  p = await mk(desk, J(ORDER.slice(0, 8), { freeRoam: true }));
  await p.goto(base + '#level-5'); await p.waitForSelector('.pcard'); await p.waitForTimeout(800); await away(p);
  await p.evaluate(() => document.querySelector('#plan-ideas .idea[data-idea="two-moves"] .ccard-load').click()); await p.waitForTimeout(1500);
  const on = await p.$$eval('.pcard[data-on="true"]', (l) => l.map((x) => x.dataset.card));
  const pop = await p.locator('.celebrate').innerText().catch(() => '');
  ok(on.sort().join() === 'cut-defense-budget,limit-itemized-15pct', 'loading “Two big moves” puts its two cards on the desk');
  ok(/Campaign 1 complete/i.test(pop) && /Goal reached/i.test(pop) && /Mission 2\.1/.test(pop), 'finishing the final mission: “Campaign 1 complete”, then Mission 2.1');
  if (await p.locator('.celebrate').count()) { await p.keyboard.press('Escape'); await p.waitForTimeout(400); }
  ok((await p.locator('#plan-ideas .idea[data-idea="two-moves"] .ccard-load').first().textContent()) === '✓ On your desk', 'the loaded idea reads “On your desk”');

  // 6. The balance desk on a phone: every idea needs across-the-board changes and says what it cuts.
  p = await mk({ ...devices['iPhone 13'] }, J(ORDER));
  await p.goto(base + '#level-10'); await p.waitForSelector('.pcard'); await p.waitForTimeout(800); await away(p);
  const bal = await p.$$eval('#plan-ideas .idea', (l) => l.map((x) => ({ id: x.dataset.idea, met: x.dataset.met, lev: x.querySelectorAll('[data-lever]').length, flags: x.querySelector('.idea-flags').textContent })));
  ok(bal.length === 3 && bal.every((x) => x.met === 'true' && x.lev >= 1), 'desk 3.3: three ideas that balance the budget, each with across-the-board changes');
  ok(/retirees/.test(bal.find((x) => x.id === 'everyone').flags) && !/retirees/.test(bal.find((x) => x.id === 'protect-care').flags), 'the flags are honest: “Everyone chips in” cuts retirees’ benefits; “Protect…” does not');
  await p.evaluate(() => document.querySelector('#plan-ideas .idea[data-idea="mostly-taxes"] .ccard-load').click()); await p.waitForTimeout(1200);
  ok(await p.locator('#lv-revenues').inputValue() === '15', 'loading “Mostly taxes” sets tax revenue to +15%');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll on the phone');

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
})().catch((e) => { console.log('FAIL crashed:', e.message.split('\n')[0]); process.exit(1); });
