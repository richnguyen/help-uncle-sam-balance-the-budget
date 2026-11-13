const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['', 'm', 'duel', 'dock']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const winByHand = require('./winbyhand');
// Walks through the new sharing features in the dev build.
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:5173/';
const out = __OUT + '/';
const settings = { v: 2, settings: { voice: 'device', voiceV: 2, narration: false, freeRoam: true, haptics: false }, choices: { mix: 'even', goal: 'stabilize', 'option:cut-defense-budget': 'support' } };
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const mk = async (vp, init) => {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1 });
    if (init) await ctx.addInitScript((s) => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', JSON.stringify(s)); }, init);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/fiscaldata|ERR_FAILED|CORS/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
    return { ctx, p };
  };
  // 1. Player A finishes level 8 by hand (level 10 shares a duel instead) and gets a challenge link.
  const A = await mk({ width: 1280, height: 900 }, settings);
  await A.p.goto(base + '#level-8'); await A.p.waitForTimeout(800);
  console.log('A before the goal: hint buttons', await A.p.getByRole('button', { name: /hint/i }).count(), '| ready-made plans shown', await A.p.locator('#plans').count(), '| goal tip:', (await A.p.$$eval('.starpop-panel li, .checks li', (l) => l.map((x) => x.textContent)).catch(() => [])).join(' ').slice(0, 80));
  console.log('A met by hand:', await winByHand(A.p));
  const party = await A.p.locator('.celebrate').count();
  console.log('celebration shown:', party, '| send-challenge in card:', await A.p.locator('.celebrate').getByRole('button', { name: 'Send the challenge' }).count());
  await A.p.screenshot({ path: out + 'v-celebrate.png' });
  await A.p.keyboard.press('Escape'); await A.p.waitForTimeout(300);
  const plans = await A.p.evaluate(() => JSON.parse(localStorage.getItem('ftd:journey')).plans);
  console.log('saved plans:', JSON.stringify(plans).slice(0, 200));
  await A.p.fill('#ch-name', 'Ruth');
  const link = await A.p.locator('#challenge .social-link[data-net="whatsapp"]').getAttribute('href');
  const url = decodeURIComponent(link.replace('https://wa.me/?text=', '')).split(' ').pop();
  console.log('challenge link:', url);
  console.log('planforyou:', await A.p.locator('.planforyou h2').textContent());
  await A.p.locator('#challenge').screenshot({ path: out + 'v-challenge-share.png' });

  // 2. Player B opens the link fresh, takes the challenge, plays.
  const B = await mk({ width: 390, height: 844 }, null);
  await B.p.goto(url.replace('https://balancethebudget.us/', base).replace(/&s=[a-z]+/, '&s=wh'));
  await B.p.waitForTimeout(900);
  console.log('B url after load:', B.p.url());
  console.log('B plan title:', await B.p.locator('h1').textContent());
  await B.p.screenshot({ path: out + 'v-plan-phone.png', fullPage: true });
  await B.p.locator('button:visible', { hasText: 'Take the challenge' }).first().click();
  await B.p.waitForTimeout(900);
  console.log('B hash:', await B.p.evaluate(() => location.hash), '| banner:', await B.p.locator('.challenge-banner').count(), '| src:', await B.p.evaluate(() => localStorage.getItem('ftd:src')));
  // Play two cards, then the hint.
  const adds = B.p.locator('.pcard-add');
  await adds.nth(0).click(); await B.p.waitForTimeout(250);
  console.log('B coach after first card:', (await B.p.locator('.sam-strip .sr-only, .menu-sam-text').first().textContent()).slice(0, 140));
  console.log('B met by hand:', await winByHand(B.p));
  console.log('B pop-up after the goal (should be none):', await B.p.locator('.celebrate').count(), '| live panel:', (await B.p.locator('.challenge-live-title').textContent().catch(() => 'none')));
  console.log('B live rows:', (await B.p.$$eval('.challenge-live .h2h-table tbody tr', (r) => r.map((x) => x.innerText.replace(/\s+/g, ' ')))).join(' / '));
  console.log('B agree:', (await B.p.locator('.challenge-live .agree').first().textContent().catch(() => 'none')).slice(0, 160));
  await B.p.locator('.challenge-live').first().screenshot({ path: out + 'v-h2h-phone.png' });
  await B.p.getByRole('button', { name: 'I’m done' }).click(); await B.p.waitForTimeout(900);
  console.log('B ending buttons:', (await B.p.$$eval('.celebrate button, .celebrate a.btn', (els) => els.map((e) => e.textContent.trim()).filter(Boolean))).join(' · '));
  await B.p.screenshot({ path: out + 'v-b-celebrate-phone.png' });
  await B.p.keyboard.press('Escape'); await B.p.waitForTimeout(300);

  // 3. Player A's Budget Story and clip.
  await A.p.goto(base + '#story'); await A.p.waitForTimeout(1200);
  console.log('story cards:', await A.p.locator('.story-card img').count());
  const sizes = await A.p.$$eval('.story-card img', (imgs) => imgs.map((i) => `${i.naturalWidth}x${i.naturalHeight}`));
  console.log('card sizes:', sizes.join(' '));
  await A.p.screenshot({ path: out + 'v-story.png', fullPage: true });
  // Save each card image as a PNG for review.
  for (let i = 0; i < 6; i++) {
    const data = await A.p.evaluate(async (k) => {
      const img = document.querySelectorAll('.story-card img')[k];
      if (!img) return null;
      const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
      c.getContext('2d').drawImage(img, 0, 0, 1080, 1920);
      return c.toDataURL('image/png');
    }, i);
    if (data) require('fs').writeFileSync(out + `v-card-${i + 1}.png`, Buffer.from(data.split(',')[1], 'base64'));
  }
  const t0 = Date.now();
  await A.p.getByRole('button', { name: 'Make my clip' }).click();
  await A.p.waitForSelector('.clip-video', { timeout: 20000 }).catch(() => {});
  const v = await A.p.evaluate(async () => { const el = document.querySelector('.clip-video'); if (!el) return null; const r = await fetch(el.src); const bl = await r.blob(); return { size: bl.size, type: bl.type }; });
  console.log('clip:', JSON.stringify(v), 'in', ((Date.now() - t0) / 1000).toFixed(1), 's');
  await A.p.locator('#clip').screenshot({ path: out + 'v-clip.png' });

  // 4. Daily Dollar.
  const D = await mk({ width: 390, height: 844 }, settings);
  await D.p.goto(base + '?daily&s=x'); await D.p.waitForTimeout(800);
  console.log('daily hash:', await D.p.evaluate(() => location.hash), '| title:', await D.p.locator('h1').textContent());
  await D.p.screenshot({ path: out + 'v-daily-phone.png', fullPage: true });
  for (let k = 0; k < 5; k++) {
    await D.p.getByRole('button', { name: k % 2 ? '▼ Lower' : '▲ Higher' }).click();
    await D.p.waitForTimeout(150);
    if (k === 0) await D.p.screenshot({ path: out + 'v-daily-reveal-phone.png', fullPage: true });
    await D.p.locator('.daily-actions .btn-primary').click();
    await D.p.waitForTimeout(150);
  }
  console.log('daily result:', (await D.p.locator('.daily-done').textContent()).slice(0, 120));
  await D.p.screenshot({ path: out + 'v-daily-done-phone.png', fullPage: true });
  // Overflow check on the new pages at phone width.
  for (const r of ['daily', 'story', 'plan?' + url.split('?')[1]]) {
    await D.p.goto(base + '#' + r); await D.p.waitForTimeout(700);
    const o = await D.p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log('overflow', r.slice(0, 10), o);
  }
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  await b.close();
})();
