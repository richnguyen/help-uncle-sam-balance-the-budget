// Tap-to-define: glossary terms are tappable in missions, games, the desk and feed bill summaries.
// Phone taps, keyboard, the screen-reader text, closing, and a sweep of every mission's steps.
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const J = (id, n) => JSON.stringify({ v: 2, done: ['level-1'], steps: id ? { [id]: [...Array(n).keys()] } : {}, settings: { freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false } });
  const open = async (hash, id, n, dev = devices['iPhone 13']) => {
    const ctx = await b.newContext({ ...dev, hasTouch: true });
    await ctx.addInitScript((j) => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem('ftd:journey', j); }, J(id, n));
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && /key|validateDOMNesting|cannot be a descendant/i.test(m.text())) errs.push(m.text().slice(0, 160)); });
    await p.goto('http://localhost:5173/#' + hash); await p.waitForTimeout(1400); await p.addStyleTag({ content: '.toasts{display:none!important}' }); return p;
  };

  // 1. Every mission: walk the steps (playing game rounds through) and collect the linked terms.
  const p0 = await open('journey');
  const missions = await p0.evaluate(async () => { const m = await import('/src/game/levels.tsx'); return m.LEVELS.filter((l) => l.steps).map((l) => ({ id: l.id, n: l.steps.length })); });
  const found = {};
  for (const m of process.env.QUICK ? [] : missions) {
    const p = await open(m.id, m.id, m.n); const seen = new Set();
    const grab = async () => (await p.evaluate(() => [...document.querySelectorAll('main .term')].map((t) => t.dataset.term))).forEach((t) => seen.add(t));
    for (let k = 0; k < m.n; k++) {
      await p.evaluate((k) => document.querySelectorAll('.steptrack-seg')[k]?.click(), k); await p.waitForTimeout(350); await grab();
      for (let r = 0; r < 6 && await p.locator('.game-round').count(); r++) {
        // Answer whatever is in front (first choice, or lock in), so the explanation shows.
        await p.evaluate(() => { const c = document.querySelector('.game-round .quiz-choice:not([disabled])'); if (c) c.click(); else [...document.querySelectorAll('button')].find((x) => /^Lock in/.test(x.textContent.trim()))?.click(); }); await p.waitForTimeout(300);
        await p.evaluate(() => document.querySelector('.game-round .quiz-choice:not([disabled])')?.click()); await p.waitForTimeout(300); await grab();
        const next = await p.evaluate(() => { const n = [...document.querySelectorAll('button')].find((x) => /^Next round|^See how you did/.test(x.textContent.trim())); n?.click(); return !!n; }); await p.waitForTimeout(350);
        if (!next) break;
      }
      await grab();
    }
    found[m.id] = [...seen]; await p.context().close();
  }
  const withTerms = Object.values(found).filter((t) => t.length).length;
  console.log('   terms per mission:', Object.entries(found).map(([k, v]) => `${k.replace('level-', '')}:${v.length}`).join(' '));
  ok(withTerms >= Math.ceil(missions.length * 0.6), `most missions have tappable terms (${withTerms} of ${missions.length})`);
  const all = new Set(Object.values(found).flat());
  ok(['gdp', 'baseline', 'reconciliation', 'debt-public', 'appropriations', 'trust-fund'].filter((t) => all.has(t)).length >= 5, 'the core terms show up across the missions: ' + [...all].sort().join(', '));
  ok(!all.has('supplemental'), 'the SNAP name is not mistaken for supplemental appropriations');

  // 2. Feed bill summaries (phone): tap opens, screen-reader text, tap elsewhere closes.
  const f = await open('menu');
  await f.locator('.feed-filters .feed-pill', { hasText: 'Bills' }).first().tap(); await f.waitForTimeout(600);
  // Scroll the (windowed) Bills list until a summary with a glossary term is open on screen.
  let t = null;
  for (let i = 0; i < 30 && !t; i++) {
    t = await f.evaluate(async () => {
      for (const row of document.querySelectorAll('.feed-row:has(.fc[data-kind="bill"])')) {
        const term = row.querySelector('.fc-tldr .term'); if (term) { row.scrollIntoView({ block: 'start' }); return row.dataset.key; }
      }
      scrollBy(0, innerHeight * 0.8); return null;
    });
    await f.waitForTimeout(250);
  }
  ok(!!t, 'a feed bill summary has a tappable term: ' + t);
  await f.waitForTimeout(400);
  const row = t && f.locator(`.feed-row[data-key="${t}"]`);
  if (t) {
    await row.locator('.fc-more').click(); await f.waitForTimeout(300);
    const term = row.locator('.fc-tldr .term').first(); await term.scrollIntoViewIfNeeded();
    await term.tap(); await f.waitForTimeout(250);
    const pop = await f.evaluate(() => { const p = document.querySelector('.term-pop'); const r = p?.getBoundingClientRect(); return p && { text: p.textContent, inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight }; });
    const sr = await f.evaluate(() => document.getElementById('term-live')?.textContent ?? '');
    ok(!!pop && pop.inView && /Source:/.test(pop.text), 'tap opens the definition on screen, with its source');
    ok(sr.length > 30 && /Source:/.test(sr) && await term.getAttribute('aria-expanded') === 'true', 'the definition is in a live region for screen readers, and the button says it is expanded');
    await f.mouse.click(5, 300); await f.waitForTimeout(200);
    ok(await f.locator('.term-pop').count() === 0 && (await f.evaluate(() => document.getElementById('term-live')?.textContent ?? '')) === '', 'tapping elsewhere closes it');
  }

  // 3. Keyboard (desktop): focus alone doesn't open; Enter opens; Escape closes and keeps focus.
  const k = await open('level-7', 'level-7', 6, { viewport: { width: 1280, height: 900 } });
  let has = false;
  for (let s = 0; s < 6 && !has; s++) { await k.evaluate((s) => document.querySelectorAll('.steptrack-seg')[s]?.click(), s); await k.waitForTimeout(350); has = await k.locator('main .term').count() > 0; }
  if (has) {
    await k.locator('main .term').first().focus(); await k.waitForTimeout(150);
    const onFocus = await k.locator('.term-pop').count();
    await k.keyboard.press('Enter'); await k.waitForTimeout(150); const onEnter = await k.locator('.term-pop').count();
    await k.keyboard.press('Escape'); await k.waitForTimeout(150);
    ok(onFocus === 0 && onEnter === 1 && await k.locator('.term-pop').count() === 0 && await k.evaluate(() => document.activeElement?.classList.contains('term')), 'keyboard: Enter opens, Escape closes, focus stays on the term');
  } else ok(false, 'keyboard: found a term in mission 2.3');

  // 4. Desk cards (1.9): the summary inside a card is linked too.
  const d = await open('level-5');
  ok(await d.evaluate(() => document.querySelectorAll('.pcard-more .term').length) > 0, 'desk cards: terms in the card details are tappable');
  ok(await d.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll on the desk');

  ok(!errs.length, 'no page errors or React warnings' + (errs.length ? ': ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''));
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
})();
