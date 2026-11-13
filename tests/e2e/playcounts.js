// The playtest's counts: what the game counts (desk opened / started / finished, the ripple round's
// time, poll views and answers, free roam, jump-ahead), once a day where it should be, with only a
// metric and a key; and the stats page's "How people play" section, against a mocked database
// (every request to Supabase is intercepted, so nothing reaches the live database).
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['', 'm', 'duel', 'dock']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const OUT = __OUT + '/';
(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const J = (extra = {}) => JSON.stringify({ v: 2, done: ['level-1'], settings: { freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false }, ...extra });
  const ctxFor = async (journey) => {
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    await ctx.addInitScript((j) => { window.__plays = []; if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem('ftd:journey', j); }, journey);
    return ctx;
  };
  const plays = (p) => p.evaluate(() => window.__plays.map((x) => x.join(':')));

  // 1. The desk: opened, first card, goal met; a reload the same day doesn't count "opened" again.
  const c1 = await ctxFor(J());
  const p = await c1.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:5173/#level-5'); await p.waitForSelector('.pcard'); await p.waitForTimeout(900);
  await p.evaluate(() => document.querySelector('.pcard .pcard-add').click()); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelectorAll('.pcard .pcard-add:not(.on)').forEach((x) => x.click())); await p.waitForTimeout(800);
  const d1 = await plays(p);
  ok(['desk_open:level-5', 'desk_play:level-5', 'desk_done:level-5'].every((x) => d1.includes(x)) && d1.filter((x) => x === 'desk_play:level-5').length === 1, 'the desk counts opened, first card and goal met, once each: ' + d1.join(', '));
  await p.reload(); await p.waitForSelector('.pcard'); await p.waitForTimeout(700);
  ok(!(await plays(p)).includes('desk_open:level-5'), 'opening the same desk again today isn’t counted twice');

  // 2. Mission 1.6's ripple round: its time, in a bucket.
  const c2 = await ctxFor(J({ steps: { 'level-economy': [0] } }));
  const q = await c2.newPage(); q.on('pageerror', (e) => errs.push(e.message));
  await q.goto('http://localhost:5173/#level-economy'); await q.waitForTimeout(1000);
  await q.evaluate(() => document.querySelectorAll('.steptrack-seg')[1]?.click()); await q.waitForTimeout(500);
  await q.evaluate(() => document.querySelector('.game-round .quiz-choice')?.click()); await q.waitForTimeout(300);
  await q.evaluate(() => document.querySelector('.game-round .quiz-choice:not([disabled])')?.click()); await q.waitForTimeout(300);
  await q.evaluate(() => [...document.querySelectorAll('button')].find((x) => /^Next round/.test(x.textContent.trim()))?.click()); await q.waitForTimeout(400);
  await q.evaluate(() => [...document.querySelectorAll('.game-round button')].find((x) => /^Check/.test(x.textContent.trim()))?.click()); await q.waitForTimeout(400);
  const rt = (await plays(q)).filter((x) => x.startsWith('ripple_time:'));
  ok(rt.length === 1 && /^ripple_time:(lt15|15-30|30-60|60-120|gt120)$/.test(rt[0]), 'the ripple round’s time is counted in a bucket: ' + rt.join());

  // 3. The feed's polls: seen (once a day) and each first answer.
  const c3 = await ctxFor(J());
  const f = await c3.newPage(); f.on('pageerror', (e) => errs.push(e.message));
  await f.goto('http://localhost:5173/#menu'); await f.waitForTimeout(1300);
  await f.locator('.feed-filters .feed-pill', { hasText: 'Polls' }).first().click(); await f.waitForTimeout(600);
  await f.evaluate(() => document.querySelector('.feed-row:has(.fc[data-kind="poll"]) .fc-choice')?.click()); await f.waitForTimeout(300);
  await f.evaluate(() => document.querySelector('.feed-row:has(.fc[data-kind="poll"]) .fc-choice')?.click()); await f.waitForTimeout(300);
  const fp = await plays(f);
  ok(fp.filter((x) => x === 'poll_view:feed').length === 1 && fp.filter((x) => x === 'poll_vote:feed').length === 1, 'polls: one view a day, and only a poll’s first answer counts: ' + fp.join(', '));

  // 4. Free roam switched on, from a locked mission.
  const c4 = await ctxFor(JSON.stringify({ v: 2, done: ['level-1'], settings: { freeRoam: false, narration: false, voice: 'off', sounds: false } }));
  const r = await c4.newPage(); r.on('pageerror', (e) => errs.push(e.message));
  await r.goto('http://localhost:5173/#level-7'); await r.waitForTimeout(1000);
  await r.getByRole('button', { name: /free roam/i }).first().click(); await r.waitForTimeout(400);
  ok((await plays(r)).includes('free_roam:on'), 'switching on free roam is counted');

  // 5. The stats page, with the database mocked: the section, the abandonment rate, the CSV.
  const c5 = await ctxFor(J());
  await c5.addInitScript(() => localStorage.setItem('ftd:backend', JSON.stringify('on')));
  const sent = [];
  await c5.route(/supabase\.co\//, async (route) => {
    const u = route.request().url(), body = route.request().postData() || '';
    if (/rpc\/count_play/.test(u)) { sent.push(body); return route.fulfill({ status: 204, body: '' }); }
    if (/rpc\/play_stats/.test(u)) return route.fulfill({ json: { window_days: 30, since: '2026-10-15', totals: { desk_open: { 'level-5': 40, 'level-8': 12 }, desk_play: { 'level-5': 30, 'level-8': 10 }, desk_done: { 'level-5': 21, 'level-8': 4 }, ripple_time: { lt15: 2, '15-30': 5, '30-60': 9, '60-120': 3 }, poll_view: { feed: 50 }, poll_vote: { feed: 20 }, free_roam: { on: 7 }, jump_ahead: { 'level-7': 3 }, quick_start: { 'level-2': 6 }, quick_done: { 'level-2': 5 } }, daily: [{ day: '2026-11-12', metric: 'desk_open', key: 'level-5', n: 40 }, { day: '2026-11-12', metric: 'poll_vote', key: 'feed', n: 20 }] } });
    if (/rpc\/share_stats/.test(u)) return route.fulfill({ json: { window_days: 30, since: '2026-10-15', shares: {}, arrivals: {}, players: {}, players_all: 0, daily: [], funnel: null } });
    if (/rpc\/reminder_stats/.test(u)) return route.fulfill({ json: { devices: 0, sent: 0 } });
    return route.fulfill({ status: 200, json: {} });
  });
  const s = await c5.newPage(); s.on('pageerror', (e) => errs.push(e.message));
  await s.goto('http://localhost:5173/#stats'); await s.waitForTimeout(1500);

  const sec = s.locator('#play');
  const txt = (await sec.count()) ? await sec.innerText() : '';
  ok(/How people play/i.test(txt) && /\b1\.9\b/.test(txt) && /30%/.test(txt) && /60%/.test(txt), 'the stats page shows desk abandonment (1.9: 30%, 2.7: 60% of those who started)');
  ok(/Poll answers\s*20/.test(txt) && /0\.4 per view/.test(txt) && /Free roam turned on\s*7/.test(txt) && /30–60 s\s*9/.test(txt), 'polls, free roam and the ripple round’s times are listed');
  const href = await sec.locator('a[download]').getAttribute('href');
  const csv = decodeURIComponent(href.replace(/^data:text\/csv;charset=utf-8,/, ''));
  ok(csv.split('\n')[0] === 'day,metric,key,count' && csv.includes('2026-11-12,desk_open,level-5,40'), 'the daily counts download as CSV');
  await sec.screenshot({ path: OUT + 'playstats.png' });
  ok(await s.evaluate(() => [...document.querySelectorAll('#play .table-wrap')].every((t) => t.scrollWidth <= t.clientWidth + 1)), 'its tables fit a phone without scrolling sideways');
  // The desk, with the (mocked) backend on: what goes out is only a metric and a key.
  await s.goto('http://localhost:5173/#level-8'); await s.waitForSelector('.pcard'); await s.waitForTimeout(800);
  ok(sent.length >= 1 && sent.every((x) => { const o = JSON.parse(x); return Object.keys(o).sort().join() === 'p_key,p_metric'; }), 'each count sent holds only a metric and a key: ' + sent.slice(0, 2).join(' '));
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
})();
