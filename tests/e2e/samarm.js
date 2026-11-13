// Uncle Sam on the main menu: mid-wave and cheering, his arms whole (not cut at the edge).
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['', 'm', 'duel', 'dock']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const out = __OUT + '/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const all = ['level-1', 'level-2', 'level-3', 'level-4', 'level-5', 'level-6', 'level-7', 'level-8', 'level-9', 'level-10', 'level-economy', 'level-drag', 'level-fairness', 'level-growth', 'level-investment', 'level-future', 'level-spend', 'level-roles', 'level-rules', 'level-brakes', 'level-yardstick'];
  for (const [name, done, opts, at] of [['wave-desk', [], { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }, 700], ['cheer-desk', all, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }, 1500], ['wave-phone', [], { ...devices['iPhone 13'] }, 700]]) {
    const ctx = await b.newContext(opts);
    await ctx.addInitScript((j) => { localStorage.setItem('ftd:journey', j); }, JSON.stringify({ v: 2, done, stars: Object.fromEntries(done.map((d) => [d, 2])), steps: {}, quiz: {}, choices: {}, started: '2026-11-01', marks: [], medals: [], built: [], decor: [], settings: { theme: 'light', freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false, voiceV: 2 } }));
    const p = await ctx.newPage();
    await p.goto((process.argv[2] || 'http://localhost:5173/') + '#journey'); await p.waitForTimeout(at);
    const r = await p.evaluate(() => {
      const svg = document.querySelector('.sam-portrait-menu svg.sam'); const vb = svg.viewBox.baseVal;
      // every arm and hand drawn now: is any of it outside the picture?
      const parts = [...svg.querySelectorAll('.sam-wave, .sam-explain, .sam-arms, .sam-thumb, .sam-wring, .sam-hands-up, .sam-act')].filter((g) => getComputedStyle(g).display !== 'none');
      const out = parts.map((g) => { const bb = g.getBBox(); return { cls: g.getAttribute('class'), x0: bb.x, x1: bb.x + bb.width }; }).filter((x) => x.x1 - x.x0 > 0);
      return { vb: [vb.x, vb.y, vb.width, vb.height].join(' '), mood: svg.dataset.mood, arms: out, clipped: out.filter((x) => x.x0 < vb.x - 0.5 || x.x1 > vb.x + vb.width + 0.5) };
    });
    ok(r.vb === '0 0 120 150' && !r.clipped.length, `${name}: ${r.mood}, arms drawn: ${r.arms.map((a) => `${a.cls} ${a.x0.toFixed(0)}–${a.x1.toFixed(0)}`).join('; ') || 'none'}; none cut at the edge`);
    await p.locator('.menu-sam').screenshot({ path: out + `samarm-${name}.png` });
    await ctx.close();
  }
  await b.close();
})();
