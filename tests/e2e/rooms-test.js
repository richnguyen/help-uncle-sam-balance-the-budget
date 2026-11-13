const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['', 'm', 'duel', 'dock']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const winByHand = require('./winbyhand');
// Rooms against a stand-in database (nothing reaches Supabase).
const { chromium } = require('playwright');
const base = 'http://localhost:5173/';
const out = __OUT + '/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const db = { rooms: {}, members: {}, log: [] }; // members[code] = { uid: {cards, stars} }
  const mk = async (vp, uid) => {
    const ctx = await b.newContext({ viewport: vp });
    await ctx.addInitScript(() => { if (!localStorage.getItem('ftd:journey')) { localStorage.setItem('ftd:backend', '"on"'); localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, settings: { narration: false, freeRoam: false, haptics: false } })); } });
    await ctx.route('**/*.supabase.co/**', async (route) => {
      const r = route.request(); const u = new URL(r.url()); const m = r.method(); const body = r.postData() ? JSON.parse(r.postData()) : null;
      const q = Object.fromEntries(u.searchParams);
      const eq = (k) => (q[k] ?? '').replace(/^eq\./, '');
      if (u.pathname.endsWith('/auth/v1/signup')) return route.fulfill({ json: { access_token: uid, refresh_token: uid, expires_in: 3600, user: { id: uid } } });
      if (u.pathname.endsWith('/rpc/get_room')) { const c = body.room_code; const rm = db.rooms[c]; return route.fulfill({ json: rm ? { ...rm, members: Object.keys(db.members[c] ?? {}).length, plans: Object.values(db.members[c] ?? {}).filter((x) => x.cards).length, mine: rm.by === uid } : null }); }
      if (u.pathname.endsWith('/rpc/room_totals')) {
        const c = body.room_code; if (!db.rooms[c]) return route.fulfill({ json: null });
        const ms = Object.values(db.members[c] ?? {}); const ps = ms.filter((x) => x.cards); const cards = {};
        for (const p of ps) for (const x of p.cards) cards[x] = (cards[x] ?? 0) + 1;
        return route.fulfill({ json: { members: ms.length, plans: ps.length, cards, stars: {}, done: { 'level-5': ps.length }, votes: ms.length >= 3 ? { voters: 0, options: {}, issues: {} } : null } });
      }
      if (u.pathname.includes('/rpc/')) return route.fulfill({ json: u.pathname.includes('ballot') ? { voters: 0, options: {}, plans: {}, issues: {} } : u.pathname.includes('player') ? { players: 0, done: {}, stars: {}, firstTry: {}, medals: {} } : [] });
      db.log.push(`${uid.slice(0, 2)} ${m} ${u.pathname.split('/').pop()}${u.search}`);
      if (u.pathname.endsWith('/rooms') && m === 'POST') { const c = 'K7MQ3P'; db.rooms[c] = { code: c, name: body.name, level: body.level, created_at: new Date().toISOString(), by: uid }; return route.fulfill({ status: 201, json: [{ code: c }] }); }
      if (u.pathname.endsWith('/room_members')) {
        const c = eq('room') || body?.room;
        if (m === 'POST') { (db.members[c] ??= {})[uid] ??= { cards: null, stars: null }; return route.fulfill({ status: 201, body: '' }); }
        if (m === 'PATCH') { db.members[c][uid] = { cards: body.cards, stars: body.stars }; return route.fulfill({ status: 204, body: '' }); }
        if (m === 'DELETE') { delete db.members[c][uid]; return route.fulfill({ status: 204, body: '' }); }
        const mine = db.members[c]?.[uid]; return route.fulfill({ json: mine ? [{ room: c, joined_at: '', ...mine }] : [] });
      }
      return route.fulfill({ status: 201, body: '' });
    });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept()); return p;
  };
  // A teacher starts a room on level 5.
  const T = await mk({ width: 1280, height: 900 }, 'teacher-0000');
  await T.goto(base + '#rooms'); await T.waitForTimeout(800);
  await T.fill('#room-name', 'Ms. Lee’s 3rd period'); await T.selectOption('#room-level', '5');
  await T.getByRole('button', { name: 'Start the room' }).click(); await T.waitForTimeout(1500);
  console.log('teacher on:', await T.evaluate(() => location.hash), '| title:', await T.locator('h1').textContent(), '| code:', await T.locator('.room-code').textContent());
  const share = await T.locator('#invite .social-link[data-net="whatsapp"]').getAttribute('href');
  const link = decodeURIComponent(share.replace('https://wa.me/?text=', '')).split(' ').pop();
  console.log('room link:', link.replace('http://localhost:5173/', '/'));
  // A student opens the link on a phone, joins, and plays level 5 for the room (locked for them otherwise).
  const S = await mk({ width: 390, height: 844 }, 'student-1111');
  await S.goto(link); await S.waitForTimeout(1500);
  console.log('student on:', await S.evaluate(() => location.hash), '| sam:', (await S.locator('.room-join .small').first().textContent()).slice(0, 60));
  await S.getByRole('button', { name: 'Join this room' }).click(); await S.waitForTimeout(1200);
  await S.getByRole('link', { name: /Play Mission 1\.9 for the room/ }).click(); await S.waitForTimeout(1500);
  console.log('student desk:', await S.evaluate(() => location.hash), '| banner:', (await S.locator('.challenge-banner').first().textContent()).slice(0, 80));
  await winByHand(S); await S.waitForTimeout(2000);
  await S.keyboard.press('Escape'); await S.waitForTimeout(300);
  console.log('student banner after goal:', (await S.locator('.challenge-banner').first().textContent()).slice(0, 70));
  // The teacher's room page now shows the plan.
  await T.reload(); await T.waitForTimeout(1800);
  console.log('teacher sees:', (await T.locator('.peoples-board .sb-big').textContent()), '| cards listed:', await T.locator('#cards .rrow').count(), '|', (await T.locator('#progress .small.muted').textContent()));
  await T.screenshot({ path: out + 'room-teacher.png', fullPage: true });
  await S.goto(base + '#room?c=K7MQ3P'); await S.waitForTimeout(1200);
  console.log('student overflow:', await S.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  await S.screenshot({ path: out + 'room-student.png', fullPage: true });
  await S.getByRole('button', { name: 'Leave the room' }).click(); await S.waitForTimeout(800);
  console.log('after leaving:', await S.locator('.room-join .btn-primary').textContent());
  await T.getByRole('button', { name: 'Close the room' }).click(); await T.waitForTimeout(1200);
  console.log('teacher after closing:', await T.evaluate(() => location.hash));
  console.log('writes:', db.log.join(' | '));
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
