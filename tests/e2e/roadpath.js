// The road map as a path: one stop per mission on a walk from the Lincoln Memorial to the Capitol.
// The stop you are on has a ring for its steps, a CONTINUE bubble and Uncle Sam beside it; a tap
// opens its card; the campaign header stays pinned and changes with the campaign; a tap on it
// opens the three campaigns, its book the briefing; the arrow brings you back to your stop.
const __OUT = require('path').join(__dirname, 'out');
require('fs').mkdirSync(__OUT, { recursive: true });
const { chromium, devices } = require('playwright');
const base = 'http://localhost:5173/';
const ORDER = ['level-1', 'level-2', 'level-spend', 'level-3', 'level-4', 'level-economy', 'level-drag', 'level-fairness', 'level-5', 'level-6', 'level-roles', 'level-7', 'level-rules', 'level-growth', 'level-investment', 'level-8', 'level-9', 'level-future', 'level-brakes', 'level-yardstick', 'level-10'];
(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const mk = async (n, steps = [0, 1]) => {
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    await ctx.addInitScript(([order, n, steps]) => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); const done = order.slice(0, n); localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, done, stars: Object.fromEntries(done.map((d, i) => [d, i % 2 ? 2 : 3])), steps: n < order.length && steps.length ? { [order[n]]: steps } : {}, started: 'x', settings: { narration: false, freeRoam: false, haptics: false, voice: 'off', sounds: false } })); }, [ORDER, n, steps]);
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p;
  };
  // 1. Mid-way through Campaign 1.
  const p = await mk(3);
  await p.goto(base + '#levels'); await p.waitForTimeout(1500);
  const st = await p.$$eval('.roadmap .stop', (l) => l.map((x) => x.dataset.state));
  ok(st.length === 21 && st.slice(0, 5).join() === 'gold,done,gold,next,locked' && st.slice(4).every((x) => x === 'locked'), 'one stop per mission: three done (gold for three stars), the one you are on, the rest locked');
  const next = p.locator('.stop[data-next="true"]');
  const box = await next.locator('.stop-btn').boundingBox();
  ok(box && box.y > 120 && box.y < 600, `the path opens at your stop (${Math.round(box.y)}px down the screen)`);
  ok(await next.locator('.rp-ring').count() === 1 && /^Continue$/i.test(await next.locator('.rp-bubble').innerText()) && /Step 3 of \d/.test(await next.locator('.rp-step').textContent()), 'your stop: a ring for its steps, a CONTINUE bubble, and “Step 3 of …”');
  ok(await p.locator('.rp-sam .sam').count() === 1 && /steps? to go, partner/.test(await p.locator('.rp-sam-says').textContent()), 'Uncle Sam stands beside it: ' + await p.locator('.rp-sam-says').textContent());
  ok(/Campaign 1 · Mission 4 of 9/i.test(await p.locator('.rp-head-eyebrow').textContent()) && /Stop the debt/.test(await p.locator('.rp-head-title').textContent()), 'the pinned header: Campaign 1, Mission 4 of 9');
  await p.screenshot({ path: __OUT + '/roadpath.png' });
  // The card.
  await next.locator('.stop-btn').tap(); await p.waitForTimeout(400);
  const card = await p.locator('.rp-card').innerText();
  ok(/MISSION 1\.4/i.test(card) && /Back home/.test(card) && /Step 3 of/.test(card) && await p.locator('.rp-card-go').getAttribute('href') === '#level-3' && /Continue/i.test(await p.locator('.rp-card-go').innerText()) && /Quick play/.test(card), 'a tap opens the card: the mission, its steps, Continue, and Quick play');
  ok(await next.locator('.rp-bubble').count() === 0, 'the bubble steps aside while the card is open');
  await p.locator('.stop[data-state="gold"] .stop-btn').first().tap(); await p.waitForTimeout(300);
  ok(/3 of 3 stars/i.test(await p.locator('.rp-card').innerText()) && await p.locator('.rp-card').getByRole('button', { name: 'What I learned' }).count() === 1, 'a finished stop: its stars, Play again, and what you learned');
  await p.locator('.rp-card').getByRole('button', { name: 'What I learned' }).tap(); await p.waitForTimeout(200);
  ok(await p.locator('.rp-card-learned li').count() >= 2, 'what I learned lists the mission’s takeaways');
  await p.locator('.stop[data-state="locked"] .stop-btn').first().tap(); await p.waitForTimeout(300);
  ok(/Finish Mission 1\.4 to unlock/.test(await p.locator('.rp-card').innerText()) && await p.locator('.rp-card-go').count() === 0, 'a locked stop says what opens it, with nothing to start');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(await p.locator('.rp-card').count() === 0, 'Escape closes the card');
  // The campaigns and the briefing.
  await p.locator('.rp-head-main').tap(); await p.waitForTimeout(400);
  const cc = await p.$$eval('.rp-cc', (l) => l.map((x) => x.innerText.replace(/\s+/g, ' ')));
  ok(cc.length === 3 && /you are here/i.test(cc[0]) && /3 of 9/.test(cc[0]) && /granite/.test(cc[0]) && /cobblestone/.test(cc[1]) && /Opens after Campaign 1/.test(cc[1]) && /gravel/.test(cc[2]) && /Opens after Campaign 2/.test(cc[2]), 'the header opens the three campaigns: progress, each one’s walk, and what is locked');
  ok(await p.locator('.rp-cc-go').getAttribute('href') === '#level-3', 'with Continue for the mission you are on');
  await p.locator('.rp-sheet-x').tap(); await p.waitForTimeout(200);
  await p.locator('.rp-head-book').tap(); await p.waitForTimeout(300);
  ok(await p.locator('.rp-brief-list li').count() === 9 && /Final mission · budget desk/.test(await p.locator('.rp-brief-list li').last().innerText()), 'the book opens the campaign’s briefing: its nine missions, ending at the budget desk');
  await p.locator('.rp-sheet-x').tap(); await p.waitForTimeout(200);
  // Scrolling: the header follows the campaign, and the arrow brings you back.
  await p.evaluate(() => document.getElementById('campaign-2').scrollIntoView({ block: 'start' })); await p.waitForTimeout(500);
  ok(/Campaign 2/.test(await p.locator('.rp-head-eyebrow').textContent()) && /locked/.test(await p.locator('.rp-head-eyebrow').textContent()) && await p.locator('.rp-back').count() === 1, 'scrolled to Campaign 2: the header changes, and “Back to my stop” appears');
  await p.locator('.rp-back').tap(); await p.waitForTimeout(900);
  const back = await next.locator('.stop-btn').boundingBox();
  ok(back.y > 100 && back.y < 620 && await p.locator('.rp-back').count() === 0, 'it brings your stop back to the middle of the screen');
  // The walk and its landmarks.
  const marks = await p.$$eval('.rp-mark svg[role="img"]', (l) => l.map((x) => x.getAttribute('aria-label')));
  ok(marks.length === 6 && /Lincoln Memorial/.test(marks[0]) && /White House/.test(marks[1]) && /Treasury/.test(marks[2]) && /Washington Monument/.test(marks[3]) && /Jefferson Memorial/.test(marks[4]) && /Capitol/.test(marks[5]), 'the landmarks in walking order: Lincoln Memorial, White House, Treasury, Washington Monument, Jefferson Memorial, Capitol');
  ok(marks.every((m) => /not built yet/.test(m)) && await p.locator('.rp-chip[href="#mall-lincoln"]').count() === 1, 'unbuilt landmarks are blueprints, each with a way to build it');
  const caps = await p.$$eval('.rp-cap', (l) => l.map((x) => x.textContent));
  ok(['Albert Einstein Memorial', 'Constitution Gardens', '15th St', 'Tidal Basin', 'Martin Luther King, Jr. Memorial', '7th St', 'Pennsylvania Ave', 'Ulysses S. Grant Memorial'].every((c) => caps.includes(c)), 'the sights on the way are named: ' + caps.length + ' captions');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: no sideways scroll');
  // 2. A new player, and the last stop.
  const q = await mk(0, []);
  await q.goto(base + '#levels'); await q.waitForTimeout(1400);
  ok(/^Start$/i.test(await q.locator('.stop[data-next="true"] .rp-bubble').innerText()) && /Start here, partner/.test(await q.locator('.rp-sam-says').textContent()), 'a new player: START on Mission 1.1');
  const z = await mk(20, []);
  await z.goto(base + '#levels'); await z.waitForTimeout(1400);
  ok(await z.locator('.stop[data-next="true"][data-boss]').count() === 1 && /Campaign 3 · Mission 5 of 5/i.test(await z.locator('.rp-head-eyebrow').textContent()) && /The big one/.test(await z.locator('.rp-sam-says').textContent()) && await z.locator('.rp-side[data-kind="showdown"]').count() === 1, 'the last stop: Campaign 3’s final budget desk before the Capitol, with the Sealed Showdown beside it');
  await z.screenshot({ path: __OUT + '/roadpath-finish.png' });
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
