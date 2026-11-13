// The mission page: a compact head (the title with difficulty and time on one line; no campaign
// eyebrow or lede), one line of steps, one line for the game (the current round named, the score, the stars), and
// the game starting high on the page. Five widths, plus tabs, keyboard, a finished mission and dark.
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['', 'm', 'duel', 'dock']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const H = require('./gamehelp');
const base = process.argv[2] || 'http://localhost:5173/';
const out = __OUT + '/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const done = ['level-1', 'level-2', 'level-spend', 'level-3', 'level-4', 'level-economy', 'level-6'];
const J = (theme) => JSON.stringify({ v: 2, done, stars: { 'level-4': 2 }, steps: {}, quiz: {}, choices: {}, started: '2026-11-01', marks: [], medals: ['first-steps'], settings: { theme, freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false, voiceV: 2 } });
(async () => {
  const b = await chromium.launch(); const errs = [];
  const sizes = [['1280', { viewport: { width: 1280, height: 800 } }], ['1024', { viewport: { width: 1024, height: 800 } }], ['768', { viewport: { width: 768, height: 900 } }], ['phone', { ...devices['iPhone 13'] }], ['360', { ...devices['iPhone 13'], viewport: { width: 360, height: 740 } }]];
  for (const [name, opts] of sizes) {
    const ctx = await b.newContext(opts);
    await ctx.addInitScript((j) => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', j); }, J('light'));
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    const tap = /phone|360/.test(name); const narrow = /phone|360/.test(name);
    await p.goto(base + '#level-rules'); await p.waitForTimeout(1000);
    const head = await p.evaluate(() => {
      const vis = (e) => !!e && e.getBoundingClientRect().width > 2 && getComputedStyle(e).visibility !== 'hidden';
      const segs = [...document.querySelectorAll('.steptrack-seg')].map((e) => e.getBoundingClientRect());
      const mid = (r) => r.top + r.height / 2;
      const labels = [...document.querySelectorAll('.steptrack-seg .st-label')].filter(vis).map((e) => e.textContent);
      const h1 = document.querySelector('.level h1');
      return {
        noHead: !document.querySelector('.level-head') && ![...document.querySelectorAll('.level .eyebrow')].some((e) => vis(e) && /Campaign \d · Mission/i.test(e.textContent)),
        h1: h1?.textContent, h1Shown: h1 ? h1.getBoundingClientRect().height >= 24 && vis(h1) : false,
        oneRow: segs.length === 4 && segs.every((r) => Math.abs(mid(r) - mid(segs[0])) < 2),
        labels, meta: vis(document.querySelector('.level-meta')) ? document.querySelector('.level-meta').textContent.trim() : '',
        titleRow: (() => { const t = document.querySelector('.level-title'); const n = document.querySelector('.level-name').getBoundingClientRect(); const m = document.querySelector('.level-meta').getBoundingClientRect(); return { h: Math.round(t.getBoundingClientRect().height), same: Math.abs(n.bottom - m.bottom) < 8 && m.left > n.right }; })(),
        countHidden: !vis(document.querySelector('.step-count')) && /Step 1 of 4 · Its own referee/.test(document.querySelector('#step-label')?.textContent ?? ''),
        oldGone: !document.querySelector('.steptrack-labels'),
        brief: document.querySelector('.level-brief')?.textContent ?? '',
        trackH: Math.round(document.querySelector('.steptrack').getBoundingClientRect().height),
        segH: Math.round(segs[0].height),
      };
    });
    ok(head.noHead && head.h1 === 'Rules of the road' && head.h1Shown && head.oldGone, `${name}: the mission’s title shows; no campaign eyebrow or lede`);
    ok(head.titleRow.same && head.titleRow.h <= 44 && /Medium\s*· (about )?7 min/.test(head.meta), `${name}: one title line (${head.titleRow.h}px): the title, then ${head.meta}`);
    ok(head.oneRow && head.trackH <= 40 && head.countHidden, `${name}: the steps are one line (${head.trackH}px), and “Step 1 of 4” is said, not shown`);
    ok(narrow ? head.labels.join() === 'Its own referee' : head.labels.length === 4, `${name}: ${narrow ? 'only the current step is named' : 'every step named'}`);
    ok(/In this mission/.test(head.brief) && /points of order/.test(head.brief), `${name}: the intro step gives the mission’s brief`);
    await H.toStep(p, 'Blow the whistle', tap); await p.waitForTimeout(500);
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(250);
    const g = await p.evaluate(() => {
      const hud = document.querySelector('.game-hud'); const hb = hud.getBoundingClientRect();
      const kids = [...hud.children].filter((e) => e.getBoundingClientRect().width > 2);
      const mid = (r) => r.top + r.height / 2;
      const round = document.querySelector('.game-round').getBoundingClientRect();
      const topbar = document.querySelector('header.hud').getBoundingClientRect();
      return {
        oneLine: kids.every((e) => Math.abs(mid(e.getBoundingClientRect()) - mid(hb)) < 4), hudH: Math.round(hb.height),
        noTitle: !document.querySelector('.game-title') && !document.querySelector('.game-goal'),
        cur: (() => { const c = document.querySelector('.game-dots li[data-on]')?.cloneNode(true); c?.querySelectorAll('.sr-only').forEach((x) => x.remove()); return c?.textContent.trim(); })(), label: document.querySelector('.game-round-label')?.textContent,
        dots: document.querySelectorAll('.game-dots li').length, labelInRound: !!document.querySelector('.game-round .game-round-label'),
        gap: Math.round(round.top - topbar.bottom), roundTop: Math.round(round.top),
        stars: !!document.querySelector('.game-hud .stars') && document.querySelector('.game-hud .stars').getBoundingClientRect().width > 0,
        scroll: document.documentElement.scrollWidth <= innerWidth,
      };
    });
    ok(g.oneLine && g.hudH <= 48 && g.noTitle && g.dots === 6 && !g.labelInRound, `${name}: the game’s bar is one line (${g.hudH}px): rounds, score${g.stars ? ', stars' : ''}; no repeated title`);
    ok(/^1 · Point of order!$/.test(g.cur) && g.label === 'Round 1 of 6 · Point of order!', `${name}: the current round carries its name (“${g.cur}”), read as “${g.label}”`);
    ok(g.gap <= 190, `${name}: the round starts ${g.gap}px under the top bar`);
    // Later rounds: the finished ones show their points (or a check on phones).
    await H.playRound(p, tap); await p.locator('.game-next').click(); await p.waitForTimeout(400);
    const d = await p.evaluate(() => { const seen = (e) => { const c = e?.cloneNode(true); c?.querySelectorAll('.sr-only').forEach((x) => x.remove()); return c ? [...c.childNodes].map((n) => n.nodeType === 3 || getComputedStyle(e.querySelector('.' + (n.className || 'x')) || e).display !== 'none' ? n.textContent : '').join('').trim() : ''; }; return ({ first: seen(document.querySelector('.game-dots li[data-done]')), cur: seen(document.querySelector('.game-dots li[data-on]')), scroll: document.documentElement.scrollWidth <= innerWidth }); });
    ok((narrow ? d.first === '✓' : /^\+\d+$/.test(d.first)) && /^2 · Strike it out$/.test(d.cur), `${name}: round 2: the first round shows “${d.first}”, the current “${d.cur}”`);
    ok(g.scroll && d.scroll, `${name}: no sideways scroll`);
    await p.screenshot({ path: out + `mline-${name}.png` });
    // The step tabs still move between reachable steps.
    await p.locator('.steptrack-seg').nth(0).click(); await p.waitForTimeout(400);
    ok(/Step 1 of 4/.test(await p.locator('#step-label').textContent()) && await p.locator('.steptrack-seg[data-current="true"]').count() === 1 && await p.locator('.steptrack-seg').nth(3).isDisabled(), `${name}: a tab goes back to step 1; unreached steps stay locked`);
    await ctx.close();
  }
  // A finished mission shows its best stars in the line; dark mode keeps the tabs readable.
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  await ctx.addInitScript((j) => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', j); }, J('dark'));
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base + '#level-4'); await p.waitForTimeout(900);
  const f = await p.evaluate(() => {
    const seg = document.querySelector('.steptrack-seg[data-done="true"]'); const cs = getComputedStyle(seg);
    const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
    const a = lum(cs.color), bg = lum(cs.backgroundColor); const ratio = (Math.max(a, bg) + 0.05) / (Math.min(a, bg) + 0.05);
    return { stars: document.querySelectorAll('.level-meta .star.on').length, allDone: document.querySelectorAll('.steptrack-seg[data-done="true"]').length, n: document.querySelectorAll('.steptrack-seg').length, ratio: Math.round(ratio * 10) / 10, complete: !!document.querySelector('.complete') };
  });
  ok(f.stars === 2 && f.allDone === f.n && f.complete, `a finished mission: every tab checked, best ${f.stars}★ beside the title, and the complete card`);
  ok(f.ratio >= 4.5, `dark mode: a done tab’s text contrast is ${f.ratio}:1`);
  await p.locator('.level-title').screenshot({ path: out + 'mline-done-dark-title.png' }); await p.locator('.steptrack').screenshot({ path: out + 'mline-done-dark.png' });
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
})().catch((e) => { console.log('FAIL crashed:', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
