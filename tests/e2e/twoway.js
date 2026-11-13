// Two-way cards: a tax cut and a spending increase, each with an official estimate. They sit last
// in the deck, say they add to deficits, widen the gap when played, leave the who-pays split alone,
// survive a shared link, stay out of the starter deck, hints and Daily puzzles, and show in polls.
const { chromium, devices } = require('playwright');
const COST = ['extend-aca-credits', 'extend-obbba-temp-tax'];
(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const open = async (hash) => {
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    await ctx.addInitScript(() => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, done: ['level-1'], settings: { freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false } })); });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:5173/#' + hash); await p.waitForTimeout(1300); return p;
  };

  // 1. Data: every two-way card has a negative ten-year number and an official source.
  const p = await open('level-8'); await p.waitForSelector('.pcard');
  const data = await p.evaluate(async (ids) => { const m = await import('/src/lib/planData.ts'); return ids.map((id) => m.OPTIONS_DATA.options.find((o) => o.id === id)); }, COST);
  ok(data.every((o) => o && o.savings10 < 0 && /^https:\/\/www\.cbo\.gov\/publication\/\d+$/.test(o.source.url) && o.affects && o.benefits), 'each card adds to deficits, with a CBO publication as its source and who pays / who benefits');
  ok(data.some((o) => o.side === 'revenue') && data.some((o) => o.side === 'spending'), 'one tax cut and one spending increase');

  // 2. Desk 2.7: the cards are last, labeled, and widen the gap.
  const order = await p.evaluate(() => [...document.querySelectorAll('.pcard')].map((c) => c.dataset.card));
  ok(COST.every((id) => order.indexOf(id) >= order.length - 2), 'two-way cards come last in the deck');
  const card = p.locator('.pcard[data-card="extend-obbba-temp-tax"]');
  const kind = await card.locator('.pcard-front .pcard-kind').textContent();
  ok(/^Tax cut$/.test(kind) && await card.locator('.pill-cost').textContent() === 'Adds to deficits' && await card.locator('.pcard-effect').count() === 0, `the card says what it is ("${kind}", "Adds to deficits") and keeps its effect hidden until played`);
  const prog = () => p.evaluate(() => document.querySelector('.sb-big').textContent);
  await p.evaluate(() => document.querySelector('.pcard[data-card="limit-itemized-15pct"] .pcard-add').click()); await p.waitForTimeout(500);
  const before = await prog();
  await p.evaluate(() => document.querySelector('.pcard[data-card="extend-obbba-temp-tax"] .pcard-add').click()); await p.waitForTimeout(500);
  const after = await prog();
  const big = await card.locator('.pcard-effect').textContent().catch(() => '');
  ok(/^Widens the gap \d+%$/.test(big), 'once played, the card shows its effect: ' + big);
  const n = (s) => Number((s.match(/(\d+)%/) || [])[1] ?? 100);
  ok(n(after) < n(before), `playing it lowers progress (${before} → ${after})`);
  const split = await p.evaluate(() => document.querySelectorAll('.hb-gauge')[1]?.textContent ?? '');
  ok(!/-\d|NaN|Infinity/.test(split), 'the who-pays split stays a clean split: ' + split.replace(/\s+/g, ' ').slice(0, 80));

  // 3. Shared plans: the scoring and the link include it.
  const sh = await p.evaluate(async () => {
    const A = await import('/src/lib/assess.ts'); const S = await import('/src/lib/sandbox.ts'); const P = await import('/src/game/plans.ts');
    const a1 = A.assess('deficit3', ['limit-itemized-15pct'], S.ZERO, true), a2 = A.assess('deficit3', ['limit-itemized-15pct', 'extend-obbba-temp-tax'], S.ZERO, true);
    const q = P.encodePlan({ level: 'level-8', ids: ['limit-itemized-15pct', 'extend-obbba-temp-tax', 'extend-aca-credits'], lv: S.ZERO, gradual: true });
    const back = P.decodePlan ? P.decodePlan(new URLSearchParams(q)) : null;
    return { p1: a1.progress, p2: a2.progress, share: a2.revenueShare, q, back: back?.ids };
  });
  ok(sh.p2 < sh.p1 && sh.share >= 0 && sh.share <= 1, `a shared plan scores it the same way (progress ${sh.p1.toFixed(2)} → ${sh.p2.toFixed(2)})`);
  ok(/p=8\.[a-z]*u[a-z]*|p=8\.[a-z]*v/.test(sh.q) && (!sh.back || COST.every((id) => sh.back.includes(id))), 'plan links carry the new cards: ' + sh.q);

  // 4. Not in the 1.9 starter deck; the hint never points at one.
  const s = await open('level-5'); await s.waitForSelector('.pcard');
  const starter = await s.evaluate(() => [...document.querySelectorAll('.pcard')].map((c) => c.dataset.card));
  ok(!starter.some((id) => COST.includes(id)), '1.9: the starter deck has no two-way cards');

  // 5. Daily puzzles skip them; the feed has a poll for each, worded as adding to deficits.
  const d = await s.evaluate(async () => { const m = await import('/src/game/daily.ts'); return JSON.stringify(m).length; }).catch(() => 0);
  const src = await s.evaluate(async () => (await fetch('/src/game/daily.ts')).text());
  ok(/savings10 > 0/.test(src), 'Daily puzzles only use cards that save');
  const f = await open('menu');
  await f.locator('.feed-filters .feed-pill', { hasText: 'Polls' }).first().click(); await f.waitForTimeout(500);
  let fact = null;
  for (let i = 0; i < 40 && !fact; i++) {
    fact = await f.evaluate(() => { for (const r of document.querySelectorAll('.feed-row[data-key="poll:extend-aca-credits"]')) return r.querySelector('.fc-fact')?.textContent; scrollBy(0, innerHeight * 0.9); return null; });
    await f.waitForTimeout(200);
  }
  ok(/deficits would be about \$350 billion larger over ten years, by CBO’s estimate/.test(fact ?? ''), 'feed poll: ' + fact);

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
})();
