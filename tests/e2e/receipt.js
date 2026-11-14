// The plan receipt, shared when a budget desk's goal is met: who and which mission, the stars, what
// was achieved, the plan style (🟩 gentle, 🟨 moderate, 🟥 steep, from the hit to the economy), the
// number of cards and the budget personality, how the savings split between spending cuts and
// taxes (five blocks each, only if the player keeps that switch on), the biggest moves by budget
// area, and a dare. What's shared is exactly what's shown; there's a matching 1200×630 image.
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const base = 'http://localhost:5173/';
(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, done: ['level-1'], settings: { freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false } })); localStorage.setItem('ftd:name', JSON.stringify('Ruth')); });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base + '#level-5'); await p.waitForSelector('.pcard'); await p.waitForTimeout(900);
  // Play cards until the goal is met (the celebration opens).
  for (let i = 0; i < 12 && !(await p.locator('.celebrate').count()); i++) {
    await p.evaluate(() => document.querySelector('.pcard .pcard-add:not(.on)')?.click()); await p.waitForTimeout(450);
  }
  await p.waitForSelector('.receipt-preview', { timeout: 8000 }).catch(() => {});
  const pre = p.locator('.receipt-preview');
  ok(await pre.count() === 1, 'meeting the goal shows the plan receipt, as it will be shared');
  const t = await pre.textContent();
  const L = t.split('\n');
  console.log(t);
  ok(/^🇺🇸 Ruth’s plan · Mission 1\.9 · [★☆]{3}$/u.test(L[0]) && /^I .+\.$/.test(L[1]), 'it opens with whose plan, the mission, the stars, and what was achieved');
  const cards = await p.locator('.pcard .pcard-add.on').count();
  ok(new RegExp(`^Plan style: (🟩 GENTLE|🟨 MODERATE|🟥 STEEP) · ${cards} cards? · The [A-Z][a-z]+( [A-Z][a-z]+)?$`, 'u').test(L[2]), `the plan style, the ${cards} cards played and the budget personality: ` + L[2]);
  const sp = L.find((l) => l.startsWith('✂️ Spending cuts ')), tx = L.find((l) => l.startsWith('💵 Taxes '));
  const blocks = (l, c) => [...(l ?? '').matchAll(new RegExp(c, 'gu'))].length;
  ok(sp && tx && blocks(sp, '🟩') + blocks(sp, '⬜') === 5 && blocks(tx, '🟦') + blocks(tx, '⬜') === 5 && blocks(sp, '🟩') + blocks(tx, '🟦') === 5, 'the split: five blocks each, the two adding up to the whole plan');
  ok(L.some((l) => /^🎯 Biggest moves: [A-Z][A-Za-z ]+( & [A-Z][A-Za-z ]+)?$/.test(l)), 'the biggest moves, by budget area');
  ok(/^Scored with CBO’s numbers\. Can you (do it more gently|get all three stars|do it with fewer than \d+ cards|match it)\? 👉$/.test(L.at(-1)), 'a dare at the end: ' + L.at(-1));
  ok(!/\b(liberal|conservative|democrat|republican|hike|pain|hurt|left|right-wing)\b/i.test(t), 'no party, ideology or blame words');
  // What goes out is what's shown.
  const xText = (await p.locator('.celebrate .social-link[data-net="x"]').getAttribute('href')).match(/text=([^&]*)/)[1];
  ok(decodeURIComponent(xText) === t, 'the post is exactly the receipt shown');
  await p.locator('.celebrate-share').first().screenshot({ path: __OUT + '/receipt-celebrate.png' });
  // The switch: without the split, the cuts-and-taxes lines go, and the choice is remembered.
  await p.locator('.receipt-mix input').uncheck(); await p.waitForTimeout(200);
  const t2 = await pre.textContent();
  ok(!/Spending cuts|💵 Taxes/.test(t2) && /Biggest moves/.test(t2) && await p.evaluate(() => localStorage.getItem('ftd:share-mix')) === 'false', 'switched off: no split lines (the rest stays), and the choice is remembered');
  ok(decodeURIComponent((await p.locator('.celebrate .social-link[data-net="x"]').getAttribute('href')).match(/text=([^&]*)/)[1]) === t2, 'and the post follows the switch');
  await p.locator('.receipt-mix input').check(); await p.waitForTimeout(200);
  // The image: a 1200×630 receipt.
  const img = await p.evaluate(async () => {
    const R = await import('/src/game/receipt.ts');
    const blob = await R.receiptCard({ mission: 'Mission 1.9', done: 'cut Uncle Sam’s deficit to 3% of GDP', stars: 3, cards: [{ lever: 'defense', side: 'spending', savings10: 900 }, { lever: 'medicare', side: 'spending', savings10: 400 }, { lever: 'revenues', side: 'revenue', savings10: 1300 }, { lever: 'revenues', side: 'revenue', savings10: 300 }], rating: 'moderate', personality: 'The Dealmaker', name: 'Ruth' }, true);
    const bmp = await createImageBitmap(blob);
    const fr = new FileReader(); const url = await new Promise((res) => { fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
    return { w: bmp.width, h: bmp.height, size: blob.size, url, text: R.receiptText({ mission: 'Mission 1.9', done: 'cut Uncle Sam’s deficit to 3% of GDP', stars: 3, cards: [{ lever: 'defense', side: 'spending', savings10: 900 }, { lever: 'medicare', side: 'spending', savings10: 400 }, { lever: 'revenues', side: 'revenue', savings10: 1300 }, { lever: 'revenues', side: 'revenue', savings10: 300 }], rating: 'moderate', personality: 'The Dealmaker', name: 'Ruth' }) };
  });
  require('fs').writeFileSync(__OUT + '/receipt-card.png', Buffer.from(img.url.split(',')[1], 'base64'));
  ok(img.w === 1200 && img.h === 630 && img.size > 10000, `the image is 1200×630 (${Math.round(img.size / 1024)} KB)`);
  ok(img.text.includes('Plan style: 🟨 MODERATE · 4 cards · The Dealmaker') && img.text.includes('✂️ Spending cuts 🟩🟩⬜⬜⬜') && img.text.includes('💵 Taxes 🟦🟦🟦⬜⬜') && img.text.includes('🎯 Biggest moves: Taxes & Defense') && img.text.includes('Can you do it more gently?'), 'a worked example: 1,300 of 2,900 from cuts is two blocks of five, taxes three; the biggest areas; a moderate plan is dared to go gentler');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: no sideways scroll');
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
