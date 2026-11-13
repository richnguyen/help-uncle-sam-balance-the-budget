const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['', 'm', 'duel', 'dock']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium } = require('playwright');
const out = __OUT + '/';
(async () => {
  const b = await chromium.launch();
  const run = async (vp, name, backend) => {
    const ctx = await b.newContext({ viewport: vp });
    await ctx.addInitScript((on) => { if (!localStorage.getItem('ftd:journey')) { if (on) localStorage.setItem('ftd:backend', '"on"'); localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, settings: { narration: false, freeRoam: true, haptics: false } })); } }, backend);
    const state = { cards: { 'ss-tax-earnings-over-250k': { net: 12, in: 15, out: 3 }, 'cut-defense-budget': { net: 7, in: 11, out: 4 }, 'medicare-advantage-benchmarks': { net: 5, in: 6, out: 1 }, 'vat-5pct': { net: -9, in: 4, out: 13 }, 'chained-cpi': { net: -2, in: 3, out: 5 } }, mine: null, writes: [] };
    await ctx.route('**/*.supabase.co/**', async (route) => {
      const r = route.request(); const u = r.url();
      if (u.includes('/auth/v1/signup')) return route.fulfill({ json: { access_token: 't', refresh_token: 't', expires_in: 3600, user: { id: '00000000-0000-0000-0000-000000000000' } } });
      if (u.includes('rpc/peoples_budget')) return route.fulfill({ json: { window_days: 30, contributors: 37, moves: 64, today: 9, all_time: 120, cards: state.cards } });
      if (u.includes('rpc/peoples_recent')) return route.fulfill({ json: [{ card: 'cut-defense-budget', dir: 1, at: new Date(Date.now() - 120000).toISOString() }, { card: 'vat-5pct', dir: -1, at: new Date(Date.now() - 3600e3 * 3).toISOString() }] });
      if (u.includes('rpc/')) return route.fulfill({ json: u.includes('ballot') ? { voters: 0, options: {}, plans: {}, issues: {} } : u.includes('player') ? { players: 0, done: {}, stars: {}, firstTry: {}, medals: {} } : [] });
      if (u.includes('peoples_moves')) {
        state.writes.push(r.method() + ' ' + (r.postData() || u.split('?')[1]));
        if (r.method() === 'POST') { state.mine = JSON.parse(r.postData()); return route.fulfill({ status: 201, body: '' }); }
        if (r.method() === 'DELETE') { state.mine = null; return route.fulfill({ status: 204, body: '' }); }
        return route.fulfill({ json: state.mine ? [state.mine] : [] });
      }
      return route.fulfill({ status: 201, body: '' });
    });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:5173/?peoples'); await p.waitForTimeout(1500);
    console.log(`[${name}] hash:`, await p.evaluate(() => location.hash), '| headline:', (await p.locator('.peoples-board .sb-big').textContent().catch(() => 'n/a')));
    if (!backend) { console.log(`[${name}] sam:`, (await p.locator('.sam-says, .samsays, [class*=sam]').first().textContent()).slice(0, 90)); await ctx.close(); return errs; }
    console.log(`[${name}] cards in:`, await p.locator('.peoples-card[data-in="true"]').count(), '| board:', (await p.locator('.peoples-board .small.muted').first().textContent()));
    await p.screenshot({ path: out + `peoples-${name}.png`, fullPage: true });
    await p.locator('.peoples-card', { hasText: 'Cap the tax break for employer health' }).getByRole('button', { name: 'Push in' }).click(); await p.waitForTimeout(3500);
    console.log(`[${name}] after move:`, (await p.locator('.peoples-mine strong').textContent()), '| writes:', state.writes.join(' ; '));
    await p.locator('.peoples-card', { hasText: 'Reduce crop insurance' }).getByRole('button', { name: 'Push out' }).click(); await p.waitForTimeout(1500);
    console.log(`[${name}] changed:`, (await p.locator('.peoples-mine strong').textContent()));
    await p.getByRole('button', { name: 'Take back today’s move' }).click(); await p.waitForTimeout(1500);
    console.log(`[${name}] taken back:`, (await p.locator('.peoples-mine strong').textContent()), '| medal toast seen:', await p.evaluate(() => document.body.innerText.includes('Many hands')));
    console.log(`[${name}] overflow:`, await p.evaluate(() => document.documentElement.scrollWidth - innerWidth));
    await ctx.close(); return errs;
  };
  const e1 = await run({ width: 1280, height: 900 }, 'desk', true);
  const e2 = await run({ width: 390, height: 844 }, 'phone', true);
  const e3 = await run({ width: 390, height: 844 }, 'offline', false);
  console.log('errors:', [...e1, ...e2, ...e3].length ? [...e1, ...e2, ...e3] : 'none');
  await b.close();
})();
