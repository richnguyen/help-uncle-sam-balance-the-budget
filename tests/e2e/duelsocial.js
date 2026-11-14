// Duels, the social parts: the invite as a sealed briefing folder with the plan's rating; the
// three rounds revealed one tap at a time like a boxing scorecard (10–9 a round, then the
// verdict), remembered once seen; the 9:16 scorecard and its 1080×1920 image; and the board for
// everyone on one link, against a stand-in database (nothing reaches Supabase).
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const fs = require('fs');
const { chromium, devices } = require('playwright');
const base = 'http://localhost:5173/';
(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const entered = [];
  const mk = async (name, board) => {
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    await ctx.addInitScript(([n, on]) => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); if (on) localStorage.setItem('ftd:backend', '"on"'); if (n) localStorage.setItem('ftd:name', JSON.stringify(n)); localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, settings: { narration: false, freeRoam: false, haptics: false, voice: 'off', sounds: false } })); }, [name, !!board]);
    if (board) await ctx.route('**/*.supabase.co/**', async (route) => {
      const u = new URL(route.request().url()); const body = route.request().postData() ? JSON.parse(route.request().postData()) : null;
      if (u.pathname.endsWith('/auth/v1/signup')) return route.fulfill({ json: { access_token: 'x', refresh_token: 'x', expires_in: 3600, user: { id: 'sam-0000' } } });
      if (u.pathname.endsWith('/rpc/enter_duel')) { entered.push(body); return route.fulfill({ status: 204, body: '' }); }
      if (u.pathname.endsWith('/rpc/duel_board')) return route.fulfill({ json: board });
      if (u.pathname.includes('/rpc/')) return route.fulfill({ json: u.pathname.includes('ballot') ? { voters: 0, options: {}, plans: {}, issues: {} } : u.pathname.includes('player') ? { players: 0, done: {}, stars: {}, firstTry: {}, medals: {} } : [] });
      return route.fulfill({ status: 201, body: '' });
    });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p;
  };
  const Z = { revenues: 0, socialSecurity: 0, medicare: 0, medicaid: 0, otherMandatory: 0, defense: 0, nondefense: 0 };
  const host = { ids: ['income-tax-rates-1pt', 'ss-tax-earnings-over-250k', 'cut-defense-budget', 'vat-5pct'], lv: { ...Z, revenues: 4 }, gradual: true };
  const guest = { ids: ['limit-itemized-15pct', 'medicaid-per-enrollee-caps', 'cut-defense-budget', 'vat-5pct', 'medicare-advantage-benchmarks'], lv: Z, gradual: true };
  const third = { ids: ['vat-5pct', 'carbon-tax-25', 'cut-defense-budget'], lv: Z, gradual: true };

  // 1. The invite: a sealed folder with the rating, and the message that says so.
  const p = await mk('Sam');
  await p.goto(base + '#menu'); await p.waitForTimeout(600);
  const L = await p.evaluate(async ([h, g]) => {
    const D = await import('/src/game/duel.ts');
    const d = { id: 'k7mq3pab', host: h, hostName: 'Ruth', guest: g, guestName: 'Sam' };
    return { invite: D.inviteHash(d), reply: D.resultHash(d), text: D.sealedText('Ruth', h), rating: D.sealedRating(h), url: D.inviteLink(d), args: D.boardPlanArgs(g) };
  }, [host, guest]);
  ok(new RegExp(`^🔒 Ruth sealed a (Balanced Budget plan|budget plan) \\(Rating: ${L.rating[0].toUpperCase() + L.rating.slice(1)}\\)\\. Build yours to unseal theirs and face off in 3 rounds: Debt, Economy, Balance 👉$`).test(L.text) && L.url.includes(`/p/duel-${L.rating}/?duel=k7mq3pab`), 'the invite message and its preview: ' + L.text);
  ok(fs.existsSync(require('path').join(__dirname, `../../public/p/duel-${L.rating}/index.html`)) && fs.readFileSync(require('path').join(__dirname, `../../public/p/duel-${L.rating}/index.html`), 'utf8').includes(`Rating: ${L.rating[0].toUpperCase() + L.rating.slice(1)}`), 'the preview page shows the sealed folder’s rating');
  const g = await mk('');
  await g.goto(base + L.invite); await g.waitForTimeout(900);
  const folder = await g.locator('.duel-folder').textContent();
  ok(/Ruth sealed a (Balanced Budget plan|budget plan)/.test(folder) && new RegExp(`Rating: ${L.rating}`, 'i').test(folder) && /Build yours to unseal theirs/.test(folder), 'the invite page: a sealed briefing folder with its rating');

  // 2. The reveal, one round at a time.
  await p.goto(base + L.reply); await p.waitForTimeout(900);
  ok(await p.locator('.duel-round').count() === 0 && await p.locator('.duel-round-sealed').count() === 3 && await p.locator('.duel-score').count() === 0, 'the comparison opens sealed: three rounds to reveal, no verdict yet');
  const ptsBefore = await p.locator('.duel-pts li').allTextContents();
  ok(ptsBefore.every((t) => /\?$/.test(t)), 'the scorecard strip shows ? for every round');
  await p.getByRole('button', { name: 'Reveal Round 1: The debt' }).click(); await p.waitForTimeout(500);
  ok(await p.locator('.duel-round').count() === 1 && /^R1(10–9|9–10|10–10)$/.test((await p.locator('.duel-pts li').first().textContent()).trim()) && await p.locator('.duel-score').count() === 0, 'Round 1 revealed, scored like boxing: ' + (await p.locator('.duel-pts li').first().textContent()));
  await p.getByRole('button', { name: 'Reveal Round 2: The economy' }).click(); await p.waitForTimeout(400);
  await p.getByRole('button', { name: 'Reveal Round 3: The balance' }).click(); await p.waitForTimeout(400);
  if (await p.getByRole('button', { name: /Reveal Tie-breaker/ }).count()) { await p.getByRole('button', { name: /Reveal Tie-breaker/ }).click(); await p.waitForTimeout(400); }
  const verdict = await p.locator('.duel-verdict').textContent();
  const total = (await p.locator('.duel-pts-total').textContent()).trim();
  ok(['Knockout', 'Split decision', 'Majority decision', 'Decision on the tie-breaker', 'Draw'].includes(verdict) && /^Total(2[789]|30)–(2[789]|30)$/.test(total), `after the last round, the verdict and the total: ${verdict}, ${total}`);
  ok(/^(Your plan wins|Ruth’s plan wins|Tied)/.test(await p.locator('.duel-score-num').textContent()), 'and who won: ' + await p.locator('.duel-score-num').textContent());
  // The 9:16 scorecard.
  const card = await p.locator('.duel-card').boundingBox();
  ok(card && Math.abs(card.width / card.height - 9 / 16) < 0.02 && card.height <= 664, `the scorecard is 9:16 and fits a phone screen (${Math.round(card.width)}×${Math.round(card.height)})`);
  const sct = await p.locator('.duel-card').innerText();
  ok(/Budget duel · official scorecard/i.test(sct) && /SAM/i.test(sct) && /RUTH/i.test(sct) && (sct.match(/Round \d/gi) ?? []).length === 3 && sct.includes(verdict.toUpperCase()), 'it names both sides, the three rounds and the verdict');
  await p.locator('.duel-card').screenshot({ path: __OUT + '/duel-scorecard.png' });
  const img = await p.evaluate(async () => {
    const btn = [...document.querySelectorAll('.duel-card-wrap button')].find((x) => x.textContent === 'Save image');
    let blob = null;
    const orig = URL.createObjectURL; URL.createObjectURL = (b) => { blob = b; return orig.call(URL, b); };
    HTMLAnchorElement.prototype.click = function () {};
    btn.click(); for (let i = 0; i < 40 && !blob; i++) await new Promise((r) => setTimeout(r, 100));
    if (!blob) return null; const bm = await createImageBitmap(blob); return { w: bm.width, h: bm.height };
  });
  ok(img && img.w === 1080 && img.h === 1920, 'and a 1080×1920 image for Stories: ' + JSON.stringify(img));
  await p.reload(); await p.waitForTimeout(900);
  ok(await p.locator('.duel-round-sealed').count() === 0 && await p.locator('.duel-score').count() === 1, 'seen once, the comparison opens revealed');

  // 3. Everyone on the link: Sam enters the board, and sees every plan against every other.
  const enc = (pl) => p.evaluate(async (x) => (await import('/src/game/duel.ts')).boardPlanArgs(x), pl);
  const H = await enc(host), T3 = await enc(third);
  const board = [{ host: true, name: 'Ruth', ...H, mine: false }, { host: false, name: 'Sam', ...L.args, mine: true }, { host: false, name: null, ...T3, mine: false }, { host: false, name: 'Lee', ...H, mine: false }];
  const s = await mk('Sam', board);
  await s.goto(base + L.reply); await s.waitForTimeout(1500);
  for (let i = 0; i < 40 && !entered.length; i++) await s.waitForTimeout(200);
  await s.waitForTimeout(300);
  ok(entered.length === 1 && entered[0].p_duel === 'k7mq3pab' && entered[0].h_name === 'Ruth' && entered[0].p_name === 'Sam' && entered[0].p_p === L.args.p && entered[0].h_p === H.p, 'Sam’s plan joins the link’s board (with the host’s plan from the link)');
  const rows = await s.locator('#duel-board .duel-table li').allInnerTexts();
  console.log(rows.map((r) => r.replace(/\s+/g, ' ')).join('\n'));
  ok(rows.length === 4 && rows.some((r) => /Your plan/.test(r)) && rows.some((r) => /Ruth’s plan[\s\S]*set the challenge/.test(r)) && rows.some((r) => /A friend’s plan/.test(r)) && rows.every((r) => /\d–\d/.test(r)), 'the board: every plan on the link, yours marked, the host’s marked as the challenge, with records');
  const recs = await s.locator('#duel-board .dt-rec').allTextContents();
  const pts = recs.map((r) => { const [w, l, t = 0] = r.split('–').map(Number); return w + t / 2; });
  ok(pts.every((x, i) => i === 0 || pts[i - 1] >= x) && recs.every((r) => r.split('–').map(Number).reduce((a, c) => a + c, 0) === 3), 'ordered by points; each plan played the other three: ' + recs.join(', '));
  await s.reload(); await s.waitForTimeout(1200);
  ok(entered.length === 1, 'entered once per plan, not on every visit');
  await s.locator('#duel-board').screenshot({ path: __OUT + '/duel-board.png' });
  ok(await s.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: no sideways scroll');
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
