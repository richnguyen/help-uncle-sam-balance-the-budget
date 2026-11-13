// Normal play on each budget-desk level: no hint, no ready-made plans until the goal is met, levers under the cards when cards can't win.
const { chromium, devices } = require('playwright');
const winByHand = require('./winbyhand');
const base = process.argv[2] || 'http://localhost:5173/';
(async () => {
  const b = await chromium.launch();
  for (const [lvl, phone] of [['level-5', false], ['level-8', false], ['level-10', false], ['level-10', true]]) {
    const ctx = await b.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript(() => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, settings: { voice: 'off', narration: false, freeRoam: true } })); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '#' + lvl); await p.waitForSelector('.pcard'); await p.waitForTimeout(600);
    const tag = `[${lvl}${phone ? ' phone' : ''}]`;
    const leversAfterDeck = await p.evaluate(() => { const d = document.getElementById('levers'); const deck = document.querySelector('.deck'); return !!d && d.open && deck.compareDocumentPosition(d) === Node.DOCUMENT_POSITION_FOLLOWING && !d.previousElementSibling?.matches('.card.more'); });
    console.log(tag, 'before: hint buttons (only level 5 has one)', await p.getByRole('button', { name: /hint/i }).count(), '| ready-made plans', await p.locator('#plans').count(), '| levers open right under the cards', leversAfterDeck);
    await p.locator('.pcard-add').last().click(); await p.waitForTimeout(300);
    await p.locator('.starpop-btn').hover(); await p.waitForTimeout(200);
    console.log(tag, 'goal tip:', (await p.locator('.starpop-panel li').first().textContent()).replace(/\s+/g, ' '));
    await p.mouse.move(5, 5);
    const met = await winByHand(p, { tap: false });
    const coach = (await p.locator('.sam-strip .sr-only, .menu-sam-text').first().textContent()).replace(/^Uncle Sam/, '').slice(0, 90);
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    console.log(tag, 'met by hand:', met, '| cards', await p.locator('.pcard-add.on').count(), '| taxes +', await p.locator('#lv-revenues').inputValue(), '% | coach:', coach);
    console.log(tag, 'after (should be 0): ready-made plans', await p.locator('#plans').count(), '| "Play this plan"', await p.getByRole('button', { name: /Play this plan/ }).count(), '| title:', await p.locator('#plans .section-title, #plans h2').first().textContent().catch(() => '-'));
    await p.reload(); await p.waitForSelector('.pcard'); await p.waitForTimeout(500);
    console.log(tag, 'coming back after finishing (should be 0): ready-made plans', await p.locator('#plans').count(), '| overflow', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), '| errors', errs.length ? errs : 'none');
    await ctx.close();
  }
  await b.close();
})().catch((e) => { console.log("FAILED:", e.message.split("\n")[0]); process.exit(1); });
