// The desk's compact layout on a phone: a slim full-width scoreboard that stays pinned while the
// cards scroll, cards that fit between it and the bottom bars, flip to a same-size back (hidden
// from screen readers until flipped), keep their effect hidden until played, and plan ideas as
// combo cards with their deficit and debt numbers.
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  for (const [name, dev] of [['iPhone 13', devices['iPhone 13']], ['iPhone SE', devices['iPhone SE']]]) {
    const ctx = await b.newContext({ ...dev, hasTouch: true });
    await ctx.addInitScript(() => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, done: ['level-1'], settings: { freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false } })); });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:5173/#level-5'); await p.waitForSelector('.pcard'); await p.waitForTimeout(1300);
    await p.addStyleTag({ content: '.toasts{display:none!important}' });
    const m0 = await p.evaluate(() => { const r = document.querySelector('.hud-board').getBoundingClientRect(); return { h: r.height, w: r.width, l: r.left, vw: innerWidth, radius: getComputedStyle(document.querySelector('.hud-board')).borderTopLeftRadius }; });
    ok(m0.h <= 170 && Math.abs(m0.w - m0.vw) <= 1 && m0.l <= 0.5 && m0.radius === '0px', `${name}: the scoreboard is one slim full-width band (${Math.round(m0.h)}px tall, ${Math.round(m0.w)} of ${m0.vw}px, square corners)`);
    ok(await p.locator('.plan-bar').count() === 0, `${name}: no second progress bar at the bottom before the goal`);
    // Scroll so the deck sits just under the pinned scoreboard, as a player would.
    await p.evaluate(() => { const c = document.querySelector('.pcard').getBoundingClientRect(), bd = document.querySelector('.hud-board').getBoundingClientRect(); scrollBy(0, c.top - bd.height - document.querySelector('.appbar').getBoundingClientRect().height - 8); }); await p.waitForTimeout(500);
    const m1 = await p.evaluate(() => {
      const hud = document.querySelector('.appbar').getBoundingClientRect(), bd = document.querySelector('.hud-board').getBoundingClientRect(), c = document.querySelector('.pcard').getBoundingClientRect();
      const bottom = Math.min(...[...document.querySelectorAll('.tabbar, .actionbar')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.getBoundingClientRect().top), innerHeight);
      return { pinned: Math.abs(bd.top - hud.bottom) <= 2, cardTop: c.top, cardBottom: c.bottom, boardBottom: bd.bottom, bottom, cw: c.width, vw: innerWidth };
    });
    ok(m1.pinned, `${name}: the scoreboard stays pinned under the top bar while the cards are in view`);
    ok(m1.cardTop >= m1.boardBottom - 1 && m1.cardBottom <= m1.bottom + 1 && m1.cw <= m1.vw - 32, `${name}: a whole card fits between the scoreboard and the bottom bars (${Math.round(m1.cardTop)}–${Math.round(m1.cardBottom)} of ${Math.round(m1.boardBottom)}–${Math.round(m1.bottom)})`);
    const card = p.locator('.pcard').nth(1);
    ok(await card.locator('.pcard-effect').count() === 0 && !/Closes|gap/.test(await card.locator('.pcard-front').textContent()), `${name}: the front keeps the effect hidden until the card is played`);
    const sizes = await card.evaluate((c) => [...c.querySelectorAll('.pcard-face')].map((f) => `${Math.round(f.getBoundingClientRect().width)}x${Math.round(f.getBoundingClientRect().height)}`));
    await card.locator('.pcard-front .pcard-flip').tap(); await p.waitForTimeout(700);
    const st = await card.evaluate((c) => ({ flipped: c.hasAttribute('data-flipped'), front: c.querySelector('.pcard-front').inert, back: c.querySelector('.pcard-back').inert, who: /Who pays:/.test(c.querySelector('.pcard-back').textContent) }));
    ok(st.flipped && st.front && !st.back && st.who && sizes[0] === sizes[1], `${name}: flipping shows the back, same size (${sizes.join(' / ')}), with the front hidden from screen readers`);
    await card.locator('.pcard-back .pcard-flip').tap(); await p.waitForTimeout(700);
    ok(await card.evaluate((c) => !c.hasAttribute('data-flipped') && c.querySelector('.pcard-back').inert), `${name}: it flips back`);
    await card.locator('.pcard-add').tap(); await p.waitForTimeout(600);
    ok(/^Closes .*gap$/.test(await card.locator('.pcard-effect').textContent().catch(() => '')), `${name}: once played, the card shows what it closes`);
    if (await p.locator('.celebrate').count()) { await p.locator('.celebrate-x').tap(); await p.waitForTimeout(300); }
    // Plan ideas: combo cards with the numbers at the bottom.
    await p.evaluate(() => document.querySelector('.ccard').scrollIntoView({ block: 'center' })); await p.waitForTimeout(400);
    const cc = await p.evaluate(() => [...document.querySelectorAll('.ccard')].map((c) => ({ title: c.querySelector('.pcard-title')?.textContent, nums: [...c.querySelectorAll('.ccard-nums dd')].map((d) => d.textContent), fan: c.querySelectorAll('.ccard-mini').length, h: Math.round(c.getBoundingClientRect().height) })));
    ok(cc.length >= 3 && cc.every((c) => c.title && c.nums.length === 2 && c.nums.every((n) => /^[−+]\$[\d.]+ ?(billion|trillion|B|T)$|^\$0$/.test(n)) && c.fan >= 1), `${name}: plan ideas are combo cards with a hand of cards and deficit and debt numbers (${cc.map((c) => c.nums.join(' / ')).join('; ')})`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: no sideways scroll`);
    await ctx.close();
  }
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
})();
