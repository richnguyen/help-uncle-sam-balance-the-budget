// The mission games: every lesson mission is a scored game. Perfect play (answers read from the
// game's own data) must earn three stars in all 18; a careless run earns fewer; Continue waits for
// the game; the best score sets the mission's stars; Play again starts fresh; coming back shows
// the best; and every game works on a phone.
const { chromium, devices } = require('playwright');
const H = require('./gamehelp');
const base = process.argv[2] || 'http://localhost:5173/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const J = JSON.stringify({ v: 2, done: [], stars: {}, steps: {}, quiz: {}, choices: {}, started: '2026-11-01', marks: [], medals: [], settings: { theme: 'light', freeRoam: true, narration: false, voice: 'off', sounds: false, voiceV: 2 } });
const GAMES = ['level-1', 'level-2', 'level-spend', 'level-3', 'level-4', 'level-economy', 'level-drag', 'level-fairness', 'level-6', 'level-roles', 'level-7', 'level-rules', 'level-growth', 'level-investment', 'level-9', 'level-future', 'level-brakes', 'level-yardstick'];
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (opts) => { const ctx = await b.newContext(opts); await ctx.addInitScript((j) => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', j); }, J); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
  let p = await mk({ viewport: { width: 1280, height: 900 } });
  await p.goto(base + '#sources'); await p.waitForTimeout(800);
  // The answers, straight from the game's data.
  const DATA = await p.evaluate(async () => {
    const L = await import('/src/game/levels.tsx');
    const D = await import('/src/lib/derive.ts');
    const data = await import('/src/data/index.ts');
    const out = {};
    for (const l of L.LEVELS) {
      const g = L.gameOf(l); if (!g) continue;
      out[l.id] = { id: g.id, title: g.title, rounds: g.rounds.map((r) => ({ kind: r.kind, id: r.id, label: r.label, quiz: r.kind === 'custom' ? null : {
        correct: r.quiz.correct, estimate: r.quiz.estimate && { answer: r.quiz.estimate.answer, min: r.quiz.estimate.min, step: r.quiz.estimate.step },
        split: r.quiz.split && r.quiz.split.parts.map((x) => x.answer), sizes: r.quiz.sizes && { answers: r.quiz.sizes.parts.map((x) => x.answer), step: r.quiz.sizes.step },
        sort: r.quiz.sort && r.quiz.sort.items.map((x) => ({ label: x.label, bin: r.quiz.sort.bins.find((bn) => bn.id === x.bin).label })),
      } })) };
    }
    const cats = Object.fromEntries(D.categoryTotals(data.budget.latestFY).map((c) => [c.label, c.amount]));
    const states = Object.fromEntries(data.geo.states.map((s) => [s.name, s.perCapita]));
    const P = await import('/src/game/process.tsx');
    const proc = { players: P.PLAYERS, provisions: P.PROVISIONS, laws: P.PAYGO_LAWS, offsets: P.PAYGO_OFFSETS };
    return { proc, games: out, cats, states, nat: data.geo.national.perCapita, cross: (D.categoryTotals(data.budget.latestFY).find((c) => c.id === 'defense').amount / data.debt.latest.public) * 100 };
  });
  ok(Object.keys(DATA.games).length === 18 && GAMES.every((id) => DATA.games[id]), `all 18 lesson missions have a game: ${Object.values(DATA.games).map((g) => g.title).join(', ')}`);

  const setRange = (sel, v) => p.evaluate(([sel, v]) => { const el = document.querySelector(sel); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, v]);
  const press = async (loc, key, n) => { await loc.focus(); for (let i = 0; i < n; i++) await p.keyboard.press(key); };
  const ORDERS = {
    calendar: ['President sends', 'budget resolution', '12 spending bills', 'fiscal year begins'],
    rank: ['Limit deductions', 'Raise every income tax', 'Pay Medicare insurers', 'Cut the defense'],
    order: ['Agencies send', 'OMB sends back', 'The President submits'],
    order2: ['CBO reports', 'Committees send', 'Mid-Session Review'],
  };
  const sortRows = async (want) => {
    for (let i = 0; i < want.length; i++) for (let k = 0; k < 5; k++) {
      const rows = await p.$$eval('.game-round .cal-row .cal-text strong', (l) => l.map((x) => x.textContent));
      const at = rows.findIndex((x) => x.includes(want[i])); if (at <= i) break;
      await p.locator('.game-round .cal-row').nth(at).locator('button[aria-label*="up"]').click(); await p.waitForTimeout(60);
    }
  };
  /** Play one round perfectly. */
  const perfect = async (lid, r) => {
    const q = r.quiz;
    if (r.kind === 'estimate') {
      const e = q.estimate; const v = e.min + Math.round((e.answer - e.min) / e.step) * e.step;
      await setRange('.game-round .estimate-track input', v); await p.waitForTimeout(80);
      await p.locator('.game-round .estimate-lock').click();
    } else if (r.kind === 'split') {
      const want = []; q.split.reduce((a, x, i) => { if (i < q.split.length - 1) want.push(a + x); return a + x; }, 0);
      for (let pass = 0; pass < 3; pass++) for (let k = want.length - 1; k >= 0; k--) {
        const h = p.locator('.split-handle').nth(k); const cur = Number(await h.getAttribute('aria-valuenow'));
        if (cur !== want[k]) await press(h, cur < want[k] ? 'ArrowRight' : 'ArrowLeft', Math.abs(cur - want[k]));
      }
      await p.locator('.game-round .estimate-lock').click();
    } else if (r.kind === 'sizes') {
      for (let k = 0; k < q.sizes.answers.length; k++) {
        const t = p.locator('.sizes-track').nth(k); const n = Math.round(q.sizes.answers[k] / q.sizes.step);
        await t.focus(); await p.keyboard.press('Home'); for (let i = 0; i < Math.floor(n / 4); i++) await p.keyboard.press('PageUp'); for (let i = 0; i < n % 4; i++) await p.keyboard.press('ArrowUp');
      }
      await p.locator('.game-round .estimate-lock').click();
    } else if (r.kind === 'sort') {
      // Cards are dealt one at a time, already picked up: one tap on the right group each.
      for (let k = 0; k < q.sort.length; k++) { const t = (await p.locator('.sort-tray .sort-chip').first().innerText()).trim(); const it = q.sort.find((x) => x.label === t) ?? q.sort.find((x) => t.includes(x.label)); await p.locator('.sort-bin-head', { hasText: it.bin }).click(); await p.waitForTimeout(60); }
      await p.locator('.game-round .estimate-lock').click();
    } else if (r.kind === 'choice') {
      await p.locator('.game-round .quiz-choice').nth(q.correct).click();
    } else if (r.id === 'pairs') {
      for (let k = 0; k < 5; k++) {
        const labels = await p.$$eval('.pairs-pick:not([disabled]) strong', (l) => l.map((x) => x.textContent));
        if (labels.length < 2) break;
        const pick = DATA.cats[labels[0]] >= DATA.cats[labels[1]] ? 0 : 1;
        await p.locator('.pairs-pick').nth(pick).click(); await p.waitForTimeout(120);
        if (await p.locator('.pairs-next').count()) { await p.locator('.pairs-next').click(); await p.waitForTimeout(120); }
      }
    } else if (r.id === 'hilo') {
      for (let k = 0; k < 10; k++) {
        if (!(await p.locator('.hilo-pick:not([disabled])').count())) break;
        const q2 = await p.locator('.hilo .quiz-q').textContent();
        const name = q2.match(/person in (.+?):/)[1];
        await p.locator('.hilo-pick').nth(DATA.states[name] >= DATA.nat ? 0 : 1).click(); await p.waitForTimeout(120);
        if (await p.locator('.pairs-next').count()) { await p.locator('.pairs-next').click(); await p.waitForTimeout(120); }
      }
    } else if (r.id === 'tank') {
      for (let k = 0; k < 7; k++) { await p.locator('.tank-chip:not([disabled])').first().click(); await p.waitForTimeout(80); }
    } else if (r.id === 'cross') {
      await setRange('.game-round .sim-slider input', Math.round(DATA.cross * 10) / 10); await p.waitForTimeout(80);
      await p.locator('.game-round .sim-lock').click();
    } else if (r.id === 'now' || r.id === 'late') {
      await setRange('.game-round .sim-two .sim-slider:nth-child(1) input', r.id === 'now' ? 16.65 : 17.3); await p.waitForTimeout(80);
      await p.locator('.game-round .sim-lock').click();
    } else if (r.id === 'plan') {
      // Try every plan and lock in the one worth most: size × (gentle 1, moderate 0.6, steep 0.1).
      const worth = { gentle: 1, moderate: 0.6, steep: 0.1 }; let best = null;
      for (const size of [1, 2, 3]) for (const ph of [false, true]) {
        await p.locator('.game-round .seg button').nth(size - 1).click();
        const cb = p.locator('.game-round input[type=checkbox]'); if ((await cb.isChecked()) !== ph) await cb.click();
        await p.waitForTimeout(80);
        const z = (await p.locator('.game-round .dial-zone-name').textContent()).trim();
        const w = size * worth[z]; if (!best || w > best.w) best = { w, size, ph };
      }
      await p.locator('.game-round .seg button').nth(best.size - 1).click();
      const cb = p.locator('.game-round input[type=checkbox]'); if ((await cb.isChecked()) !== best.ph) await cb.click();
      await p.locator('.game-round .sim-lock').click();
    } else if (ORDERS[r.id]) {
      await sortRows(ORDERS[r.id]); await p.locator('.game-round .estimate-lock').click();
    } else if (r.id === 'memory' || r.id === 'memory2') {
      // Perfect memory, knowing who does what: never flip a card you've already seen, unless it's the match.
      const whatOf = Object.fromEntries(DATA.proc.players.map((x) => [x.who, x.what]));
      const seen = {};
      const nCards = await p.locator('.mem-grid[data-side="who"] .mem-card').count();
      for (let w = 0; w < nCards; w++) {
        const who = p.locator('.mem-grid[data-side="who"] .mem-card').nth(w);
        await who.click(); const text = await who.innerText(); const want = whatOf[text];
        for (let tries = 0; tries < 9; tries++) {
          let at = Object.keys(seen).find((k) => seen[k] === want);
          if (at === undefined) for (let x = 0; x < nCards; x++) if (seen[x] === undefined && !(await p.locator('.mem-grid[data-side="what"] .mem-card').nth(x).isDisabled())) { at = String(x); break; }
          const what = p.locator('.mem-grid[data-side="what"] .mem-card').nth(Number(at));
          await what.click(); seen[at] = await what.innerText(); await p.waitForTimeout(80);
          if (await who.isDisabled()) { delete seen[at]; break; }
          await p.waitForTimeout(1200); await who.click();
        }
      }
    } else if (r.id === 'baseline') {
      // Against last year the bill is an increase; against CBO's baseline, a cut.
      await p.locator('.base-call[data-call="up"]').click(); await p.waitForTimeout(100);
      await p.locator('.base-call[data-call="down"]').click(); await p.waitForTimeout(100);
    } else if (r.id === 'ref') {
      for (let k = 0; k < 6; k++) {
        const used = Number((await p.locator('.ref-limit-label').textContent()).match(/used \$(\d+)/)[1]);
        const costT = await p.locator('.ref-bill .num').textContent(); const cost = Number(costT.match(/(\d+)/)[1]) * (/saves/.test(costT) ? -1 : 1);
        await p.locator(`.ref-call[data-call="${cost > 0 && used + cost > 50 ? 'poo' : 'pass'}"]`).click(); await p.waitForTimeout(100);
        if (await p.locator('.referee .pairs-next').count()) { await p.locator('.referee .pairs-next').click(); await p.waitForTimeout(100); }
      }
    } else if (r.id === 'byrd' || r.id === 'byrd2') {
      // Four provisions a round: strike the ones on screen that don't change spending or revenue.
      const strike = DATA.proc.provisions.filter((x) => !x.budget).map((x) => x.label);
      for (const t of strike) { const line = p.locator('.strike-line', { hasText: t }); if (await line.count()) await line.click(); }
      await p.locator('.game-round .estimate-lock').click();
    } else if (r.id === 'year') {
      for (let k = 0; k < 12; k++) {
        const t = await p.locator('.apportion .small.muted').filter({ hasText: 'After this month' }).textContent();
        const [left, owed] = [...t.matchAll(/\$(\d+) million/g)].map((m) => Number(m[1]));
        const cost = Number((await p.locator('.apportion .ref-bill .num').textContent()).match(/(\d+)/)[1]);
        await p.locator(`.ap-pick[data-pick="${left - cost >= owed ? 'yes' : 'no'}"]`).click(); await p.waitForTimeout(80);
      }
    } else if (r.id === 'paygo') {
      const L = DATA.proc.laws, O = DATA.proc.offsets; const f = L.reduce((a, x) => a + x.five, 0), t = L.reduce((a, x) => a + x.ten, 0);
      let pick = null;
      for (let i = 0; i < O.length && !pick; i++) for (let j = i + 1; j < O.length && !pick; j++) if (f + O[i].five + O[j].five <= 0 && t + O[i].ten + O[j].ten <= 0) pick = [O[i], O[j]];
      for (const o of pick) await p.locator('.paygo-offset', { hasText: o.label }).click();
      await p.locator('.game-round .estimate-lock').click();
    }
    await p.waitForTimeout(300);
  };
  const openGame = async (lid) => { await p.goto(base + '#' + lid); await p.waitForTimeout(900); return H.toStep(p, DATA.games[lid].title); };

  // 1. Perfect play earns three stars in every game; each round scores what it should.
  const perRound = {};
  for (const lid of GAMES) {
    await openGame(lid);
    const g = DATA.games[lid]; const pts = [];
    for (let k = 0; k < g.rounds.length; k++) {
      await perfect(lid, g.rounds[k]);
      pts.push(Number((await p.locator('.game-plus').textContent()).replace('+', '')));
      if (k < g.rounds.length - 1) { await p.locator('.game-next').click(); await p.waitForTimeout(350); }
    }
    const stars = await p.locator('.game-over .stars .star.on').count();
    const total = pts.reduce((a, x) => a + x, 0);
    perRound[lid] = pts;
    ok(stars === 3 && total >= 0.85 * g.rounds.length * 100, `${lid} ${g.title}: perfect play scores ${total}/${g.rounds.length * 100} (${pts.join(' + ')}) for three stars`);
  }
  ok(Object.values(perRound).flat().every((x) => x >= 90), 'every round awards 90 points or more for a perfect answer');

  // 2. A careless run: fewer stars; Continue waits for the game; the mission's stars come from the game.
  p = await mk({ viewport: { width: 1280, height: 900 } });
  await p.goto(base + '#level-4'); await p.waitForTimeout(900);
  await p.locator('.level-nav .btn-primary').click(); await p.waitForTimeout(500);
  const prim = p.locator('.level-nav .btn-primary');
  ok(await p.locator('.mgame').count() === 1 && !(await prim.isEnabled()) && /Finish the game/.test(await prim.textContent()) && (await p.locator('.game-score strong').textContent()) === '0', 'the game step: score 0, and Continue waits: “Finish the game to continue”');
  await setRange('.game-round .estimate-track input', 1985); await p.locator('.game-round .estimate-lock').click(); await p.waitForTimeout(300);
  ok((await p.locator('.game-plus').textContent()) === '+20' && /16 years off/.test(await p.locator('.game-banner').innerText()), 'a far-off guess still earns 20 points for trying');
  await p.locator('.game-next').click(); await p.waitForTimeout(300);
  ok(await p.locator('.tank-chip[data-kind]').count() === 0 && await p.locator('.sim-actions .btn', { hasText: 'Pour the next' }).count() === 0, 'in the game, the tank hides which bills are on autopilot and has no “pour the next one” helper');
  for (const name of ['Defense', 'Everything else', 'Social Security', 'Medicare', 'Medicaid', 'Other mandatory', 'Interest']) { await p.locator('.tank-chip', { hasText: name }).first().click(); await p.waitForTimeout(80); }
  ok((await p.locator('.game-plus').textContent()) === '+60' && /3 of the 5/.test(await p.locator('.game-banner').innerText()), 'pouring two bills Congress votes on first costs points: ' + (await p.locator('.game-banner').innerText()).replace(/\s+/g, ' ').slice(0, 60));
  await p.locator('.game-next').click(); await p.waitForTimeout(300);
  const ch = p.locator('.game-round .quiz-choice');
  const right = DATA.games['level-4'].rounds[2].quiz.correct;
  await ch.nth(right === 0 ? 1 : 0).click(); await p.waitForTimeout(200);
  ok(/half points/.test(await p.locator('.game-round .quiz-feedback').innerText()) && !(await p.locator('.game-banner').count()), 'a wrong bonus answer leaves one more try, for half points');
  await ch.nth(right).click(); await p.waitForTimeout(300);
  ok((await p.locator('.game-plus').textContent()) === '+50', 'right on the second try: +50');
  const total2 = Number(await p.locator('.game-score strong').textContent());
  ok(total2 === 130 && await p.locator('.game-over .stars .star.on').count() === 1 && await prim.isEnabled(), `a careless run: ${total2}/300, one star, and Continue opens`);
  await p.locator('.game-again').click(); await p.waitForTimeout(400);
  ok((await p.locator('.game-score strong').textContent()) === '0' && /Round 1 of 3/.test(await p.locator('.game-round-label').textContent()) && await p.locator('.game-over').count() === 0, 'Play again starts fresh at round 1 with 0 points');
  await H.playGame(p); await p.waitForTimeout(200);
  await prim.click(); await p.waitForTimeout(400);
  for (let k = 0; k < 3 && !(await p.locator('.celebrate').count()); k++) { await prim.click(); await p.waitForTimeout(400); }
  await p.waitForTimeout(600);
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('ftd:journey')));
  ok(st.done.includes('level-4') && st.stars['level-4'] === st.games['g-gap'].stars && st.games['g-gap'].best === Math.max(130, st.games['g-gap'].best) && st.games['g-gap'].plays === 2, `finishing the mission: stars = the game’s best (${st.stars['level-4']}★, best ${st.games['g-gap'].best}, ${st.games['g-gap'].plays} plays)`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(/your best is \d+ of 300 points/.test(await p.locator('.complete').innerText()), 'the complete card reports the game’s best score');
  // Coming back: the game shows the best, with Play again; Continue is open.
  await p.goto(base + '#level-4'); await p.reload(); await p.waitForTimeout(900);
  await p.locator('.steptrack-seg').nth(1).click(); await p.waitForTimeout(400);
  ok(await p.locator('.game-over .game-again').count() === 1 && /your best/.test(await p.locator('.game-over').innerText()) && await prim.isEnabled(), 'coming back, the game shows your best and a Play again button');

  // 3. Phones: every game fits, and plays by touch.
  p = await mk({ ...devices['iPhone 13'] });
  for (const lid of GAMES) {
    await p.goto(base + '#' + lid); await p.waitForTimeout(700); await H.toStep(p, DATA.games[lid].title, true);
    const fits = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    let played = true;
    const touch = ['level-2', 'level-3', 'level-7', 'level-9', 'level-spend', 'level-roles', 'level-rules', 'level-brakes'];
    if (touch.includes(lid)) played = !!(await H.playGame(p, true));
    ok(fits && played, `phone, ${lid}: no sideways scroll${touch.includes(lid) ? ', and it plays through by touch' : ''}`);
  }
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
})().catch((e) => { console.log('FAIL crashed:', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
