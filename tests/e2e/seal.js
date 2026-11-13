// The mission-complete card shows the mission's seal, not Uncle Sam (he's in the top bar); the
// final certificate shows the grand seal. Colors by difficulty, stars earned, the stamp landing.
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['', 'm', 'duel', 'dock']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const H = require('./gamehelp');
const base = process.argv[2] || 'http://localhost:5173/';
const out = __OUT + '/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const ALL = ['level-1', 'level-2', 'level-3', 'level-4', 'level-5', 'level-6', 'level-7', 'level-8', 'level-9', 'level-10', 'level-economy', 'level-drag', 'level-fairness', 'level-growth', 'level-investment', 'level-future', 'level-spend', 'level-roles', 'level-rules', 'level-brakes', 'level-yardstick'];
const J = (done, stars, theme = 'light') => JSON.stringify({ v: 2, done, stars, steps: {}, quiz: {}, choices: {}, started: '2026-11-01', marks: [], medals: [], built: [], decor: [], settings: { theme, freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false, voiceV: 2 } });
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (state, opts = { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 }) => { const ctx = await b.newContext(opts); await ctx.addInitScript((j) => { localStorage.setItem('ftd:journey', j); }, state); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
  // 1. A finished mission's page opens on its complete card.
  for (const [id, stars, diff, code, theme] of [['level-rules', 2, 'medium', '2.4', 'light'], ['level-1', 3, 'easy', '1.1', 'light'], ['level-brakes', 1, 'hard', '3.3', 'dark']]) {
    const p = await mk(J([id], { [id]: stars }, theme));
    await p.goto(base + '#' + id); await p.waitForTimeout(1400);
    const r = await p.evaluate(() => {
      const card = document.querySelector('.complete');
      const seal = card?.querySelector('.complete-top .seal');
      return {
        sam: !!card?.querySelector('.complete-top svg.sam'), seal: !!seal, diff: seal?.dataset.diff, rim: [...(seal?.querySelectorAll('textPath') ?? [])].map((t) => t.textContent.trim()).join(' · '),
        on: seal ? seal.querySelectorAll('.seal-stars path[data-on]').length : -1, icon: !!seal?.querySelector('.seal-icon svg'),
        color: seal ? getComputedStyle(seal.querySelector('.seal-edge')).fill : '', hidden: seal?.getAttribute('aria-hidden'),
        title: card?.querySelector('.complete-title')?.textContent,
      };
    });
    ok(r.seal && !r.sam, `${code}: the complete card shows the mission’s seal, not Uncle Sam`);
    ok(r.diff === diff && r.rim.includes(`MISSION ${code} · COMPLETE`) && r.on === stars && r.icon && r.hidden === 'true', `${code}: a ${diff} seal with its icon, “${r.rim.trim().slice(0, 26)}…”, ${r.on} of 3 stars, decorative (the card says it in words: “${r.title}”)`);
    await p.locator('.complete-top').screenshot({ path: out + `seal-${code}-${theme}.png` });
    await p.context().close();
  }
  // 2. The seal lands like a stamp; with less motion it simply sits there.
  let p = await mk(J(['level-2'], { 'level-2': 3 }));
  await p.goto(base + '#level-2'); await p.waitForTimeout(1200);
  const anim = await p.evaluate(() => getComputedStyle(document.querySelector('.seal-svg')).animationName);
  ok(anim === 'seal-stamp', 'the seal lands like a stamp');
  await p.context().close();
  const rctx = await b.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: 'reduce' });
  await rctx.addInitScript((j) => { localStorage.setItem('ftd:journey', j); }, J(['level-2'], { 'level-2': 3 }));
  p = await rctx.newPage(); await p.goto(base + '#level-2'); await p.waitForTimeout(900);
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.seal-svg')).animationName) === 'none', 'less motion: no stamp, no glint');
  await rctx.close();
  // 3. Finishing a mission for real: play mission 1.3's last steps, close the celebration, see the seal.
  p = await mk(J(['level-1', 'level-2'], { 'level-1': 3, 'level-2': 3 }), { ...devices['iPhone 13'] });
  await p.goto(base + '#level-spend'); await p.waitForTimeout(900);
  await H.playLevel(p, true); await p.waitForTimeout(600);
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  const ph = await p.evaluate(() => ({ seal: !!document.querySelector('.complete .seal'), sam: !!document.querySelector('.complete svg.sam'), fit: document.documentElement.scrollWidth <= innerWidth }));
  ok(ph.seal && !ph.sam && ph.fit, 'phone: playing a mission to the end, its card shows the seal; it fits');
  await p.locator('.complete').screenshot({ path: out + 'seal-phone.png' });
  await p.context().close();
  // 4. The final certificate: the grand seal.
  p = await mk(J(ALL, Object.fromEntries(ALL.map((x) => [x, 2]))));
  await p.goto(base + '#record'); await p.waitForTimeout(1200);
  const g = await p.evaluate(() => { const c = document.querySelector('.certificate'); return { grand: !!c?.querySelector('.seal.seal-grand'), sam: !!c?.querySelector('svg.sam'), rim: c?.querySelector('textPath')?.textContent }; });
  ok(g.grand && !g.sam && /INFORMED BUDGET VOTER/.test(g.rim), 'the final certificate shows the grand seal: ' + (g.rim || '').trim().slice(0, 40));
  await p.locator('.certificate').screenshot({ path: out + 'seal-grand.png' });
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
})().catch((e) => { console.log('FAIL crashed:', e.message.split('\n')[0]); process.exit(1); });
