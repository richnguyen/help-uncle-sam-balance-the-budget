// A room's reveal, against a stand-in database (nothing reaches Supabase): the projector screen
// with the group's budget personality, the card that split the room (52% / 48%), and the
// take-it-home QR code and link (a challenge link with the room's plan); the host's class timer
// that opens the reveal on its own; and a gridlocked room ("Failed to pass a budget!").
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const base = 'http://localhost:5173/';
(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const mk = async (opts, totals, mine = true, timerIn = 0) => {
    const ctx = await b.newContext(opts);
    await ctx.addInitScript(([t]) => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem('ftd:backend', '"on"'); localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, settings: { narration: false, freeRoam: false, haptics: false, voice: 'off', sounds: false } })); if (t) localStorage.setItem('ftd:room-timer:K7MQ3P', String(Date.now() + t)); }, [timerIn]);
    await ctx.route('**/*.supabase.co/**', async (route) => {
      const u = new URL(route.request().url());
      if (u.pathname.endsWith('/auth/v1/signup')) return route.fulfill({ json: { access_token: 'x', refresh_token: 'x', expires_in: 3600, user: { id: 'host-0000' } } });
      if (u.pathname.endsWith('/rpc/get_room')) return route.fulfill({ json: { code: 'K7MQ3P', name: 'Ms. Lee’s 3rd period', level: 5, created_at: '2026-11-14T15:00:00Z', members: totals.members, plans: totals.plans, mine } });
      if (u.pathname.endsWith('/rpc/room_totals')) return route.fulfill({ json: totals });
      if (u.pathname.includes('/rpc/')) return route.fulfill({ json: u.pathname.includes('ballot') ? { voters: 0, options: {}, plans: {}, issues: {} } : u.pathname.includes('player') ? { players: 0, done: {}, stars: {}, firstTry: {}, medals: {} } : [] });
      if (u.pathname.endsWith('/room_members')) return route.fulfill({ json: [] });
      return route.fulfill({ status: 201, body: '' });
    });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p;
  };
  // 25 plans: one card in all of them, one in 20, and the retirement age in 13 (52%).
  const T = { members: 27, plans: 25, cards: { 'ss-tax-earnings-over-250k': 25, 'cut-defense-budget': 20, 'raise-full-retirement-age-70': 13, 'gas-tax-15c': 5 }, stars: {}, done: { 'level-5': 25 }, votes: { voters: 0, options: {}, issues: {} } };

  const p = await mk({ viewport: { width: 1280, height: 720 } }, T);
  await p.goto(base + '#room?c=K7MQ3P'); await p.waitForTimeout(1500);
  ok(await p.locator('#reveal').count() === 1 && await p.locator('#reveal button', { hasText: '10 min' }).count() === 1, 'the room has a reveal section, with a class timer for whoever started the room');
  await p.locator('#reveal button', { hasText: 'Show the reveal' }).click(); await p.waitForTimeout(400);
  const R = p.locator('.room-reveal');
  ok(await R.count() === 1, 'Show the reveal opens the projector screen');
  const name = await R.locator('.rr-name').textContent();
  ok(['The Ruthless Deficit Hawks', 'The Dealmakers', 'The Precision Planners', 'The Patient Builders'].includes(name), 'a group fiscal archetype for a plan that meets the goal: ' + name);
  ok(/^Ms\. Lee’s 3rd period · 25 plans from 27 members · Group fiscal archetype$/.test(await R.locator('.rr-eyebrow').textContent()), 'with the room, its plans and members');
  const split = await R.locator('.rr-split').textContent();
  ok(/Raise Social Security's full retirement age to 70/.test(split) && /52% of this room put it in their plan; 48% left it out\./.test(split), 'the most controversial card: the one nearest 50/50, 52% / 48%');
  ok(await R.locator('.rr-home svg.qr path').count() === 1, 'a QR code to take it home');
  const solo = await R.locator('.rr-home a', { hasText: 'Beat the room' }).getAttribute('href');
  const sq = new URL(solo).searchParams;
  ok(/^5\.[a-z]+$/.test(sq.get('p')) && sq.get('by') === 'Ms. Lee’s 3rd period' && /Build your own solo plan in 3 minutes and see if you can beat the room/.test(await R.locator('.rr-home').textContent()), 'and “Beat the room”: a challenge link with the room’s plan, by the room: ' + solo.replace(base, '/'));
  const tx = decodeURIComponent((await p.evaluate(() => [...document.querySelectorAll('.room-reveal button')].map((x) => x.textContent))).join('|'));
  ok(/Share the result/.test(tx) && /Back to the room/.test(tx), 'share the result, or go back');
  ok(await p.evaluate(() => { const r = document.querySelector('.rr-inner').getBoundingClientRect(); return r.bottom <= innerHeight + 2; }), 'it fits one 1280×720 projector screen');
  await p.screenshot({ path: __OUT + '/room-reveal.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(await R.count() === 0, 'Escape closes it');

  // The class timer: it opens the reveal on its own when it runs out.
  const q = await mk({ viewport: { width: 1280, height: 720 } }, T, true, 2500);
  await q.goto(base + '#room?c=K7MQ3P'); await q.waitForTimeout(1200);
  ok(/^0:0\d$/.test(await q.locator('.reveal-clock').textContent()), 'a running timer counts down: ' + await q.locator('.reveal-clock').textContent());
  await q.waitForTimeout(2600);
  ok(await q.locator('.room-reveal').count() === 1, 'and the reveal opens when it reaches zero');

  // A gridlocked room on a phone: no card has a majority big enough.
  const G = { ...T, cards: { 'gas-tax-15c': 14, 'alcohol-tax': 9 } };
  const g = await mk({ ...devices['iPhone 13'] }, G, false);
  await g.goto(base + '#room?c=K7MQ3P'); await g.waitForTimeout(1500);
  ok(await g.locator('#reveal button', { hasText: '10 min' }).count() === 0, 'members (not the host) get no timer, just the reveal');
  await g.locator('#reveal button', { hasText: 'Show the reveal' }).click(); await g.waitForTimeout(400);
  ok(await g.locator('.rr-name').textContent() === 'Gridlocked Congress' && /Failed to pass a budget!/.test(await g.locator('.rr-line').textContent()), 'a room whose plan falls short: Gridlocked Congress, “Failed to pass a budget!”');
  ok(/56% of this room put it in their plan; 44% left it out/.test(await g.locator('.rr-split').textContent()), 'the split card: 14 of 25 (56%)');
  ok(await g.evaluate(() => document.querySelector('.room-reveal').scrollWidth <= innerWidth), 'phone: the reveal has no sideways scroll');
  await g.screenshot({ path: __OUT + '/room-reveal-phone.png', fullPage: false });
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
