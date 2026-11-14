// Pass the budget, the viral parts: the message that passes the link (how far Uncle Sam still is
// from the goal, what you just did, whose turn is next, the 4-hour clock), a link-preview page
// that matches the chain's state (Waiting on Turn N, how far along), the turn clock on the page
// (and an overdue one), and the Budget Closer receipt that credits every hand, with its image.
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const fs = require('fs'), path = require('path');
const { chromium, devices } = require('playwright');
const base = 'http://localhost:5173/';
(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const person = async () => {
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    await ctx.addInitScript(() => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, settings: { narration: false, freeRoam: false, haptics: false, voice: 'off', sounds: false } })); });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p;
  };
  const sent = async (p) => { const h = decodeURIComponent(await p.locator('.chain-pass .social-link[data-net="x"]').getAttribute('href')); return { text: h.match(/text=([\s\S]*?)&url=/)[1], url: h.split('&url=')[1].replace(/&s=x$/, '').replace(/[?&]s=x(&|$)/, '$1') }; };
  const add = (p, name) => p.locator('.peoples-card', { hasText: name }).getByRole('button', { name: 'Add it' }).click();

  // Turn 1: Ruth cuts Defense.
  const A = await person();
  await A.goto(base + '#chain'); await A.waitForTimeout(800);
  await A.selectOption('#chain-goal', '5');
  await A.fill('#chain-name', 'Ruth');
  await add(A, 'Cut the Defense Department'); await A.waitForTimeout(300);
  let s = await sent(A);
  console.log(s.text);
  ok(/^Uncle Sam is still \$[\d.]+ (trillion|billion) short of the goal\. I just cut Defense\. Now it’s your turn \(Turn 2\) to make the hard call without wrecking the economy\. You’ve got 4 hours ⏳ Pass it on:$/.test(s.text), 'the pass message: the gap left, the move just made, Turn 2, and the 4-hour clock');
  ok(await A.locator('.chain-preview').textContent() === s.text, 'the message is shown before it goes out');
  ok(/\/p\/chain-t2-p\d+\/\?chain&g=5&t=[A-Za-z]&n=Ruth&w=[0-9a-z]+$/.test(s.url), 'the link goes through the preview for Turn 2 and carries the clock: ' + s.url.replace(base, '/'));
  const pv = s.url.match(/\/p\/(chain-t2-p\d+)\//)[1];
  const html = fs.readFileSync(path.join(__dirname, '../../public/p', pv, 'index.html'), 'utf8');
  ok(html.includes('Waiting on Turn 2') && html.includes(`p/img/${pv}.jpg`) && fs.existsSync(path.join(__dirname, '../../public/p/img', pv + '.jpg')), 'its preview page says "Waiting on Turn 2" with a matching image');

  // Turn 2: Sam opens the link: the clock says it's their turn.
  const B = await person();
  await B.goto(s.url); await B.waitForTimeout(1300);
  ok(/Waiting on Turn 2: that’s you\./.test(await B.locator('.chain-clock').textContent()) && /left on the 4-hour clock/.test(await B.locator('.chain-clock').textContent()), 'the next person sees the turn clock: ' + (await B.locator('.chain-clock').textContent()).trim());
  ok(/cut Defense/.test(await B.locator('.chain-turns li').first().textContent()), 'and what Ruth did, in plain words');
  // An overdue clock: a link passed five hours ago.
  const late = s.url.replace(/w=[0-9a-z]+$/, 'w=' + Math.floor((Date.now() - 5 * 3600e3) / 60000).toString(36));
  const L = await person(); await L.goto(late); await L.waitForTimeout(1200);
  ok(await L.locator('.chain-clock[data-late]').count() === 1 && /over the 4-hour clock\. The group is waiting!/.test(await L.locator('.chain-clock').textContent()), 'an overdue turn says so: ' + (await L.locator('.chain-clock').textContent()).trim());
  await B.fill('#chain-name', 'Sam');
  await add(B, 'Raise taxes on beer, wine, and liquor'); await B.waitForTimeout(300);
  s = await sent(B);
  ok(/I just raised alcohol taxes\..*\(Turn 3\)/.test(s.text) && /\/p\/chain-t3-p\d+\//.test(s.url), 'Turn 2’s message and preview: Turn 3 next');

  // Then big cards, one turn each, until a move meets the goal: Ana's.
  let C;
  for (const card of ['Apply the Social Security tax to earnings above', 'Create a 5 percent value-added tax']) {
    C = await person();
    await C.goto(s.url); await C.waitForTimeout(1100);
    await C.fill('#chain-name', 'Ana');
    await add(C, card); await C.waitForTimeout(400);
    if (await C.locator('.chain-closer').count()) break;
    s = await sent(C);
  }
  const closer = C.locator('.chain-closer');
  ok(await closer.count() === 1, 'the move that meets the goal shows the Budget Closer receipt');
  const hands = await closer.locator('.chain-hands li').evaluateAll((l) => l.map((x) => x.textContent));
  console.log(hands.join(' → '));
  ok(hands[0] === 'RuthCut' && hands[1] === 'SamTaxed' && /^AnaClosed the deal!$/.test(hands.at(-1)) && /You closed the deal!/.test(await closer.locator('h2').textContent()), 'every hand in order, with its kind of move, the last one closing the deal');
  s = await sent(C);
  ok(/^🏆 Budget closed! Our chain managed to stop Uncle Sam’s debt from outgrowing the economy in 3 turns, and Ana made the move that did it\. Ruth \(Cut\) → Sam \(Taxed\) → Ana \(Closed the deal!\)\. Everyone gets credit:$/.test(s.text) && /\/p\/chain-done\//.test(s.url), 'the closer’s message credits everyone and links the “Budget closed!” preview');
  ok(await C.evaluate(() => JSON.parse(localStorage.getItem('ftd:journey')).marks.includes('closer')), 'the closer earns the Budget closer medal');
  const img = await C.evaluate(async (turns) => { const K = await import('/src/game/chainKit.ts'); const blob = await K.closerCard(turns, 'balance Uncle Sam’s budget', {}); const bm = await createImageBitmap(blob); const fr = new FileReader(); const url = await new Promise((r) => { fr.onload = () => r(fr.result); fr.readAsDataURL(blob); }); return { w: bm.width, h: bm.height, url }; }, Array.from({ length: 11 }, (_, i) => ({ card: i % 2 ? 'vat-5pct' : 'cut-defense-budget', add: true, by: i === 3 ? '' : ['Ruth', 'Sam', 'Ana', '', 'Lee', 'Max', 'Kim', 'Jo', 'Bo', 'Ty', 'Al'][i] })));
  fs.writeFileSync(__OUT + '/chain-closer.png', Buffer.from(img.url.split(',')[1], 'base64'));
  ok(img.w === 1200 && img.h > 630, `a long chain's Closer image grows to fit everyone (${img.w}×${img.h})`);
  await closer.screenshot({ path: __OUT + '/chain-closer-page.png' });
  ok(await C.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: no sideways scroll');
  // Someone earlier in the chain opens the finished link: the receipt, credited, with a way to share it back.
  const R = await person(); await R.goto(s.url); await R.waitForTimeout(1300);
  ok(await R.locator('.chain-closer').count() === 1 && /Ana closed the deal!/.test(await R.locator('.chain-closer h2').textContent()) && await R.locator('.chain-closer button', { hasText: 'Share the finished chain' }).count() === 1, 'opening the finished chain: the receipt, crediting the closer, with “Share the finished chain”');
  ok(await R.locator('#your-turn').count() === 0 && /This chain met its goal/.test(await R.locator('.callout').last().textContent()), 'and no more turns: a finished chain points to a new one');
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
