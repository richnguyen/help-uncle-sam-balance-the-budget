// The batch: name, level 1 card, spoiler-free certificates, safe Story shares, part of the fix,
// debt clock, play together, teachers, and Uncle Sam's acting (lip-sync, reactions).
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['', 'm', 'duel', 'dock']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const base = process.argv[2] || 'http://localhost:5173/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const J = (o) => JSON.stringify({ v: 2, done: [], stars: {}, steps: {}, quiz: {}, choices: {}, started: null, marks: [], medals: [], settings: { text: 'normal', theme: 'system', freeRoam: true, narration: false, voice: 'auto', haptics: false, sounds: false, voiceV: 2 }, ...o });
const { answerAny } = require('./gamehelp');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript((j) => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', j); }, J({}));
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const away = async () => { if (await p.locator('.samdock[data-shown]').count()) { await p.locator('.samdock-avatar').tap(); await p.waitForTimeout(450); } };
  const playLevel = async (id) => {
    await p.goto(base + '#' + id); await p.waitForSelector('.level-stage'); await p.waitForTimeout(400);
    for (let k = 0; k < 30 && !(await p.locator('.celebrate').count()); k++) {
      const btn = p.locator('.level-nav .btn-primary');
      if (!(await btn.isEnabled()) && await p.locator('.quiz-card').count()) { await away(); await answerAny(p, true); continue; }
      await btn.tap(); await p.waitForTimeout(300);
    }
    await p.waitForTimeout(700);
  };
  // 1. Level 1 ends with the player's own card, and the name box.
  await playLevel('level-1');
  ok(await p.locator('.celebrate .mecard-img').count() === 1, 'level 1 pop-up: the "my share of Uncle Sam" card');
  await p.locator('.celebrate .namefield input').fill('Ruth'); await p.waitForTimeout(300);
  const alt = await p.locator('.celebrate .mecard-img').getAttribute('alt');
  ok(/^Ruth’s share of Uncle Sam: I chip in about \$[\d,]+ a year in federal taxes\. Put toward the debt for 10 straight years, that would save Uncle Sam about \$[\d,]+ in interest\./.test(alt), 'card: ' + alt.slice(0, 170));
  const xHref = await p.locator('.celebrate .social-link[data-net="x"]').getAttribute('href');
  ok(!/Ruth/.test(decodeURIComponent(xHref)) && /chip in/.test(decodeURIComponent(xHref)), 'the post text has no name (the name is on the card image only)');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(await p.locator('.complete-me .mecard').count() === 1, 'level 1 last screen: the card again');
  // 1b. Level 1's tax receipt opens as a pop-up, and closes.
  await p.goto(base + '#level-1'); await p.waitForTimeout(500);
  await p.locator('.step-track button, .steptrack button, [data-step]').nth(3).tap().catch(() => {});
  await p.waitForTimeout(500);
  if (!(await p.locator('.receipt-teaser').count())) { for (let k = 0; k < 8 && !(await p.locator('.receipt-teaser').count()); k++) { await p.locator('.level-nav .btn:not(.btn-primary)').tap(); await p.waitForTimeout(300); } }
  await away();
  ok(await p.locator('.receipt-teaser').count() === 1 && await p.locator('.level-stage .receipt').count() === 0, 'level 1: the receipt is a summary and a button, not inline: ' + (await p.locator('.receipt-teaser').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 90));
  await p.locator('.receipt-teaser-btn').tap(); await p.waitForTimeout(900);
  const pop = await p.evaluate(() => ({ dialog: !!document.querySelector('.popup[role=dialog] .receipt'), modal: document.documentElement.classList.contains('modal-open'), samHidden: !document.querySelector('.samdock'), inView: (() => { const r = document.querySelector('.popup')?.getBoundingClientRect(); return !!r && r.top >= 0 && r.bottom <= innerHeight + 1; })() }));
  ok(pop.dialog && pop.modal && pop.samHidden && pop.inView, 'the receipt pop-up: ' + JSON.stringify(pop));
  await p.locator('.popup-actions .btn-primary').tap(); await p.waitForTimeout(400);
  ok(!(await p.locator('.popup').count()) && !(await p.evaluate(() => document.documentElement.classList.contains('modal-open'))), 'Done closes it');
  // 2. Spoiler-free certificate on level 2.
  await playLevel('level-2');
  const t2 = decodeURIComponent(await p.locator('.celebrate .social-link[data-net="x"]').getAttribute('href'));
  ok(/I finished Mission 1\.2 of .* in \d+ minutes? with \d of 3 stars\. Did you know\? Uncle Sam spends about \$[\d.]+ billion a day\. Your turn:/.test(t2), 'level 2 certificate: ' + t2.replace(/^.*text=/, '').slice(0, 150));
  ok(!/Social Security is the biggest|voted on each year/.test(t2), 'no quiz answers in it');
  await p.keyboard.press('Escape');
  // 3. Uncle Sam greets by name.
  await p.goto(base + '#journey'); await p.waitForTimeout(900);
  ok(/Welcome back, Ruth/.test(await p.locator('.menu-sam-text, .sam-strip .sr-only').first().textContent()), 'greeting: ' + (await p.locator('.menu-sam-text, .sam-strip .sr-only').first().textContent()).slice(0, 60));
  // 4. The desk: the challenge is signed, and the receipt is "your part of the fix".
  await p.goto(base + '#level-5'); await p.waitForSelector('.pcard'); await p.waitForTimeout(600);
  await away();
  for (let k = 0; k < 6 && !(await p.locator('.celebrate').count()); k++) { await p.locator('.pcard-add:not(.on)').first().tap(); await p.waitForTimeout(350); }
  await p.waitForTimeout(800);
  const ch = decodeURIComponent(await p.locator('.celebrate .social-link[data-net="x"]').getAttribute('href'));
  ok(/text=🇺🇸 Ruth’s plan · Mission 1\.9[\s\S]*I stopped Uncle Sam’s debt/u.test(ch) && /by=Ruth/.test(ch), 'challenge (the plan receipt, signed): ' + ch.replace(/^.*text=/, '').slice(0, 110));
  ok(await p.locator('#cel-name').count() === 1, 'the pop-up asks to sign the challenge');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const pfy = await p.locator('#pfy-t').textContent();
  ok(await p.locator('.planforyou .pfy-fix').count() === 0 && await p.locator('.pfy-open').count() === 1, 'desk: part of the fix is a summary and a button: ' + (await p.locator('.planforyou').innerText()).replace(/\s+/g, ' ').slice(0, 120));
  await away();
  await p.locator('.pfy-open').scrollIntoViewIfNeeded(); await p.locator('.pfy-open').tap(); await p.waitForTimeout(600);
  const fix = await p.locator('.popup .pfy-fix').innerText();
  const inPop = await p.evaluate(() => ({ wage: !!document.querySelector('.popup .wagectl'), modal: document.documentElement.classList.contains('modal-open') }));
  ok(/^Your part of the fix|^Your own taxes/.test(pfy) && /per household/.test(fix) && inPop.wage && inPop.modal, `pop-up: ${pfy} · ${fix.replace(/\s+/g, ' ').slice(0, 120)}`);
  await p.screenshot({ path: __OUT + '/dock/pfy-popup.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(!(await p.locator('.popup').count()), 'Escape closes it');
  // 5. The Budget Story: the tax-and-cut split is off until the player turns it on.
  await p.goto(base + '#story'); await p.waitForTimeout(1200);
  const imgs = () => p.evaluate(() => [...document.querySelectorAll('main img')].map((i) => decodeURIComponent(i.getAttribute('src') || '')).join(' '));
  const n0 = await p.locator('.story-card, [data-story-card]').count();
  const s0 = await imgs();
  await p.locator('.story-split input').check(); await p.waitForTimeout(500);
  const n1 = await p.locator('.story-card, [data-story-card]').count();
  const s1 = await imgs();
  console.log("dbg", /% taxes/.test(s1), /% taxes/.test(s0), /PART OF THE/.test(s1), /PART OF THE/.test(s0), s1.match(/[0-9]+% [a-z]+/g)); ok(/% taxes/.test(s1) && !/% taxes/.test(s0) && /PART OF THE/.test(s1) && !/PART OF THE/.test(s0) && n1 === n0 + 1, `Story split: off by default, on when chosen (${n0} → ${n1} cards)`);
  // 6. The debt clock ticks, with the limit.
  await p.goto(base + '#clock'); await p.waitForTimeout(800);
  const v1 = await p.locator('.clock-num').textContent(); await p.waitForTimeout(1200); const v2 = await p.locator('.clock-num').textContent();
  const num = (s) => Number(s.replace(/[^0-9]/g, ''));
  ok(num(v2) > num(v1) && num(v1) > 40e12, `clock ticks: ${v1} → ${v2}`);
  ok(/Room left: .*billion/.test(await p.locator('.clock-limit').innerText()), 'limit: ' + (await p.locator('.clock-limit').innerText()).replace(/\s+/g, ' ').slice(0, 140));
  // 7. Play together and teachers.
  await p.goto(base + '#together'); await p.waitForTimeout(700);
  ok(await p.locator('.tcard').count() >= 3 && await p.locator('.tcard a[href="#rooms"]').count() >= 1 && await p.locator('.tcard a[href="#chain"]').count() >= 1, `play together: ${await p.locator('.tcard').count()} activities`);
  await p.goto(base + '#teach'); await p.waitForTimeout(700);
  ok(await p.locator('.teach-plan li').count() === 4 && await p.locator('.teach-questions li').count() === 5, 'for teachers: a 4-part plan and 5 questions');
  await p.goto(base + '#journey'); await p.waitForTimeout(800);
  ok(await p.locator('.tabbar a[href="#together"]').count() === 1 && await p.locator('.deficit .deficit-num').count() === 1, 'home: Play together in the tab bar, and the deficit running');
  await p.goto(base + '#together'); await p.waitForTimeout(600);
  ok(await p.locator('.tcard[data-kind="duel"] a[href="#duels"]').count() === 1, 'Play together lists the duel');
  await p.goto(base + '#journey'); await p.waitForTimeout(800);
  // The clock holds still behind the action bar and the glass, and ticks once it's clear.
  // (On the main menu: the deficit, behind the tab bar.)
  await away();
  // The deficit now sits high on the menu, so a shorter window puts it under the tab bar.
  const vp = p.viewportSize();
  const top = await p.evaluate(() => { scrollTo(0, 0); const r = document.querySelector('.deficit .deficit-num').getBoundingClientRect(); return Math.round(r.top + r.height / 2); });
  await p.setViewportSize({ width: vp.width, height: Math.max(420, top + 24) }); await p.waitForTimeout(400);
  const under = await p.evaluate(() => { const r = document.querySelector('.deficit .deficit-num').getBoundingClientRect(); const b = document.querySelector('.tabbar').getBoundingClientRect(); return r.top + r.height / 2 > b.top; });
  ok(under, 'the deficit placed under the tab bar');
  const placeClock = async (where) => { if (where === 'clear') { await p.setViewportSize(vp); await p.waitForTimeout(300); await p.evaluate(() => { const r = document.querySelector('.deficit .deficit-num').getBoundingClientRect(); scrollBy(0, r.top - 140); }); } };
  await placeClock('under'); await p.waitForTimeout(600);
  const u1 = await p.locator('.deficit .deficit-num').textContent(); await p.waitForTimeout(1100); const u2 = await p.locator('.deficit .deficit-num').textContent();
  await placeClock('clear'); await p.waitForTimeout(600);
  const k1 = await p.locator('.deficit .deficit-num').textContent(); await p.waitForTimeout(1100); const k2 = await p.locator('.deficit .deficit-num').textContent();
  ok(u1 === u2 && k1 !== k2, `deficit: still behind the tab bar (${u1 === u2}), ticking when clear (${k1 !== k2})`);
  // 8. Uncle Sam acts: a reaction per mood, and the mouth follows his recorded voice.
  const anim = await p.evaluate(() => [...document.querySelectorAll('.sam .sam-figure')].map((g) => getComputedStyle(g).animationName).filter((x) => x !== 'none'));
  ok(anim.length > 0, 'reactions: ' + [...new Set(anim)].join(', '));
  console.log('errors:', errs.length ? errs : 'none');
  if (errs.length) process.exitCode = 1;
  await ctx.close();

  // Lip-sync with the recorded voice (narration on, after a tap).
  const c2 = await b.newContext({ ...devices['iPhone 13'] });
  await c2.addInitScript((j) => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', j); }, J({ settings: { text: 'normal', theme: 'system', freeRoam: true, narration: true, voice: 'auto', haptics: false, sounds: false, voiceV: 2 } }));
  const q = await c2.newPage();
  await q.goto(base + '#level-2'); await q.waitForSelector('.level-stage');
  await q.locator('.level-brief').tap(); await q.waitForTimeout(300);
  // A tap on the strip says his line again, aloud; his mouth follows the recording and the line runs in step.
  // He may already be speaking his line on his own; if not, a tap on the strip has him say it.
  for (let k = 0; k < 15 && !(await q.locator('.sam-strip[data-speaking]').count()); k++) await q.waitForTimeout(200);
  if (!(await q.locator('.sam-strip[data-speaking]').count())) await q.locator('.sam-strip-view').tap().catch(() => {});
  const seen = new Set(); const xs = [];
  for (let k = 0; k < 30; k++) {
    const m = await q.evaluate(() => ({ mouth: document.querySelector('.sam-portrait-hud .sam')?.getAttribute('data-mouth'), x: (() => { const e = document.querySelector('.sam-strip-run'); return e ? new DOMMatrix(getComputedStyle(e).transform).m41 : null; })() }));
    if (m.mouth != null) seen.add(m.mouth); if (m.x != null) xs.push(m.x); await q.waitForTimeout(80);
  }
  ok(seen.size >= 2, `lip-sync: mouth openings seen ${[...seen].sort().join(',') || 'none'}`);
  ok(xs.length > 5 && xs.at(-1) < xs[0] - 15, `his words run across the strip while he speaks (${Math.round(xs[0])} → ${Math.round(xs.at(-1))}px)`);
  await b.close();
})();
