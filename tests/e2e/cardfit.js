// Every card's Play button sits fully inside its card, on a big phone and a small one, both decks.
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); let bad = 0;
  for (const [n, d] of [['13', devices['iPhone 13']], ['SE', devices['iPhone SE']]]) for (const lvl of ['level-5', 'level-10']) {
    const ctx = await b.newContext({ ...d });
    await ctx.addInitScript(() => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, done: ['level-1', 'level-5'], settings: { freeRoam: true, narration: false, voice: 'off', sounds: false } })); });
    const p = await ctx.newPage(); await p.goto('http://localhost:5173/#' + lvl); await p.waitForSelector('.pcard'); await p.waitForTimeout(1000);
    const r = await p.evaluate(() => [...document.querySelectorAll('.pcard, .ccard')].map((c) => { const f = c.querySelector('.pcard-front'), btn = f.querySelector('.pcard-add, .ccard-load'), fr = f.getBoundingClientRect(), br = btn.getBoundingClientRect(), t = f.querySelector('.pcard-title').getBoundingClientRect(); return { id: c.dataset.card || c.dataset.idea, ok: br.bottom <= fr.bottom - 4 && br.top >= t.bottom - 1 && t.height > 14 }; }));
    const fails = r.filter((x) => !x.ok); bad += fails.length;
    console.log(`iPhone ${n} ${lvl}: ${r.length - fails.length}/${r.length} cards fit`, fails.map((x) => x.id).join(' '));
    await ctx.close();
  }
  console.log(bad ? 'FAIL' : 'PASS all cards fit'); await b.close(); })();
