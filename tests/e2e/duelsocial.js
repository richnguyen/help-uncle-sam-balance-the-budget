// The Sealed Showdown, the parts that make it travel: the invite as a classified dossier (rating,
// cards played, where the debt lands, the moves blacked out) with a pre-drawn preview that matches;
// the fog of war on the desk (a dotted line for the sealed debt figure, only the band of its
// economy rating, one clue for the balance round, and Uncle Sam's needling); the three rounds
// unsealed one tap at a time, each with its picture and the referee's stamp; "Where you split" and
// the moves, unsealed; the 9:16 scorecard; and the gauntlet: one board per link, a crown on the
// plan on top, sealed to anyone who hasn't locked in a plan (a stand-in database: nothing reaches
// Supabase).
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const fs = require('fs'), path = require('path');
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
  // Ruth leans on taxes; Sam on spending cuts; a third plan for the board.
  const host = { ids: ['income-tax-rates-1pt', 'ss-tax-earnings-over-250k', 'cut-defense-budget', 'vat-5pct', 'carbon-tax-25', 'limit-itemized-15pct'], lv: { ...Z, revenues: 8, medicare: -6 }, gradual: true };
  const guest = { ids: ['medicaid-per-enrollee-caps', 'cut-defense-budget', 'medicare-advantage-benchmarks', 'raise-full-retirement-age-70', 'chained-cpi', 'cut-transport-education-grants'], lv: { ...Z, nondefense: -30, defense: -20, medicaid: -15, otherMandatory: -15 }, gradual: true };
  const third = { ids: ['vat-5pct', 'carbon-tax-25', 'cut-defense-budget'], lv: { ...Z, revenues: 6, nondefense: -10 }, gradual: true };

  // 1. The invite: a classified dossier, and the message that carries it.
  const p = await mk('Sam');
  await p.goto(base + '#menu'); await p.waitForTimeout(600);
  const L = await p.evaluate(async ([h, g]) => {
    const D = await import('/src/game/duel.ts'); const C = await import('/src/game/ChallengeParts.tsx');
    const d = { id: 'k7mq3pab', host: h, hostName: 'Ruth', guest: g, guestName: 'Sam' };
    return { invite: D.inviteHash(d), reply: D.resultHash(d), text: D.sealedText('Ruth', h), dos: D.dossier(h), pid: D.dossierId(h), url: D.inviteLink(d), args: D.boardPlanArgs(g), fog: D.fog(h), div: D.divergence(g, h, 'Your plan', 'Ruth’s plan'), names: h.ids.map(C.cardName), buckets: [D.cardBucket(2), D.cardBucket(7), D.cardBucket(15), D.debtBucket(61), D.debtBucket(83), D.debtBucket(97)] };
  }, [host, guest]);
  const R = L.dos.rating[0].toUpperCase() + L.dos.rating.slice(1);
  console.log(L.text);
  ok(new RegExp(`^🔒 SEALED BUDGET PLAN · CLASSIFIED\\. Ruth balanced Uncle Sam’s budget and sealed the plan\\. Rating: ${R} · 6 CBO options · debt at ${L.dos.debt}% of GDP by FY\\d{4} · moves: █+ █+ █+\\. Build yours to unseal Ruth’s moves and face off across 3 rounds 👉$`).test(L.text), 'the invite message: sealed, classified, the rating, the cards, the debt figure, the moves blacked out');
  ok(!L.names.some((n) => L.text.includes(n)), 'and not one of the moves');
  ok(L.url.includes(`/p/${L.pid}/?duel=k7mq3pab`) && /^duel-(gentle|moderate|steep)-c6-d(70|75|80|85|90)$/.test(L.pid) && L.buckets.join() === '3,7,12,70,85,90', 'the link goes through the dossier that matches the plan: ' + L.pid);
  const pre = fs.readFileSync(path.join(__dirname, `../../public/p/${L.pid}/index.html`), 'utf8');
  ok(pre.includes(`Rating: ${R}`) && /6 CBO options/.test(pre) && pre.includes(`p/img/${L.pid}.jpg`) && fs.existsSync(path.join(__dirname, `../../public/p/img/${L.pid}.jpg`)), 'its preview page: the rating, 6 CBO options, the debt, and a matching image');
  ok(fs.readdirSync(path.join(__dirname, '../../public/p')).filter((d) => /^duel-(gentle|moderate|steep)-c\d+-d\d+$/.test(d)).length === 150, '150 pre-drawn dossiers: every rating × cards × debt');
  const g = await mk('');
  await g.goto(base + L.invite); await g.waitForTimeout(900);
  const dos = await g.locator('.dossier').innerText();
  ok(/Ruth’s balanced budget/i.test(dos) && /Classified/i.test(dos) && new RegExp(`Plan rating\\s*${R}`, 'i').test(dos) && /Cards played\s*6 CBO options/i.test(dos) && new RegExp(`Debt by FY\\d{4}\\s*${L.dos.debt}% of GDP`, 'i').test(dos), 'the invite page: the dossier with the three facts');
  ok(await g.locator('.dossier-moves li').count() === 8 && !L.names.some((n) => dos.includes(n)) && /Build your own plan to unseal Ruth’s moves/.test(dos), 'the moves are black bars (6 cards + 2 across the board), with no names');
  await g.locator('.dossier').screenshot({ path: __OUT + '/showdown-dossier.png' });

  // 2. The fog of war: building against the sealed benchmark.
  await g.locator('.actionbar').getByRole('button', { name: 'Build your plan to unseal it' }).tap(); await g.waitForTimeout(1200);
  const fog = await g.locator('#fog').innerText();
  ok(new RegExp(`Sealed ${Math.round(L.fog.debt * 100)}%`).test(fog) && /Round 1 · Debt/i.test(fog) && /Not started/.test(fog), 'the desk shows the sealed debt figure as a dotted line: Sealed ' + Math.round(L.fog.debt * 100) + '%');
  ok(await g.locator('#fog .fog-econ .z[data-ghost]').count() === 1 && new RegExp(`somewhere in ${R}`).test(fog) && !/\d\.\d+% of GDP/.test(fog.split(/Round 2/i)[1].split(/Round 3/i)[0]), 'the economy round shows only the band, never the number');
  ok(fog.includes(L.fog.clue) && /In the fog/.test(fog) && /touched taxes, Medicare and defense, but left Social Security, Medicaid and other programs alone/.test(L.fog.clue) && !/\d+% taxes/.test(fog), 'the balance round stays in the fog, with one clue: ' + L.fog.clue);
  ok(await g.locator('.hud-board .fog-ghost').count() === 1 && await g.locator('.hud-board .econmeter .z[data-ghost]').count() === 1, 'and the scoreboard carries the ghost: a dotted debt line and the hatched band');
  ok(!L.names.some((n) => fog.includes(n)), 'no move of the sealed plan shows on the desk');
  await g.locator('#fog').screenshot({ path: __OUT + '/showdown-fog.png' });
  await g.locator('.pcard-add:not(.on)').first().evaluate((e) => { e.scrollIntoView({ block: 'center' }); e.click(); }); await g.waitForTimeout(600);
  const taunt = await g.locator('.duel-banner').getAttribute('data-taunt');
  const said = await g.evaluate(async ([h]) => { const D = await import('/src/game/duel.ts'); const d = JSON.parse(Object.entries(localStorage).find(([k]) => k.includes('draft'))?.[1] ?? 'null'); const all = Object.values(d ?? {}); const mine = all.find((x) => x && x.ids) ?? d; return mine && mine.ids ? D.showdownTaunt(mine, h) : null; }, [host]).catch(() => null);
  ok(['bold', 'heat', 'safe', 'lopsided', 'ahead'].includes(taunt) && /Behind|Ahead|Too close to call/.test(await g.locator('#fog .fog-row').first().innerText()), `one card in: Uncle Sam needles the plan (${taunt}${said ? ': ' + said.line : ''}) and Round 1 reads ahead or behind`);

  // 3. The reveal, one round at a time, each with its picture and the referee's stamp.
  await p.goto(base + L.reply); await p.waitForTimeout(900);
  ok(await p.locator('.duel-round').count() === 0 && await p.locator('.duel-round-sealed').count() === 3 && await p.locator('.duel-score').count() === 0 && await p.locator('#where-you-split').count() === 0 && await p.locator('#unsealed').count() === 0, 'the comparison opens sealed: three rounds to reveal, no verdict, no moves yet');
  ok((await p.locator('.duel-pts li').allTextContents()).every((t) => /\?$/.test(t)), 'the scorecard strip shows ? for every round');
  await p.getByRole('button', { name: 'Reveal Round 1: The debt' }).click(); await p.waitForTimeout(1700);
  ok(await p.locator('.duel-round').count() === 1 && /^R1(10–9|9–10|10–10)$/.test((await p.locator('.duel-pts li').first().textContent()).trim()) && await p.locator('.duel-score').count() === 0, 'Round 1 revealed, scored like boxing: ' + (await p.locator('.duel-pts li').first().textContent()));
  ok(await p.locator('.duel-round[data-round="debt"] .face-debt path.face-line').count() === 2 && /^Round 1: (Your plan wins|Ruth’s plan wins|Even)$/.test(await p.locator('.duel-round[data-round="debt"] .duel-stamp').innerText().then((t) => t.replace(/\s+/g, ' ').trim().replace(/^ROUND 1: (.*)$/i, (m, w) => 'Round 1: ' + w[0] + w.slice(1).toLowerCase().replace('ruth', 'Ruth')))), 'the two debt paths side by side, and the stamp: ' + (await p.locator('.duel-round[data-round="debt"] .duel-stamp').innerText()));
  const r1 = await p.locator('.duel-round[data-round="debt"]').boundingBox();
  ok(r1.height <= 664 - 86 - 60, `a round fits a phone screen under the top bar (${Math.round(r1.height)}px)`);
  await p.screenshot({ path: __OUT + '/showdown-round1.png' });
  await p.getByRole('button', { name: 'Reveal Round 2: The economy' }).click(); await p.waitForTimeout(500);
  ok(await p.locator('.duel-round[data-round="economy"] .face-econ .face-mark').count() === 2, 'Round 2: both plans on the gentle / moderate / steep scale');
  await p.getByRole('button', { name: 'Reveal Round 3: The balance' }).click(); await p.waitForTimeout(500);
  ok(await p.locator('.duel-round[data-round="balance"] .face-balance .face-bar').count() === 2 && /Steep|Moderate|Gentle/.test(await p.locator('.face-balance').innerText()), 'Round 3: each plan’s rating and its split against the halfway line');
  if (await p.getByRole('button', { name: /Reveal Tie-breaker/ }).count()) { await p.getByRole('button', { name: /Reveal Tie-breaker/ }).click(); await p.waitForTimeout(400); }
  const verdict = await p.locator('.duel-verdict').textContent();
  const total = (await p.locator('.duel-pts-total').textContent()).trim();
  ok(['Knockout', 'Split decision', 'Majority decision', 'Decision on the tie-breaker', 'Draw'].includes(verdict) && /^Total(2[789]|30)–(2[789]|30)$/.test(total) && /Final decision/i.test(await p.locator('.duel-score').innerText()), `the final decision, with its verdict and the total: ${verdict}, ${total}`);
  ok(/^(Your plan wins|Ruth’s plan wins|Tied)/.test(await p.locator('.duel-score-num').textContent()) && /never people/.test(await p.locator('.duel-score').innerText()), 'and whose plan won: ' + await p.locator('.duel-score-num').textContent());

  // 4. The unsealed autopsy: where the two plans split, then every move.
  const split = await p.locator('#where-you-split').innerText();
  console.log(L.div.lines.join(' | '), '|', L.div.tagline);
  ok(/Where you split/i.test(split) && L.div.lines.every((l) => split.includes(l)) && split.toLowerCase().includes(L.div.tagline.toLowerCase()), 'Where you split: each plan’s lean in a sentence, and the tagline');
  ok(L.div.a.side === 'cuts' && L.div.b.side === 'tax' && L.div.tagline === 'Same goal, opposite paths.' && /relied \d+% on spending cuts \(including “/.test(L.div.lines[0]) && /relied \d+% on tax increases \(including “/.test(L.div.lines[1]), 'a cuts-heavy plan against a tax-heavy one: same goal, opposite paths');
  ok(!L.div.lines[0].includes('Cut the Defense Department') && !L.div.lines[1].includes('Cut the Defense Department'), 'each sentence names a move the other plan didn’t play');
  const sp = await p.evaluate(async ([a, c]) => { const S = await import('/src/game/showdownParts.tsx'); const bm = await createImageBitmap(await S.splitPng(a, c, 'Sam', 'Ruth')); return { w: bm.width, h: bm.height }; }, [guest, host]);
  ok(sp.w === 1080 && sp.h === 1350 && await p.locator('#where-you-split').getByRole('button', { name: 'Share where you split' }).count() === 1, 'it shares as a 1080×1350 image, with the link that pulls more friends in');
  const moves = await p.locator('#unsealed').innerText();
  ok(L.names.every((n) => moves.includes(n)) && /All tax revenue \+8% across the board/.test(moves) && await p.locator('#unsealed .unsealed-moves li[data-shared]').count() === 2, 'the moves, unsealed: every card and across-the-board change, the shared card marked in both');
  await p.locator('#where-you-split').screenshot({ path: __OUT + '/showdown-split.png' });
  // The 9:16 scorecard.
  const card = await p.locator('.duel-card').boundingBox();
  ok(card && Math.abs(card.width / card.height - 9 / 16) < 0.02 && card.height <= 664, `the scorecard is 9:16 and fits a phone screen (${Math.round(card.width)}×${Math.round(card.height)})`);
  const sct = await p.locator('.duel-card').innerText();
  ok(/Sealed Showdown · official scorecard/i.test(sct) && /SAM/i.test(sct) && /RUTH/i.test(sct) && (sct.match(/Round \d/gi) ?? []).length === 3 && sct.includes(verdict.toUpperCase()), 'it names the showdown, both sides, the three rounds and the verdict');
  await p.reload(); await p.waitForTimeout(900);
  ok(await p.locator('.duel-round-sealed').count() === 0 && await p.locator('.duel-score').count() === 1 && await p.locator('#where-you-split').count() === 1, 'seen once, the comparison opens unsealed');

  // 5. The gauntlet: everyone on the link, a crown on the plan on top.
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
  ok(rows.length === 4 && rows.some((r) => /Your plan/.test(r)) && rows.some((r) => /Ruth’s plan[\s\S]*set the challenge/.test(r)) && rows.some((r) => /A friend’s plan/.test(r)) && rows.every((r) => /\d–\d/.test(r)), 'the gauntlet: every plan on the link, yours marked, the host’s marked as the challenge, with records');
  const recs = await s.locator('#duel-board .dt-rec').allTextContents();
  const pts = recs.map((r) => { const [w, l, t = 0] = r.split('–').map(Number); return w + t / 2; });
  ok(pts.every((x, i) => i === 0 || pts[i - 1] >= x) && recs.every((r) => r.split('–').map(Number).reduce((a, c) => a + c, 0) === 3), 'ordered by points; each plan played the other three: ' + recs.join(', '));
  const crown = await s.locator('#duel-board .duel-crown').innerText();
  ok(/(holds the crown|shares the top spot)/.test(crown) && await s.locator('#duel-board .duel-table li[data-top]').count() === 1 && /👑/.test(rows[0]) && await s.locator('#duel-board').getByRole('button', { name: 'Dare the chat' }).count() === 1, 'the plan on top holds the crown, and the link goes back to the chat: ' + crown.replace(/\s+/g, ' '));
  await s.locator('#duel-board').screenshot({ path: __OUT + '/duel-board.png' });
  // A side match: your plan against another plan on the board. Nothing is entered again.
  const side = s.locator('#duel-board .duel-table li', { hasText: 'A friend’s plan' }).getByRole('link', { name: 'See the rounds' });
  ok(await side.count() === 1 && await s.locator('#duel-board .duel-table li[data-mine]').getByRole('link', { name: 'See the rounds' }).count() === 0, 'each other plan on the board has “See the rounds”');
  await side.click(); await s.waitForTimeout(900);
  ok(/vs=1/.test(await s.evaluate(() => location.hash)) && /Your plan vs\. Your friend’s/.test(await s.locator('h1').textContent()) && await s.locator('.duel-round-sealed').count() === 3 && await s.locator('#duel-board').count() === 0, 'a side match opens its own three rounds');
  await s.goBack(); await s.waitForTimeout(1200);
  ok(entered.length === 1, 'entered once per plan, not on every visit or side match');
  // A latecomer opening the same link: the board is there, but every plan is still sealed.
  const late = await mk('', board.map((x) => ({ ...x, mine: false })));
  await late.goto(base + L.invite); await late.waitForTimeout(1500);
  const sealed = await late.locator('#duel-board').innerText();
  ok(/4 plans are on this link\. Every one stays sealed until you lock in yours\./.test(sealed) && /holds the crown/.test(sealed) && await late.locator('#duel-board .duel-table-sealed li').count() === 4 && await late.locator('#duel-board .dt-redacted').count() === 4, 'a latecomer sees who holds the crown and each plan’s record');
  ok(!/Debt \d/.test(sealed) && !/% taxes/.test(sealed) && !/See the rounds/.test(sealed) && !L.names.some((n) => (sealed + dos).includes(n)), 'and nothing of any plan: no debt, no split, no moves');
  await late.locator('#duel-board').screenshot({ path: __OUT + '/duel-board-sealed.png' });
  ok(await s.evaluate(() => document.documentElement.scrollWidth <= innerWidth) && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth) && await g.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: no sideways scroll on the reveal, the board, or the desk');
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
