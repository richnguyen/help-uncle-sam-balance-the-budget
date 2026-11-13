const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['', 'm', 'duel', 'dock']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const winByHand = require('./winbyhand');
const { chromium } = require('playwright');
const base = 'http://localhost:5173/';
const out = __OUT + '/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const calls = []; let playersPosts = 0; const playerBodies = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { if (!localStorage.getItem('ftd:journey')) { localStorage.setItem('ftd:backend', '"on"'); localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, settings: { narration: false, freeRoam: true, haptics: false } })); } });
  await ctx.route('**/*.supabase.co/**', async (route) => {
    const r = route.request(); const u = new URL(r.url()); const body = r.postData() ? JSON.parse(r.postData()) : null;
    if (u.pathname.endsWith('/auth/v1/signup')) return route.fulfill({ json: { access_token: 't', refresh_token: 't', expires_in: 3600, user: { id: '00000000-0000-0000-0000-000000000001' } } });
    if (u.pathname.includes('/rpc/count_')) { calls.push(u.pathname.split('/').pop() + ' ' + body.p_kind + '/' + body.p_channel); return route.fulfill({ status: 204, body: '' }); }
    if (u.pathname.endsWith('/rpc/share_stats')) return route.fulfill({ json: { window_days: body.window_days, since: '2026-10-08', shares: { plan: { wh: 12, x: 5, cp: 3 }, story: { sh: 4 }, daily: { x: 6 } }, arrivals: { plan: { wh: 20, x: 9 }, story: { sh: 3 }, daily: { x: 11 } }, players: { plan: { wh: 7, x: 2 }, story: { sh: 1 }, site: { direct: 30 } }, players_all: 52, funnel: { taken: 15, met: 9, returned: 4 }, daily: [{ day: '2026-11-05', shares: 10, arrivals: 18 }, { day: '2026-11-06', shares: 20, arrivals: 25 }] } });
    if (u.pathname.includes('/rpc/')) return route.fulfill({ json: u.pathname.includes('ballot') ? { voters: 0, options: {}, plans: {}, issues: {} } : u.pathname.includes('player') ? { players: 0, done: {}, stars: {}, firstTry: {}, medals: {} } : [] });
    if (u.pathname.endsWith('/players')) { playersPosts++; playerBodies.push(body); return playersPosts === 1 ? route.fulfill({ status: 400, json: { code: 'PGRST204', message: "Could not find the 'came_from' column" } }) : route.fulfill({ status: 201, body: '' }); }
    return route.fulfill({ status: 201, body: '' });
  });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  // Arrivals: a plan link from WhatsApp, the same link again, then a Budget Story link from X.
  await p.goto(base + '?p=10.acg&by=Ruth&s=wh'); await p.waitForTimeout(1200);
  await p.goto(base + '?p=10.acg&by=Ruth&s=wh'); await p.waitForTimeout(1200);
  await p.goto(base + '?p=10.acgr&s=x&k=story'); await p.waitForTimeout(1200);
  console.log('first touch kept:', await p.evaluate(() => [localStorage.getItem('ftd:src'), localStorage.getItem('ftd:src-kind')].join(' ')));
  // Shares: the Daily Dollar's X link, and a level card's network link.
  await p.goto(base + '#daily'); await p.waitForTimeout(800);
  for (let k = 0; k < 5; k++) { await p.getByRole('button', { name: '▲ Higher' }).click(); await p.waitForTimeout(100); await p.locator('.daily-actions .btn-primary').click(); await p.waitForTimeout(100); }
  const xHref = await p.locator('.daily-done .social-link[data-net="x"]').getAttribute('href');
  await p.locator('.daily-done .social-link[data-net="x"]').click(); await p.waitForTimeout(500);
  console.log('daily X link tag:', decodeURIComponent(xHref).match(/daily[^ ]*s=[a-z]+[^ ]*/)?.[0]);
  // Finishing a chapter level saves a player record (with came_from), and its card shares as 'level'.
  await p.goto(base + '#story'); await p.waitForTimeout(500);
  await p.goto(base + '#level-10'); await p.waitForTimeout(800);
  await winByHand(p);
  await p.locator('.celebrate .social-link[data-net="whatsapp"]').click(); await p.waitForTimeout(400);
  await p.keyboard.press('Escape'); await p.waitForTimeout(4000);
  console.log('counts sent:', calls.join(' | '));
  console.log('player record posts:', playersPosts, '| first had came_from:', playerBodies[0]?.came_from, '| retry without it:', playerBodies[1] && !('came_from' in playerBodies[1]));
  // The stats page.
  await p.goto(base + '#stats'); await p.waitForTimeout(1200);
  const tiles = await p.$$eval('.stats .stat', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  console.log('tiles:', tiles.join(' | '));
  console.log('K line:', (await p.locator('.stats-k strong').textContent()));
  console.log('funnel rows:', (await p.$$eval('#funnel .rrow', (rows) => rows.map((r) => r.textContent.replace(/\s+/g, ' ')))).join(' / '));
  console.log('channel rows:', (await p.$$eval('#channels tbody tr', (rows) => rows.map((r) => r.textContent.replace(/\s+/g, ' ')))).join(' / '));
  await p.screenshot({ path: out + 'stats-desk.png', fullPage: true });
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400);
  console.log('phone overflow:', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
