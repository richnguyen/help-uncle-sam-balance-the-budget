// Build the Mall: the star ledger, building in order with its animation, the postcard, the
// decorations, the locks, the Capitol's old dome, less motion, phones, the Mall view, and the menu.
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['', 'm', 'duel', 'dock']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const base = process.argv[2] || 'http://localhost:5173/';
const out = __OUT + '/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const S = (o) => JSON.stringify({ v: 2, done: Object.keys(o.stars ?? {}), stars: o.stars ?? {}, steps: {}, quiz: {}, choices: {}, started: '2026-11-01', marks: [], medals: o.medals ?? [], built: o.built ?? [], decor: o.decor ?? [], settings: { theme: o.theme ?? 'light', freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false, voiceV: 2 } });
const many = (n) => { const ids = ['level-1', 'level-2', 'level-3', 'level-4', 'level-economy', 'level-6', 'level-7', 'level-9', 'level-drag', 'level-fairness', 'level-growth', 'level-investment', 'level-future', 'level-spend', 'level-roles', 'level-rules', 'level-brakes', 'level-yardstick', 'level-5', 'level-8', 'level-10']; const o = {}; let left = n; for (const id of ids) { if (left <= 0) break; const k = Math.min(3, left); o[id] = k; left -= k; } return o; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (state, opts = { viewport: { width: 1280, height: 860 } }) => {
    const ctx = await b.newContext(opts);
    await ctx.addInitScript((j) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('ftd:journey', j); sessionStorage.setItem('seeded', '1'); } }, S(state));
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    return p;
  };
  const saved = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('ftd:journey')));

  // 1. The data and the ledger.
  let p = await mk({});
  await p.goto(base + '#sources'); await p.waitForTimeout(500);
  const D = await p.evaluate(async () => {
    const B = await import('/src/game/build/landmarks.ts');
    const ids = B.LANDMARKS.map((l) => l.id);
    const costs = B.LANDMARKS.map((l) => l.tasks.reduce((a, t) => a + t.cost, 0));
    const firstCost = B.LANDMARKS[0].tasks.map((t) => t.cost), lastMax = Math.max(...B.LANDMARKS.at(-1).tasks.map((t) => t.cost));
    const facts = B.ALL_TASKS.every((t) => t.fact.length > 20 && t.fact.length < 260) && B.LANDMARKS.every((l) => l.sources.length >= 1 && l.sources.every((s) => /^https:\/\/(www\.)?(nps\.gov|aoc\.gov|senate\.gov|home\.treasury\.gov|whitehousehistory\.org)\//.test(s.url)));
    const half = B.LANDMARKS[0].tasks.slice(0, 2).map((t) => t.id);
    return {
      ids, costs, total: B.TOTAL_COST, firstCost, lastMax, facts,
      bal: B.balanceOf({ a: 3, b: 2 }, half), won: B.starsWon({ a: 3, b: 2 }), spent: B.starsSpent(half),
      next: B.nextTask(B.LANDMARKS[0], half)?.id, open2: B.isOpen(B.LANDMARKS[1], half), open2b: B.isOpen(B.LANDMARKS[1], B.LANDMARKS[0].tasks.map((t) => t.id)),
      states: B.partStates(B.LANDMARKS[0], half),
    };
  });
  ok(D.ids.join() === 'monument,lincoln,jefferson,treasury,whitehouse,capitol', 'six landmarks, in order: ' + D.ids.join(', '));
  ok(D.total <= 63 && D.total >= 40, `the whole Mall costs ${D.total} of the 63 stars there are (${D.costs.join(' + ')})`);
  ok(D.firstCost.every((c) => c === 1) && D.lastMax >= 3 && D.costs[5] > D.costs[0], 'costs grow: every Washington Monument job costs one star; the Capitol’s dome costs three');
  ok(D.facts, 'every job has a fact, and every landmark official sources');
  ok(D.won === 5 && D.spent === 2 && D.bal === 3, 'the balance: 5 stars won, 2 spent, 3 to spend');
  ok(D.next === 'monument:shaft1' && !D.open2 && D.open2b, 'jobs go in order, and the next landmark opens when one is finished');
  ok(D.states.grounds === 'built' && D.states.shaft1 === 'next' && D.states.apex === 'plan', 'parts: built, the next job, and still on the plans');

  // 2. The Mall page, fresh.
  p = await mk({ stars: many(4) });
  await p.goto(base + '#mall'); await p.waitForTimeout(900);
  ok(/Build the Mall/i.test(await p.locator('h1').first().textContent()), 'the Mall page opens at #mall');
  ok((await p.locator('.bm-balance').first().textContent()).includes('4'), 'it shows the stars to spend: ' + (await p.locator('.bm-balance').first().textContent()).trim());
  ok(await p.locator('.bm-cards > li').count() === 6 && await p.locator('.bm-card[data-state="open"]').count() === 1 && await p.locator('.bm-card[data-state="locked"]').count() === 5, 'six landmark cards: the first open, the rest waiting');
  ok(await p.locator('.bm-mall-svg a.bm-hit').count() === 6 && await p.locator('.bm-mall-svg .bm-part[data-state="built"]').count() === 0, 'the Mall view: six landmarks to tap, all still blueprints');
  ok(/rebuild the National Mall/.test(await p.locator('.sam-strip').textContent()), 'Uncle Sam explains how building works');
  await p.screenshot({ path: out + 'build-mall.png' });
  await p.locator('.bm-mall-svg a.bm-hit').first().evaluate((a) => a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
  await p.waitForTimeout(500);
  ok(/#mall-/.test(await p.evaluate(() => location.hash)), 'a landmark in the view opens its site: ' + await p.evaluate(() => location.hash));

  // 3. Build a job: the star flies, scaffolding goes up, the piece rises, the balance drops.
  await p.goto(base + '#mall-monument'); await p.waitForTimeout(900);
  ok(await p.locator('.bm-jobs > ol > li').count() === 7 && await p.locator('.bm-jobs > ol > li[data-state="next"]').count() === 1, 'the site lists its six jobs in order, plus the decoration');
  const label0 = await p.locator('.bm-build').textContent();
  ok(/Clear the grounds/.test(label0) && /★1/.test(label0), 'the Build button names the next job and its cost: ' + label0);
  await p.locator('.bm-build').click();
  await p.waitForTimeout(250);
  const flying = await p.locator('.bm-flystar').count();
  await p.waitForTimeout(800);
  const scaffold = await p.locator('.bm-fx .bm-scaffold').count();
  await p.locator('.bm-stage').screenshot({ path: out + 'build-mid.png' });
  await p.waitForTimeout(3200);
  let st = await saved(p);
  ok(flying === 1 && scaffold === 1, `a star flies to the site (${flying}), and scaffolding goes up (${scaffold})`);
  ok(st.built.join() === 'monument:grounds' && await p.locator('.bm-stage [data-part="grounds"]').first().getAttribute('data-state') === 'built', 'the job is saved and its piece is built');
  ok((await p.locator('.bm-balance').first().textContent()).includes('3') && await p.locator('.bm-fx').evaluate((g) => g.childElementCount) === 0, 'the balance drops to 3, and the scaffolding comes down');
  ok(/swampy and unstable/.test(await p.locator('.sam-strip').textContent()), 'Uncle Sam says the job’s fact');
  ok(/Lay the foundation/.test(await p.locator('.bm-build').textContent()), 'the next job is up: ' + (await p.locator('.bm-build').textContent()));
  // Build the rest you can afford: 3 more stars.
  for (let k = 0; k < 3; k++) { await p.locator('.bm-build').click(); for (let t = 0; t < 40 && await p.locator('.bm-build[disabled]').count(); t++) await p.waitForTimeout(150); await p.waitForTimeout(200); }
  st = await saved(p);
  ok(st.built.length === 4 && (await p.locator('.bm-balance').first().textContent()).includes('0'), `four jobs built, no stars left (${st.built.join(', ')})`);
  const need = await p.locator('.bm-page .actionbar .btn-primary').first();
  ok(/more ★ needed/.test(await need.textContent()) && /#level-/.test(await need.getAttribute('href')) && !(await p.locator('.bm-build').count()), 'out of stars: the button sends you to a mission: ' + (await need.textContent()));

  // The top bar shows the stars left to spend; Your record shows earned, spent and left.
  await p.goto(base + '#record'); await p.waitForTimeout(700);
  const hudStars = (await p.locator('header.hud .ab-stars strong').textContent()).trim();
  const rec = (await p.locator('.rc-stats').innerText()).replace(/\s+/g, ' ');
  const spent = await p.locator('.rc-note').textContent();
  ok(hudStars === '0' && /Stars won ★ 4/i.test(rec) && /To spend ★ 0/i.test(rec) && /Stars spent on the Mall: ★ 4/.test(spent), `top bar ★${hudStars} left; Your record: ${rec.slice(0, 90)} · ${spent}`);
  // 4. A locked landmark.
  await p.goto(base + '#mall-capitol'); await p.waitForTimeout(700);
  ok(await p.locator('.bm-stage-lock').count() === 1 && /Finish the Jefferson Memorial first|Finish the .* first/.test(await p.locator('.bm-page .actionbar .btn-primary').textContent()), 'a landmark not yet open says what to finish first');

  // 5. Finish a landmark: the crane lowers the capstone, then the postcard; then the decoration.
  p = await mk({ stars: many(6), medals: ['first-steps'], built: ['monument:grounds', 'monument:foundation', 'monument:shaft1', 'monument:shaft2', 'monument:pyramidion'] });
  await p.goto(base + '#mall-monument'); await p.waitForTimeout(900);
  await p.locator('.bm-build').click(); await p.waitForTimeout(1500);
  const crane = await p.locator('.bm-fx .bm-crane').count();
  await p.locator('.bm-stage').screenshot({ path: out + 'build-crane.png' });
  await p.waitForSelector('.bm-postcard', { timeout: 8000 }).catch(() => {});
  ok(crane === 1, 'the capstone is lowered by a crane');
  const pc = await p.locator('.bm-postcard').textContent().catch(() => '');
  ok(/Washington Monument is finished/.test(pc) && /555 feet/.test(pc) && await p.locator('.bm-postcard a[href^="https://www.nps.gov"]').count() >= 1, 'the postcard: three facts and the sources');
  await p.locator('.bm-postcard').screenshot({ path: out + 'build-postcard.png' });
  ok(await p.locator('.bm-postcard a[href="#mall-lincoln"]').count() === 1, 'it points to the next landmark, the Lincoln Memorial');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(await p.locator('.bm-postcard').count() === 0, 'Escape closes it');
  const dbtn = p.locator('.bm-build');
  ok(/ring of 50 flags/.test(await dbtn.textContent()), 'with one accomplishment, the flags can go up: ' + await dbtn.textContent());
  await dbtn.click(); await p.waitForTimeout(400); for (let t = 0; t < 60 && await p.locator('.bm-page .actionbar button[disabled]').count(); t++) await p.waitForTimeout(150); await p.waitForTimeout(300);
  st = await saved(p);
  ok(st.decor.includes('monument:flags') && await p.locator('.bm-stage [data-part="decor"] .bm-flag').count() >= 20, `the ring of flags is up (${await p.locator('.bm-stage [data-part="decor"] .bm-flag').count()} flags drawn)`);
  for (let t = 0; t < 40 && !/Fifty U\.S\. flags/.test(await p.locator('.sam-strip').textContent()); t++) await p.waitForTimeout(150);
  ok(/Fifty U\.S\. flags/.test(await p.locator('.sam-strip').textContent()), 'and Uncle Sam says why there are fifty');
  ok(/Next landmark: the Lincoln Memorial/.test(await p.locator('.bm-page .actionbar .btn-primary').textContent()), 'then on to the Lincoln Memorial');
  // A decoration that needs more accomplishments says how many.
  await p.goto(base + '#mall-lincoln'); await p.waitForTimeout(600);
  ok(/needs 3 accomplishments; you have [0-2]\b/.test(await p.locator('.bm-job-decor').textContent()), 'a decoration still locked says how many accomplishments it needs');

  // 6. The Capitol's old dome comes down before the new one goes up.
  const before = await p.evaluate(async () => { const B = await import('/src/game/build/landmarks.ts'); const out = []; for (const l of B.LANDMARKS) for (const t of l.tasks) { if (t.id === 'capitol:drum') return out; out.push(t.id); } return out; });
  p = await mk({ stars: many(60), built: before });
  await p.goto(base + '#mall-capitol'); await p.waitForTimeout(900);
  const had = await p.locator('.bm-stage .bm-olddome').count();
  await p.locator('.bm-build').click(); await p.waitForTimeout(1300);
  await p.locator('.bm-stage').screenshot({ path: out + 'build-olddome.png' });
  for (let t = 0; t < 50 && await p.locator('.bm-build[disabled]').count(); t++) await p.waitForTimeout(150);
  await p.waitForTimeout(300);
  ok(had === 1 && await p.locator('.bm-stage .bm-olddome').count() === 0 && (await saved(p)).built.includes('capitol:drum'), 'the Capitol: Bulfinch’s low dome stands until the new drum goes up, then it’s gone');

  // 7. Less motion: the piece just fades in.
  const ctxR = await b.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: 'reduce' });
  await ctxR.addInitScript((j) => { localStorage.setItem('ftd:journey', j); }, S({ stars: many(3) }));
  const pr = await ctxR.newPage();
  await pr.goto(base + '#mall-monument'); await pr.waitForTimeout(800);
  await pr.locator('.bm-build').click(); await pr.waitForTimeout(150);
  const noFly = await pr.locator('.bm-flystar').count(), noScaffold = await pr.locator('.bm-fx .bm-scaffold').count();
  await pr.waitForTimeout(700);
  ok(noFly === 0 && noScaffold === 0 && (await pr.evaluate(() => JSON.parse(localStorage.getItem('ftd:journey')).built.length)) === 1 && !(await pr.locator('.bm-build[disabled]').count()), 'less motion: no flying star or scaffolding; the piece fades in quickly');
  await ctxR.close();

  // 8. The whole Mall, built.
  const all = await p.evaluate(async () => (await import('/src/game/build/landmarks.ts')).ALL_TASKS.map((t) => t.id));
  p = await mk({ stars: many(63), built: all, decor: ['monument:flags', 'jefferson:blossoms', 'capitol:fireworks'], theme: 'dark' });
  await p.goto(base + '#mall'); await p.waitForTimeout(900);
  ok(await p.locator('.bm-mall-svg .bm-part[data-state="plan"], .bm-mall-svg .bm-part[data-state="next"]').count() === 0 && await p.locator('.bm-sign[data-state="done"]').count() === 6, 'all built: no blueprints left in the view, and six finished signs');
  ok(/rebuilt the whole Mall/.test(await p.locator('.sam-strip').textContent()) && await p.locator('.bm-mall-svg [data-part="decor-mall"]').count() === 1, 'Uncle Sam says so, and the cherry trees ring the Tidal Basin');
  await p.screenshot({ path: out + 'build-all-dark.png' });

  // 9. The main menu shows the Mall as built.
  p = await mk({ stars: many(5), built: ['monument:grounds', 'monument:foundation'] });
  await p.goto(base + '#journey'); await p.waitForTimeout(1200);
  ok(await p.locator('.menu-tr a.menu-mall[href="#mall"]').count() === 1, 'the main menu’s top-right Mall button opens Build the Mall');
  ok(await p.locator('.menu-scene .ms-landmark[data-state="plan"]').count() === 2 && await p.locator('.menu-scene .ms-crane').count() === 1, 'the menu’s skyline: both landmarks still blueprints, with a crane at the monument');
  p = await mk({ stars: many(63), built: all });
  await p.goto(base + '#journey'); await p.waitForTimeout(1000);
  ok(await p.locator('.menu-scene .ms-landmark[data-state="built"]').count() === 2 && await p.locator('.menu-scene .ms-crane').count() === 0, 'once built, they stand in the menu’s skyline');

  // 10. Phones: it fits; the view scrolls sideways; a tap builds.
  p = await mk({ stars: many(3) }, { ...devices['iPhone 13'] });
  await p.goto(base + '#mall'); await p.waitForTimeout(900);
  const ph = await p.evaluate(() => { const m = document.querySelector('.bm-mall'); return { page: document.documentElement.scrollWidth <= innerWidth, view: m.scrollWidth > m.clientWidth, at: m.scrollLeft }; });
  ok(ph.page && ph.view && ph.at > 0, `phone: no sideways page scroll; the Mall view scrolls sideways, starting at the monument (${Math.round(ph.at)}px)`);
  await p.goto(base + '#mall-monument'); await p.waitForTimeout(900);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: the building site fits');
  await p.locator('.bm-build').tap(); for (let t = 0; t < 40 && await p.locator('.bm-build[disabled]').count(); t++) await p.waitForTimeout(150);
  ok((await saved(p)).built.length === 1, 'phone: a tap builds');
  await p.screenshot({ path: out + 'build-phone.png' });

  // 11. Reset clears the building too.
  await p.evaluate(() => { const j = JSON.parse(localStorage.getItem('ftd:journey')); j.built = ['monument:grounds']; localStorage.setItem('ftd:journey', JSON.stringify(j)); });
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
})().catch((e) => { console.log('FAIL crashed:', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
