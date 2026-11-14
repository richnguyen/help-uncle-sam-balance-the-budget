// The Daily Dollar's share loop: each call and the final score are counted anonymously (only a
// puzzle, a call and a result); the crowd's numbers come back as "61% of players got this one" and
// a summary; the share text carries a streak and a spoiler-free crowd line; the shared link goes
// through a preview card for its right/wrong pattern and carries the sharer's result, so a friend
// sees both results side by side. Supabase is a stand-in; nothing reaches the real project.
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const base = 'http://localhost:5173/';
const pad = (n) => String(n).padStart(2, '0');
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const now = new Date(), yday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const n = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(2026, 10, 6)) / 86400000) + 1;
  const sent = [];
  const STATS = { puzzle: n, calls: [{ call: 1, right: 81, wrong: 19 }, { call: 2, right: 60, wrong: 40 }, { call: 3, right: 55, wrong: 45 }, { call: 4, right: 31, wrong: 69 }, { call: 5, right: 70, wrong: 30 }], scores: { 2: 10, 3: 30, 4: 40, 5: 20 }, players: 100 };
  const mk = async (extra = {}, backend = true) => {
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    await ctx.addInitScript(([x, be]) => {
      window.__plays = [];
      if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1');
      localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, done: ['level-1'], settings: { narration: false, voice: 'off', sounds: false, haptics: false } }));
      if (be) localStorage.setItem('ftd:backend', JSON.stringify('on'));
      for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v);
    }, [extra, backend]);
    await ctx.route(/supabase\.co\//, async (route) => {
      const u = route.request().url();
      if (/rpc\/count_daily/.test(u)) { sent.push(JSON.parse(route.request().postData())); return route.fulfill({ status: 204, body: '' }); }
      if (/rpc\/daily_stats/.test(u)) return route.fulfill({ json: STATS });
      return route.fulfill({ status: 200, json: {} });
    });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    return p;
  };
  const playAll = async (p, crowd = true) => {
    for (let i = 0; i < 5; i++) {
      await p.locator('.daily-btn').first().click(); await p.waitForTimeout(650);
      if (i === 0 && crowd) { const c = await p.locator('.daily-crowd').textContent().catch(() => ''); ok(/^81% of players got this one\.$/.test(c.trim()), 'after a call: how many players got it right: ' + c.trim()); }
      await p.locator('.daily-actions .btn-primary').click(); await p.waitForTimeout(250);
    }
    await p.waitForTimeout(700);
  };

  // 1. Playing today's puzzle (with yesterday played, and a first name saved).
  const p = await mk({ 'ftd:daily': JSON.stringify({ [key(yday)]: [true, true, true, false, true] }), 'ftd:name': JSON.stringify('Ruth') });
  await p.goto(base + '#daily'); await p.waitForTimeout(1200);
  await playAll(p);
  ok(sent.length === 6 && sent.every((x) => Object.keys(x).sort().join() === 'p_call,p_puzzle,p_result' && x.p_puzzle === n) && sent.slice(0, 5).map((x) => x.p_call).join() === '1,2,3,4,5' && sent[5].p_call === 0, 'what is sent: only the puzzle, the call and the result, once per call, then the score: ' + JSON.stringify(sent.map((x) => `${x.p_call}:${x.p_result}`)));
  const mine = await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('ftd:daily'))).at(-1));
  const bits = mine.map((x) => (x ? '1' : '0')).join(''), score = mine.filter(Boolean).length;
  ok(sent[5].p_result === score && sent.slice(0, 5).every((x, i) => x.p_result === (mine[i] ? 1 : 0)), 'the counts match the calls made');
  const sum = (await p.locator('.daily-crowd-sum').textContent().catch(() => '')).trim();
  ok(/^Today so far: 100 players, 3\.7 of 5 on average; 20% got all five\. The hardest was call 4 \(31% right\)\.$/.test(sum), 'the result screen sums up today: ' + sum);
  const x = decodeURIComponent((await p.locator('.social-link[data-net="x"]').getAttribute('href')));
  const text = x.match(/text=([\s\S]*?)&url=/)[1], url = x.split('&url=')[1];
  ok(new RegExp(`^The Daily Dollar #${n} · ${score}/5\\n[🟦⬜]{5}\\n🔥 2 days in a row\\nCall 4 tripped up 69% of players today\\.\\nHigher or lower, on real federal numbers\\.$`, 'u').test(text), 'the share text: score, grid, the streak and a spoiler-free crowd line:\n' + text);
  ok(url === `${base}p/daily-${bits}/?daily&dn=${n}&vs=${bits}&by=Ruth&s=x`, 'the shared link goes through the card for this pattern and carries the result: ' + url.replace(base, '/'));
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: no sideways scroll');
  await p.locator('.daily-done').screenshot({ path: __OUT + '/daily-done.png' });

  // 2. A friend opens the link (through the preview page) and plays the same puzzle.
  const q = await mk({}, true);
  const preview = `${base}p/daily-11011/index.html?daily&dn=${n}&vs=11011&by=Ruth&s=x`;
  await q.goto(preview); await q.waitForTimeout(1500);
  ok(/#daily\?dn=\d+&vs=11011&by=Ruth$/.test(q.url()) && !/\/p\//.test(q.url()), 'the preview page forwards to the game with the result: ' + q.url().replace(base, '/'));
  ok(/Ruth got 4 of 5 on today’s puzzle\. Your turn\./.test(await q.locator('.daily-friend').textContent()), 'before playing: the friend’s score, not their calls');
  await playAll(q);
  const vs = (await q.locator('.daily-vs-friend').innerText()).replace(/\s+/g, ' ');
  ok(/You \d\/5 [🟦⬜]{5} Ruth 4\/5 🟦🟦⬜🟦🟦/u.test(vs) && /(A tie|more than Ruth|Ruth got \d more)/.test(vs), 'after playing: both results side by side: ' + vs);
  await q.locator('.daily-vs-friend').screenshot({ path: __OUT + '/daily-friend.png' });
  // A friend's result from another day says so instead of comparing.
  const r = await mk({}, false);
  await r.goto(`${base}?daily&dn=${n - 1}&vs=10101&by=Ruth`); await r.waitForTimeout(1200);
  ok(new RegExp(`Ruth’s result was for puzzle #${n - 1}; today’s is #${n}`).test(await r.locator('.daily-friend').textContent()), 'a result from another day isn’t compared: it says which puzzle it was');
  // Without the shared database (the claude.ai copy): no crowd lines, the game still works.
  await playAll(r, false);
  ok(await r.locator('.daily-crowd-sum').count() === 0 && !(await r.locator('.social-link[data-net="x"]').getAttribute('href')).includes('tripped'), 'without the shared database: no crowd lines (and none in the share text)');

  // 3. The 32 preview cards and pages.
  const missing = await p.evaluate(async () => { const out = []; for (let i = 0; i < 32; i++) { const b = i.toString(2).padStart(5, '0'); const h = await fetch(`/p/daily-${b}/index.html`); const t = await h.text(); const im = await fetch(`/p/img/daily-${b}.jpg`); if (!h.ok || !t.includes(`p/img/daily-${b}.jpg`) || !t.includes('noindex') || !im.ok) out.push(b); } return out; });
  ok(!missing.length, 'a preview card and page for each of the 32 patterns' + (missing.length ? ': ' + missing.join(' ') : ''));
  const t11011 = await p.evaluate(async () => (await (await fetch('/p/daily-11011/index.html')).text()).match(/<title>(.*?)<\/title>/)[1]);
  ok(/^The Daily Dollar: 4 of 5\. Your turn\./.test(t11011), 'its title gives the score only: ' + t11011);

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
