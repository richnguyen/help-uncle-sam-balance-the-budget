// "How this is rated": on the desk's gauge, missions 1.6, 1.7, 2.5 and 2.6, and the interest card.
// Each opens in place with a method, what it leaves out, the conventional-vs-dynamic note, and sources.
const { chromium, devices } = require('playwright');
const out = process.argv[2] || '';
(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const J = (id, n) => JSON.stringify({ v: 2, done: ['level-1'], steps: id ? { [id]: [...Array(n).keys()] } : {}, settings: { freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false } });
  const check = async (p, id, where) => {
    const d = p.locator(`.rated[data-rated="${id}"]`).first();
    ok(await d.count() === 1, `${where}: a "How this is rated" link`);
    if (!await d.count()) return;
    await d.evaluate((el) => { el.scrollIntoView({ block: 'center' }); el.querySelector('summary').click(); }); await p.waitForTimeout(250);
    const t = await d.textContent();
    const links = await d.locator('.rated-src a').evaluateAll((l) => l.map((a) => a.href));
    ok(/Method/.test(t) && /Leaves out/.test(t) && /conventional/.test(t) && /dynamic/.test(t) && links.length >= 1 && links.every((h) => /^https:\/\/(www\.cbo\.gov|www\.imf\.org|fiscaldata\.treasury\.gov)\//.test(h)), `${where}: method, what it leaves out, the dynamic-estimate note, and official sources (${links.length})`);
    return d;
  };
  const open = async (hash, id, n) => {
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    await ctx.addInitScript((j) => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem('ftd:journey', j); }, J(id, n));
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:5173/#' + hash); await p.waitForTimeout(1500); return p;
  };
  // Walk a mission's steps until the method shows up.
  const inMission = async (lvl, id, where) => {
    const p = await open(lvl, lvl, 12);
    const has = async () => (await p.locator(`.rated[data-rated="${id}"]`).count()) > 0;
    for (let k = 0; k < 12 && !(await has()); k++) {
      await p.evaluate((k) => document.querySelectorAll('.steptrack-seg')[k]?.click(), k); await p.waitForTimeout(450);
      // In a game, finish the round in front of it (lock in the guess, go on) until the method shows.
      for (let r = 0; r < 3 && !(await has()) && await p.locator('.game-round').count(); r++) {
        await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /^Lock in/.test(x.textContent.trim()))?.click()); await p.waitForTimeout(600);
        await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /^Next round/.test(x.textContent.trim()))?.click()); await p.waitForTimeout(600);
      }
    }
    return [p, await check(p, id, where)];
  };
  // The desk: a small "i" beside the economy gauge opens the method as a sheet.
  const desk = await open('level-5');
  const icon = desk.locator('.hud-board .rated-i[data-rated="steep"]');
  ok(await icon.count() === 1 && /rated/i.test(await icon.getAttribute('aria-label')), 'desk 1.9: an "i" beside the economy gauge, labeled for screen readers');
  await icon.click(); await desk.waitForTimeout(300);
  const sh = desk.locator('.rated-sheet[role="dialog"]'); const t = (await sh.count()) ? await sh.textContent() : '';
  const links = await sh.locator('.rated-src a').evaluateAll((l) => l.map((a) => a.href));
  ok(/Method/.test(t) && /Leaves out/.test(t) && /conventional/.test(t) && links.length >= 1 && links.every((h) => /^https:\/\/(www\.cbo\.gov|www\.imf\.org|fiscaldata\.treasury\.gov)\//.test(h)), `desk: the sheet gives the method, what it leaves out, and official sources (${links.length})`);
  ok(/0\.5% of GDP/.test(t) && /game’s own/.test(t), 'desk: the thresholds are stated and owned as the game’s');
  if (out) await sh.screenshot({ path: out + 'rated-steep.png' });
  await desk.keyboard.press('Escape'); await desk.waitForTimeout(200);
  ok(await sh.count() === 0 && await desk.evaluate(() => document.activeElement?.classList.contains('rated-i')), 'desk: Escape closes it and puts focus back on the "i"');
  await inMission('level-economy', 'ripple', 'mission 1.6 ripple');
  await inMission('level-drag', 'steep', 'mission 1.7 steepness');
  await inMission('level-growth', 'growth', 'mission 2.5 rule of thumb');
  await inMission('level-investment', 'investment', 'mission 2.6 rule of thumb');
  const me = await open('me'); const di = await check(me, 'interest', 'interest saved card');
  if (di) ok(/\d\.\d% in [A-Z][a-z]+ \d{4}/.test(await di.textContent()), 'interest: names the Treasury rate and its month');
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
})();
