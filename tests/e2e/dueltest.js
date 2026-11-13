// The level 10 duel, end to end on phones: Ruth builds a plan and sends one invite; Sam and a
// second friend each play it blind, reveal, and reply; Ruth sees every head-to-head and a rematch.
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['', 'm', 'duel', 'dock']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const winByHand = require('./winbyhand');
const base = process.argv[2] || 'http://localhost:5173/';
const out = __OUT + '/duel/';
require('fs').mkdirSync(out, { recursive: true });
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const J = (o) => JSON.stringify({ v: 2, done: [], stars: {}, steps: {}, quiz: {}, choices: {}, started: null, marks: [], medals: [], settings: { text: 'normal', theme: 'system', freeRoam: false, narration: false, voice: 'off', haptics: false, sounds: false, voiceV: 2 }, ...o });
const local = (href) => { const u = new URL(href); return base + u.pathname.replace(/^\//, '') + u.search; };
const linkOf = async (p, scope) => { const h = await p.locator(scope + ' .social-link[data-net="whatsapp"]').first().getAttribute('href'); const t = decodeURIComponent(new URL(h).searchParams.get('text')); return { text: t, url: t.match(/https?:\/\/\S+/)[0] }; };
const done = async (p) => /complete|met/i.test((await p.locator('.sb-big').first().textContent()) || '');
// A different plan: every card, then across-the-board spending cuts instead of a tax increase.
async function winOtherWay(p) {
  for (let k = 0; k < 40 && !(await done(p)); k++) { const a = p.locator('.pcard-add:not(.on)').last(); if (!(await a.count())) break; await a.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'center' })); await a.click(); await p.waitForTimeout(100); }
  for (const id of ['#lv-nondefense', '#lv-defense']) {
    const s = p.locator(id);
    for (let k = 0; k < 50 && !(await done(p)) && (await s.count()); k++) { await s.press('ArrowLeft'); await p.waitForTimeout(40); }
  }
  await p.waitForTimeout(600);
  return done(p);
}
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const mk = async (journey) => {
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    await ctx.addInitScript((j) => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', j); }, journey);
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    return p;
  };
  const tidy = async (p) => { if (await p.locator('.samdock[data-shown]').count()) { await p.locator('.samdock-avatar').tap().catch(() => {}); await p.waitForTimeout(400); } };

  // 1. Ruth finishes level 10: the pop-up and the page offer a duel, not a challenge.
  const A = await mk(J({ settings: { text: 'normal', theme: 'system', freeRoam: true, narration: false, voice: 'off', haptics: false, sounds: false, voiceV: 2 } }));
  await A.goto(base + '#level-10'); await A.waitForSelector('.pcard');
  ok(await winByHand(A), 'Ruth meets the level 10 goal');
  await A.waitForTimeout(500);
  const cel = A.locator('.celebrate');
  ok(await cel.getByRole('button', { name: 'Send the duel' }).count() === 1 && /Duel a friend/.test(await cel.innerText()), 'the level 10 pop-up sends a duel');
  await A.keyboard.press('Escape'); await A.waitForTimeout(300);
  ok(await A.locator('#duel-start').count() === 1 && await A.locator('#challenge').count() === 0, 'level 10: “Duel a friend” replaces “Challenge a friend”');
  ok(await A.locator('.plan-bar').getByRole('link', { name: 'Duel a friend' }).count() === 1, 'the action bar says “Duel a friend”');
  await A.locator('#duel-start input').fill('Ruth'); await A.waitForTimeout(300);
  const inv = await linkOf(A, '#duel-start');
  ok(/^Ruth here\. Duel me on the final mission/.test(inv.text) && /\/p\/duel\/\?duel=[a-z0-9]{6}&hp=10\.[^&]*/.test(inv.url) && /hby=Ruth/.test(inv.url), 'the invite: ' + inv.url.slice(0, 110));
  await A.locator('#duel-start').screenshot({ path: out + 'start.png' });
  await A.locator('#duel-start').getByRole('link', { name: 'See your invite' }).tap(); await A.waitForTimeout(800);
  ok(/Your duel invite/.test(await A.locator('h1').textContent()) && /No replies yet/.test(await A.locator('main').innerText()), 'Ruth’s own invite page: no replies yet');

  // 2. Sam, brand new, opens the invite: their plan is sealed; level 10 opens straight away.
  const B = await mk(J({}));
  await B.goto(local(inv.url)); await B.waitForSelector('h1'); await B.waitForTimeout(600);
  ok(/^#duel\?duel=/.test(await B.evaluate(() => location.hash)) && /Ruth challenged you to a duel/.test(await B.locator('h1').textContent()), 'Sam lands on the invite: ' + await B.locator('h1').textContent());
  const invText = await B.locator('main').innerText();
  ok(/sealed/i.test(invText) && /The debt\./.test(invText) && /The economy\./.test(invText) && /The balance\./.test(invText), 'the invite: sealed plan and the three rounds');
  await tidy(B); await B.screenshot({ path: out + 'invite.png' });
  await B.locator('.actionbar').getByRole('button', { name: 'Start the duel' }).tap(); await B.waitForTimeout(900);
  ok(await B.evaluate(() => location.hash) === '#level-10' && await B.locator('.pcard').count() > 0, 'Start the duel opens level 10 (not locked)');
  ok(/Duel with Ruth/.test(await B.locator('.duel-banner').innerText()) && await B.locator('.pcard-add.on').count() === 0, 'blind banner, and a fresh plan');
  ok(await B.locator('.duel-banner').getByRole('button', { name: 'Reveal now' }).count() === 0, 'no “Reveal now” before any card');
  await tidy(B); await B.screenshot({ path: out + 'blind.png' });
  ok(await winOtherWay(B), 'Sam meets the goal another way');
  await B.waitForTimeout(500);
  ok(await B.locator('.celebrate').count() === 0, 'no pop-up in a duel: the reveal is the payoff');
  const bar = B.locator('.plan-bar').getByRole('button', { name: 'Reveal the duel' });
  ok(await bar.count() === 1, 'the action bar: Reveal the duel');
  await bar.tap(); await B.waitForTimeout(1000);
  ok(/^#duel\?duelr=/.test(await B.evaluate(() => location.hash)) && /You vs\. Ruth/.test(await B.locator('h1').textContent()), 'the reveal: ' + await B.locator('h1').textContent());
  const rounds = await B.$$eval('.duel-round:not(.duel-tiebreak)', (r) => r.map((x) => x.innerText.replace(/\s+/g, ' ')));
  const even = await B.locator('.duel-tiebreak').count();
  ok(even === (/^Tied|on (fewer cards|a gentler economy)$/.test(await B.locator('.duel-score-num').textContent()) ? 1 : 0), 'the tie-breaker card shows only when the rounds are even: ' + (even ? (await B.locator('.duel-tiebreak p').textContent()) : 'not needed'));
  ok(rounds.length === 3 && /The debt/.test(rounds[0]) && /The economy/.test(rounds[1]) && /The balance/.test(rounds[2]), 'three rounds:\n   ' + rounds.join('\n   '));
  const score = await B.locator('.duel-score-num').innerText();
  ok(/^((Your plan wins|Ruth’s plan wins) (\d–\d|on fewer cards|on a gentler economy)|Tied \d–\d)$/.test(score), 'the score: ' + score);
  ok(/never people/.test(await B.locator('.duel-score').innerText()), 'plans are compared, never people');
  await tidy(B); await B.screenshot({ path: out + 'reveal.png', fullPage: true });
  await B.locator('#duel-back-name').fill('Sam'); await B.waitForTimeout(300);
  const reply = await linkOf(B, '.duel-send');
  ok(/^Sam here\. I played your budget duel/.test(reply.text) && /\/p\/duel-back\/\?duelr=/.test(reply.url) && /hby=Ruth/.test(reply.url) && /[?&]by=Sam/.test(reply.url) && /[?&]p=10\./.test(reply.url), 'the reply: ' + reply.text.slice(0, 80));
  await B.goto(base + '#duels'); await B.waitForTimeout(700);
  const bRows = await B.$$eval('.duel-row', (r) => r.map((x) => x.innerText.replace(/\s+/g, ' ')));
  ok(bRows.length === 1 && /You vs\. Ruth/.test(bRows[0]), 'Sam’s Duels page: ' + bRows.join(' | '));
  ok(!(await B.evaluate(() => localStorage.getItem('ftd:duel-active'))) || (await B.evaluate(() => localStorage.getItem('ftd:duel-active'))) === 'null', 'the duel is no longer active after the reveal');

  // 3. Ruth opens Sam's reply: the same rounds, from Ruth's side.
  await A.goto(local(reply.url)); await A.waitForSelector('h1'); await A.waitForTimeout(800);
  ok(/You vs\. Sam/.test(await A.locator('h1').textContent()), 'Ruth sees: ' + await A.locator('h1').textContent());
  const aScore = await A.locator('.duel-score-num').innerText();
  const flipped = (s) => s.replace(/^Your plan wins/, 'X').replace(/^Ruth’s plan wins/, 'Your plan wins').replace(/^X/, 'Sam’s plan wins');
  ok(aScore === flipped(score) || (score.startsWith('Tied') && aScore === score), `the score from Ruth’s side: ${aScore} (Sam saw ${score})`);
  ok(await A.locator('.duel-send').count() === 0 && await A.locator('.actionbar').getByRole('link', { name: 'Rematch' }).count() === 1, 'Ruth gets a rematch, not a send-back');

  // 4. A second friend plays the same link: their own head-to-head. They reveal early.
  const C = await mk(J({}));
  await C.goto(local(inv.url)); await C.waitForSelector('h1'); await C.waitForTimeout(500);
  await C.locator('.actionbar').getByRole('button', { name: 'Start the duel' }).tap(); await C.waitForTimeout(900);
  await C.locator('.pcard-add:not(.on)').first().click(); await C.waitForTimeout(400);
  await C.locator('.duel-banner').getByRole('button', { name: 'Reveal now' }).click(); await C.waitForTimeout(900);
  ok(/doesn’t balance the budget yet/.test(await C.locator('.duel-score').innerText()), 'revealing early is honest: ' + (await C.locator('.duel-balanced').innerText()));
  const reply2 = await linkOf(C, '.duel-send');
  ok(!/[?&]by=/.test(reply2.url), 'an unsigned reply');
  await A.goto(local(reply2.url)); await A.waitForTimeout(800);
  await A.goto(base + '#duels'); await A.waitForTimeout(700);
  const aRows = await A.$$eval('.duel-row', (r) => r.map((x) => x.innerText.replace(/\s+/g, ' ')));
  ok(aRows.filter((r) => /^You vs\./.test(r)).length === 2 && aRows.some((r) => /You vs\. Sam/.test(r)) && aRows.some((r) => /You vs\. Your friend/.test(r)) && aRows.some((r) => /Open invite/.test(r)), 'Ruth’s Duels page, one link, two friends:\n   ' + aRows.join('\n   '));
  await tidy(A); await A.screenshot({ path: out + 'duels.png', fullPage: true });
  // Opening the same reply twice doesn't duplicate it.
  await A.goto(local(reply.url)); await A.waitForTimeout(600); await A.goto(base + '#duels'); await A.waitForTimeout(500);
  ok((await A.locator('.duel-row').count()) === aRows.length, 'opening a reply again keeps one row for it');

  // 5. Rematch: back to level 10, with the friend's name on the invite.
  await A.locator('.duel-row', { hasText: 'You vs. Sam' }).getByRole('link', { name: 'Rematch' }).tap(); await A.waitForTimeout(900);
  ok(/Rematch with Sam/.test(await A.locator('.challenge-banner').first().innerText()), 'rematch banner on level 10');
  ok(/Rematch: send Sam a new duel/.test(await A.locator('#duel-start h2').textContent().catch(() => '')), 'the invite says it’s a rematch');

  // 5b. The tie-breakers: rounds even, the gentler steepest year wins, then fewer cards (found among small plans, then shown).
  const tb = await A.evaluate(async () => {
    const D = await import('/src/game/duel.ts');
    const P = await import('/src/lib/planData.ts');
    const Z = { revenues: 0, socialSecurity: 0, medicare: 0, medicaid: 0, otherMandatory: 0, defense: 0, nondefense: 0 };
    const ids = P.OPTIONS_DATA.options.map((o) => o.id).slice(0, 14);
    const plans = [...ids.map((a) => [a]), ...ids.flatMap((a, i) => ids.slice(i + 1).map((b) => [a, b]))].map((x) => ({ ids: x, lv: Z, gradual: true }));
    for (const a of plans) for (const b of plans) {
      if (a.ids.length === b.ids.length) continue;
      const r = D.duelRounds(a, b);
      const won = r.rounds.filter((x) => x.winner === 'me').length, lost = r.rounds.filter((x) => x.winner === 'them').length;
      if (won === lost) return { a, b, outcome: r.outcome, tiebreak: r.tiebreak, by: r.tiebreakBy, steep: r.steep, cards: r.cards, score: r.score, hash: D.resultHash({ id: 'tbtest', host: b, hostName: 'Pat', guest: a, guestName: 'Lee' }) };
    }
    return null;
  });
  const gentler = tb && (tb.steep.mine < tb.steep.theirs ? 'me' : 'them');
  ok(tb && tb.by === 'economy' && tb.tiebreak === gentler && tb.outcome === (gentler === 'me' ? 'won' : 'lost'), `tie-breaker: ${tb && `${tb.score}, steepest year ${(tb.steep.mine * 100).toFixed(2)}% vs ${(tb.steep.theirs * 100).toFixed(2)}% → ${tb.outcome}`} (the gentler plan wins before fewer cards counts)`);
  const fewerSteeper = tb && ((tb.cards.mine < tb.cards.theirs) !== (gentler === 'me'));
  if (fewerSteeper) ok(tb.outcome === (gentler === 'me' ? 'won' : 'lost'), 'a plan with fewer cards but a steeper year loses the tie-break');
  const cardsTie = await A.evaluate(async () => { const D = await import('/src/game/duel.ts'); const Z = { revenues: 0, socialSecurity: 0, medicare: 0, medicaid: 0, otherMandatory: 0, defense: 0, nondefense: 0 }; const p = { ids: ['cut-defense-budget'], lv: Z, gradual: true }; const r = D.duelRounds(p, p); return { by: r.tiebreakBy, t: r.tiebreak, o: r.outcome }; });
  ok(cardsTie.by === 'cards' && cardsTie.t === 'tie' && cardsTie.o === 'tied', 'the same plan both ways: even on the economy and on cards, a true tie');
  const T = await mk(J({}));
  await T.goto(base + tb.hash); await T.waitForTimeout(800);
  const tbCard = await T.locator('.duel-tiebreak').innerText().catch(() => '');
  ok(/Tie-breaker · The gentler plan/i.test(tbCard) && /on a gentler economy$/.test(await T.locator('.duel-score-num').textContent()), 'the tie-breaker is shown: ' + (await T.locator('.duel-score-num').textContent()) + ' | ' + tbCard.replace(/\s+/g, ' ').slice(0, 120));
  await T.locator('.duel-rounds').screenshot({ path: out + 'tiebreak.png' });

  // 6. A broken link.
  const D = await mk(J({}));
  await D.goto(base + '#duel?duel=abc'); await D.waitForTimeout(500);
  ok(/incomplete/.test(await D.locator('h1').textContent()), 'a broken duel link says so');
  // Level 10 stays locked for a newcomer with no duel.
  await D.goto(base + '#level-10'); await D.waitForTimeout(600);
  ok(await D.locator('.pcard').count() === 0, 'level 10 stays locked without a duel');

  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
