// The top bar: Uncle Sam at the left (no logo), across two lines. Line one: the mission, its name,
// and the player's title, then stars, accomplishments, sound, main menu (no glossary, methods,
// settings or progress bars). Line two: his running words. Screenshots at five widths, plus checks.
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['', 'm', 'duel', 'dock']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const base = process.argv[2] || 'http://localhost:5173/';
const out = __OUT + '/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const done = ['level-1', 'level-2', 'level-spend', 'level-3', 'level-4', 'level-economy', 'level-6', 'level-roles'];
const J = (voice) => JSON.stringify({ v: 2, done, stars: {}, steps: {}, quiz: {}, choices: {}, started: '2026-11-01', marks: [], medals: [], settings: { theme: 'light', freeRoam: true, narration: voice, voice: 'off', sounds: false, haptics: false, voiceV: 2 } });
(async () => {
  const b = await chromium.launch(); const errs = [];
  const sizes = [['1280', { viewport: { width: 1280, height: 800 } }], ['1024', { viewport: { width: 1024, height: 800 } }], ['768', { viewport: { width: 768, height: 900 } }], ['phone', { ...devices['iPhone 13'] }], ['360', { ...devices['iPhone 13'], viewport: { width: 360, height: 740 } }]];
  for (const [name, opts] of sizes) {
    const ctx = await b.newContext(opts);
    await ctx.addInitScript((j) => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', j); }, J(false));
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '#level-rules'); await p.waitForTimeout(1200);
    await p.locator('header.hud').screenshot({ path: out + `hud-${name}.png` });
    const r = await p.evaluate(() => {
      const q = (s) => document.querySelector('header.hud ' + s);
      const box = (e) => e && e.getBoundingClientRect();
      const rows = document.querySelectorAll('header.hud .hud-line').length;
      const sam = box(q('.sam-portrait-hud')); const lvl = box(q('.hud-title')); const strip = box(q('.sam-strip')); const line = box(q('.hud-line')); const hb = box(q('.hud-inner'));
      const right = [...document.querySelectorAll('header.hud .hud-right .hud-row > *')].map(box).filter((x) => x.width > 0);
      const mid = (x) => x.top + x.height / 2; const sideBox = box(q('.hud-right'));
      const oneLine = right.every((x) => Math.abs(mid(x) - mid(right[0])) < 6) && right.every((x) => x.left >= sideBox.left - 1 && x.right <= sideBox.right + 1);
      const title = q('.hud-title');
      return {
        rows, oneLine, samLeft: sam ? sam.left < lvl.left && sam.right <= strip.left + 1 && sam.left - hb.left < 24 : false, stripSecond: strip.top >= line.bottom - 1 && strip.bottom <= box(document.querySelector('header.hud')).bottom && strip.left > sam.left, logo: !!q('.ab-brand'),
        bars: document.querySelectorAll('header.hud .stb-camp, header.hud .stb-track').length,
        gone: ['#glossary', '#sources'].every((h) => !q(`a[href="${h}"]`)) && ![...document.querySelectorAll('header.hud button, header.hud a')].some((e) => /^Settings$/.test((e.title || e.textContent).trim())),
        title: title?.textContent, titleShown: title ? box(title).width > 20 : false,
        num: q('.ab-levelnum')?.textContent.trim(), rank: q('.hud-sub')?.textContent, rankShown: q('.hud-sub') ? box(q('.hud-sub')).width > 0 : false,
        sound: q('.hud-voice')?.textContent.trim(), soundShown: q('.hud-voice') ? box(q('.hud-voice')).width > 0 : false,
        menu: !q('a.ab-journey') && !q('a[href="#journey"]'), voiceAtStrip: !!q('.hud-talk > .hud-voice:first-child') && !q('.hud-right .hud-voice') && box(q('.hud-voice')).right <= box(q('.sam-strip')).left + 1, stars: q('.ab-stars') ? box(q('.ab-stars')).width > 0 : false,
        fs: parseFloat(getComputedStyle(q('.ab-stars')).fontSize), lvfs: parseFloat(getComputedStyle(q('.hud-title')).fontSize),
        scroll: document.documentElement.scrollWidth <= innerWidth, h: Math.round(box(q('.hud-inner')).height),
      };
    });
    ok(r.rows === 1 && r.oneLine && r.stripSecond && !r.logo, `${name}: Uncle Sam’s words are the bar’s second line; no logo`);
    ok(r.bars === 0 && r.gone, `${name}: no progress bars, and no glossary, methods or settings in the bar`);
    ok(r.title === 'Mission 2.4' && r.titleShown && !r.num, `${name}: the bar names the mission (${r.title}); the mission list and progress are in Your record`);
    ok(r.soundShown && r.voiceAtStrip && r.menu && r.stars && r.samLeft, `${name}: the sound button starts the dialog strip; stars on the right and no Main menu button (the Feed tab is the way back); Uncle Sam at the left${r.sound ? `; sound reads “${r.sound}”` : ''}`);
    ok(r.fs >= 15 && r.lvfs >= 15, `${name}: larger text (${r.fs}px on the right, ${r.lvfs}px for the mission)`);
    ok(r.scroll, `${name}: no sideways scroll (bar ${r.h}px tall)`);
    await ctx.close();
  }
  // The sound button toggles, and says so.
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript((j) => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', j); }, J(false));
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base + '#level-rules'); await p.waitForTimeout(1000);
  const before = [await p.locator('.hud-voice').textContent(), await p.locator('.hud-voice').getAttribute('aria-pressed')];
  await p.locator('.hud-voice').click(); await p.waitForTimeout(300);
  const after = [await p.locator('.hud-voice').textContent(), await p.locator('.hud-voice').getAttribute('aria-pressed')];
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('ftd:journey')).settings.narration);
  ok(before.join() === 'Sound off,false' && after.join() === 'Sound on,true' && saved === true, `the sound button: ${before.join('/')} → ${after.join('/')}, and remembered`);
  await p.locator('header.hud').screenshot({ path: out + 'hud-sound-on.png' });
  // Settings, the glossary and methods are still one tap from the main menu, field guide and footer.
  await p.goto(base + '#journey'); await p.waitForTimeout(800);
  ok(await p.locator('a[href="#settings"]').count() >= 1 && await p.locator('a[href="#guide"]').count() >= 1, 'the main menu still links Settings and the field guide');
  await p.goto(base + '#guide'); await p.waitForTimeout(800);
  ok(await p.locator('a[href="#glossary"]').count() >= 1 && await p.locator('a[href="#sources"]').count() >= 1, 'the field guide links the glossary and Sources & methods');
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})();
