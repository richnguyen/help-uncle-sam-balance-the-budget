const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['', 'm', 'duel', 'dock']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium } = require('playwright');
const base = 'http://localhost:5173/';
const out = __OUT + '/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const person = async (vp) => {
    const ctx = await b.newContext({ viewport: vp });
    await ctx.addInitScript(() => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, settings: { narration: false, freeRoam: false, haptics: false } })); });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p;
  };
  const linkOf = async (p) => { const h = await p.locator('.chain-pass .social-link[data-net="whatsapp"]').getAttribute('href'); return decodeURIComponent(h.replace('https://wa.me/?text=', '')).split(' ').pop(); };
  // Person 1 starts a chain on level 5's goal.
  const A = await person({ width: 1280, height: 900 });
  await A.goto(base + '#chain'); await A.waitForTimeout(800);
  await A.selectOption('#chain-goal', '5');
  await A.fill('#chain-name', 'Ruth');
  await A.locator('.peoples-card', { hasText: 'Apply the Social Security tax to earnings above' }).getByRole('button', { name: 'Add it' }).click();
  await A.waitForTimeout(300);
  let link = await linkOf(A);
  console.log('after turn 1:', (await A.locator('.peoples-board .sb-big').textContent()), '| link:', link.replace('http://localhost:5173/', '/'));
  // Person 2 on a phone opens it, takes a card out (hijinks) and adds nothing else.
  const B = await person({ width: 390, height: 844 });
  await B.goto(link); await B.waitForTimeout(1200);
  console.log('B lands on:', (await B.evaluate(() => location.hash)).slice(0, 40), '| turns shown:', await B.locator('.chain-turns li').count(), '|', (await B.locator('.chain-turns li').first().textContent()));
  await B.fill('#chain-name', 'Sam');
  await B.locator('.peoples-card', { hasText: 'Apply the Social Security tax to earnings above' }).getByRole('button', { name: 'Take it out' }).click();
  await B.waitForTimeout(300);
  link = await linkOf(B);
  console.log('after turn 2:', (await B.locator('.peoples-board .sb-big').textContent()), '| link:', link.replace('http://localhost:5173/', '/'));
  console.log('B overflow:', await B.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  await B.screenshot({ path: out + 'chain-phone.png', fullPage: true });
  // Person 3 adds the big ones until the goal is met.
  let p = await person({ width: 1280, height: 900 });
  for (const card of ['Apply the Social Security tax to earnings above', 'Cut the Defense Department', 'Limit the tax savings from itemized']) {
    await p.goto(link); await p.waitForTimeout(900);
    if (!(await p.locator('#your-turn').count())) { console.log('the chain met its goal: no more turns'); break; }
    await p.locator('.peoples-card', { hasText: card }).getByRole('button', { name: 'Add it' }).click(); await p.waitForTimeout(300);
    link = await linkOf(p);
    console.log('turn added:', card.slice(0, 30), '->', (await p.locator('.peoples-board .sb-big').textContent()));
    p = await person({ width: 1280, height: 900 });
  }
  await p.goto(link); await p.waitForTimeout(900);
  console.log('final viewer:', (await p.locator('#turns .section-title').textContent()), '| sam:', (await p.locator('.sam-bubble, [class*="sam"] p').first().textContent().catch(() => '')).slice(0, 60));
  console.log('medal mark (A):', await A.evaluate(() => JSON.parse(localStorage.getItem('ftd:journey')).marks.includes('chain')));
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
