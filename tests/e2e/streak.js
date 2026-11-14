// The Daily Dollar streak: 🔥 and the days in a row, left of the stars in the top bar (grey until
// today's or yesterday's puzzle is played), updated the moment a puzzle is finished; and the Mall:
// landmark N's finishing touch needs an N-day streak, the best run counting, so a missed day never
// takes back what was unlocked.
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const base = 'http://localhost:5173/';
const pad = (n) => String(n).padStart(2, '0');
const day = (back) => { const d = new Date(); d.setDate(d.getDate() - back); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const MON = ['grounds', 'foundation', 'shaft1', 'shaft2', 'pyramidion', 'apex'].map((x) => 'monument:' + x);
const LIN = ['terrace', 'hall', 'colsA', 'colsB', 'attic', 'statue', 'pool'].map((x) => 'lincoln:' + x);
const JEF = ['platform', 'colonnade', 'portico', 'dome', 'statue'].map((x) => 'jefferson:' + x);
(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const mk = async ({ played = [], built = [], stars = 40 } = {}, opts = { ...devices['iPhone 13'] }) => {
    const ctx = await b.newContext(opts);
    const st = Object.fromEntries(Array.from({ length: Math.ceil(stars / 3) }, (_, i) => ['level-' + (i + 1), 3]));
    await ctx.addInitScript(([j, d]) => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem('ftd:journey', j); localStorage.setItem('ftd:daily', d); },
      [JSON.stringify({ v: 2, done: Object.keys(st), stars: st, built, decor: [], settings: { freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false } }), JSON.stringify(Object.fromEntries(played.map((k) => [k, [true, false, true, true, true]])))]);
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p;
  };
  const bar = async (p) => { const a = p.locator('header.hud .stb-streak'); return { n: (await a.locator('strong').textContent()).trim(), on: await a.getAttribute('data-on'), label: await a.getAttribute('aria-label'), href: await a.getAttribute('href') }; };

  // 1. The top bar: 🔥 left of the stars, the current run, grey at 0.
  let p = await mk({ played: [day(1), day(2)] });
  await p.goto(base + '#level-1'); await p.waitForTimeout(1200);
  let s = await bar(p);
  ok(s.n === '2' && s.on === 'true' && s.href === '#daily' && /Daily Dollar streak: 2 days in a row/.test(s.label), 'played yesterday and the day before: 🔥 2 (today still to play keeps the run alive)');
  const order = await p.evaluate(() => { const st = document.querySelector('header.hud .stb-streak').getBoundingClientRect(), sr = document.querySelector('header.hud .stb-stars').getBoundingClientRect(); return st.right <= sr.left + 1 && Math.abs((st.top + st.bottom) / 2 - (sr.top + sr.bottom) / 2) < 4; });
  ok(order, 'the streak sits just left of the stars, on the same line');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: the top bar still fits, no sideways scroll');
  await p.locator('header.hud').screenshot({ path: __OUT + '/streak-hud.png' });
  // Finishing today's puzzle: 🔥 3, at once.
  await p.goto(base + '#daily'); await p.waitForTimeout(1000);
  for (let i = 0; i < 5; i++) { await p.locator('.daily-btn').first().click(); await p.waitForTimeout(350); await p.locator('.daily-actions .btn-primary').click(); await p.waitForTimeout(200); }
  await p.goto(base + '#level-1'); await p.waitForTimeout(900);
  ok((await bar(p)).n === '3', 'after finishing today’s puzzle, 🔥 3');

  // 2. A broken run: 🔥 0 in grey, the best remembered.
  p = await mk({ played: [day(5), day(6), day(7)] });
  await p.goto(base + '#level-1'); await p.waitForTimeout(1200);
  s = await bar(p);
  ok(s.n === '0' && s.on === null && /0 days in a row; your best is 3/.test(s.label), 'a missed day: 🔥 0 in grey, and the best (3) is remembered: ' + s.label);

  // 3. The Mall: landmark N's finishing touch needs an N-day streak; the best run counts.
  await p.goto(base + '#mall-jefferson'); await p.waitForTimeout(300);
  p = await mk({ played: [day(5), day(6), day(7)], built: [...MON, ...LIN, ...JEF] });
  await p.goto(base + '#mall-jefferson'); await p.waitForTimeout(1200);
  ok(/Plant the cherry trees/.test(await p.locator('.bm-page .actionbar .btn-primary').textContent()) && /unlocked/.test(await p.locator('.bm-job-decor').textContent()), 'the third landmark’s cherry trees need a 3-day streak: the best run (3, now broken) still unlocks them');
  await p.goto(base + '#mall-treasury'); await p.waitForTimeout(600);
  ok(/needs a Daily Dollar streak of 4 days; your best is 3/.test(await p.locator('.bm-job-decor').textContent()), 'the fourth needs 4 days, and says the best so far');
  // A finished landmark whose finishing touch is still locked points to the Daily Dollar, and unlocks the moment the streak is long enough.
  p = await mk({ played: [], built: MON });
  await p.goto(base + '#mall-monument'); await p.waitForTimeout(1200);
  const cta = p.locator('.bm-page .actionbar .btn-primary');
  ok(await cta.getAttribute('href') === '#daily' && /Play the Daily Dollar/.test(await cta.textContent()) && /streak of 1 day; your best is 0/.test(await p.locator('.bm-job-decor').textContent()), 'no streak yet: the finished Washington Monument points to the Daily Dollar, and its flags say they need a 1-day streak');
  await p.screenshot({ path: __OUT + '/streak-mall.png' });
  await p.evaluate((k) => { localStorage.setItem('ftd:daily', JSON.stringify({ [k]: [true, true, true, true, true] })); window.dispatchEvent(new Event('ftd-daily')); }, day(0));
  await p.waitForTimeout(400);
  ok(/Raise the ring of 50 flags/.test(await p.locator('.bm-page .actionbar .btn-primary').textContent()), 'once today’s puzzle is played, the flags can go up, without reloading');
  const needs = await p.evaluate(async () => (await import('/src/game/build/landmarks.ts')).LANDMARKS.map((l) => l.decor.need).join());
  ok(needs === '1,2,3,4,5,6', 'the six landmarks need 1 to 6 days: ' + needs);

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
