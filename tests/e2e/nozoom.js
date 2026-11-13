// Phones: a pinch or a double tap doesn't zoom the game, but scrolling (and the Mall view's
// sideways scroll) still works. Checked with Chrome's own gesture synthesizer, against a control
// page that does zoom. Computers keep their zoom.
const { chromium, devices } = require('playwright');
const base = process.argv[2] || 'http://localhost:5173/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const J = JSON.stringify({ v: 2, done: ['level-1'], stars: { 'level-1': 3 }, steps: {}, quiz: {}, choices: {}, started: '2026-11-01', marks: [], medals: [], built: [], decor: [], settings: { theme: 'light', freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false, voiceV: 2 } });
(async () => {
  const b = await chromium.launch(); const errs = [];
  const phone = async () => { const ctx = await b.newContext({ ...devices['Pixel 7'] }); await ctx.addInitScript((j) => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', j); }, J); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return { p, cdp: await ctx.newCDPSession(p) }; };
  const scale = (p) => p.evaluate(() => window.visualViewport.scale);
  // Real touch streams through the browser's own gesture detection (the synthetic gesture API
  // does nothing in a headless browser; the control below proves these do).
  const T = (cdp, type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  const pinch = async (cdp, x, y) => {
    const pts = (d) => [{ x: x - d, y, id: 0 }, { x: x + d, y, id: 1 }];
    await T(cdp, 'touchStart', pts(20));
    for (let d = 24; d <= 150; d += 8) { await T(cdp, 'touchMove', pts(d)); await new Promise((r) => setTimeout(r, 16)); }
    await T(cdp, 'touchEnd', []);
  };
  const dtap = async (cdp, x, y) => { for (let k = 0; k < 2; k++) { await T(cdp, 'touchStart', [{ x, y }]); await T(cdp, 'touchEnd', []); await new Promise((r) => setTimeout(r, 90)); } };
  const drag = async (cdp, x0, y0, x1, y1) => {
    await T(cdp, 'touchStart', [{ x: x0, y: y0 }]);
    for (let k = 1; k <= 20; k++) { await T(cdp, 'touchMove', [{ x: x0 + ((x1 - x0) * k) / 20, y: y0 + ((y1 - y0) * k) / 20 }]); await new Promise((r) => setTimeout(r, 16)); }
    await T(cdp, 'touchEnd', []);
  };

  // The control: an ordinary page zooms on a pinch, so the check can tell.
  let { p, cdp } = await phone();
  await p.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><p style="font-size:14px">Some text to zoom into.</p><div style="height:3000px"></div>');
  await pinch(cdp, 200, 200); await p.waitForTimeout(400);
  const ctl = await scale(p);
  ok(ctl > 1.2, `control: an ordinary page zooms on a pinch (scale ${ctl.toFixed(2)})`);
  await p.context().close();

  // The game, on a phone.
  ({ p, cdp } = await phone());
  await p.goto(base + '#level-2'); await p.waitForTimeout(1200);
  const meta = await p.locator('meta[name="viewport"]').getAttribute('content');
  ok(/user-scalable=no/.test(meta) && /maximum-scale=1/.test(meta) && /viewport-fit=cover/.test(meta), 'the viewport tag: ' + meta);
  const ta = await p.evaluate(() => [getComputedStyle(document.documentElement).touchAction, getComputedStyle(document.body).touchAction, getComputedStyle(document.querySelector('button')).touchAction]);
  ok(ta.every((t) => t === 'pan-x pan-y'), 'touch-action, scrolling only, on the page and its buttons: ' + ta.join(' / '));
  await pinch(cdp, 200, 400); await p.waitForTimeout(400);
  ok(await scale(p) === 1, `a pinch on a mission page doesn't zoom (scale ${await scale(p)})`);
  await dtap(cdp, 120, 500); await p.waitForTimeout(500);
  ok(await scale(p) === 1, 'a double tap doesn’t zoom either');
  // Safari's gesture events and a two-finger move are cancelled; a one-finger move isn't.
  const ev = await p.evaluate(() => {
    const g = new Event('gesturestart', { cancelable: true, bubbles: true }); document.body.dispatchEvent(g);
    const t = (n) => { const el = document.body; const pts = [...Array(n)].map((_, i) => new Touch({ identifier: i, target: el, clientX: 100 + i * 50, clientY: 300 })); const e = new TouchEvent('touchmove', { touches: pts, cancelable: true, bubbles: true }); el.dispatchEvent(e); return e.defaultPrevented; };
    return { gesture: g.defaultPrevented, two: t(2), one: t(1) };
  });
  ok(ev.gesture && ev.two && !ev.one, `Safari’s pinch (gesturestart) and two-finger moves are cancelled; one finger still scrolls (${JSON.stringify(ev)})`);
  // A long page still scrolls with one finger (the field guide's Sources & methods).
  await p.goto(base + '#sources'); await p.waitForTimeout(1200);
  const room = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const y0 = await p.evaluate(() => scrollY);
  await drag(cdp, 200, 700, 200, 250); await p.waitForTimeout(700);
  const y1 = await p.evaluate(() => scrollY);
  ok(room > 1000 && y1 > y0 + 150, `a long page still scrolls with one finger (${y0} → ${Math.round(y1)}, of ${room}px)`);
  await pinch(cdp, 200, 400); await p.waitForTimeout(400);
  ok(await scale(p) === 1, 'and a pinch there doesn’t zoom');

  // The Mall view still scrolls sideways; the main menu doesn't zoom.
  await p.goto(base + '#mall'); await p.waitForTimeout(1200);
  const box = await p.locator('.bm-mall').boundingBox();
  const x0 = await p.locator('.bm-mall').evaluate((e) => e.scrollLeft);
  await drag(cdp, box.x + box.width * 0.75, box.y + box.height / 2, box.x + box.width * 0.2, box.y + box.height / 2); await p.waitForTimeout(600);
  const x1 = await p.locator('.bm-mall').evaluate((e) => e.scrollLeft);
  ok(Math.abs(x1 - x0) > 60, `the Mall view still scrolls sideways (${Math.round(x0)} → ${Math.round(x1)})`);
  await pinch(cdp, box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(400);
  ok(await scale(p) === 1, 'a pinch on the Mall view doesn’t zoom');
  await p.goto(base + '#journey'); await p.waitForTimeout(1200);
  await pinch(cdp, 200, 300); await p.waitForTimeout(400);
  ok(await scale(p) === 1, 'nor on the main menu');
  // Settings still offers larger text for anyone who needs it.
  await p.goto(base + '#settings'); await p.waitForTimeout(800);
  ok(/Text size/i.test(await p.locator('main').innerText()), 'Settings → Text size is there for larger text');
  await p.context().close();

  // A computer keeps its zoom: no touch-only rules, no gesture blocking.
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const d = await ctx.newPage();
  await d.goto(base + '#level-2'); await d.waitForTimeout(800);
  const desk = await d.evaluate(() => { const g = new Event('gesturestart', { cancelable: true, bubbles: true }); document.body.dispatchEvent(g); return { prevented: g.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction }; });
  ok(!desk.prevented && desk.ta === 'auto', `a computer: trackpad and keyboard zoom untouched (${JSON.stringify(desk)})`);
  await ctx.close();
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
})().catch((e) => { console.log('FAIL crashed:', e.message.split('\n')[0]); process.exit(1); });
