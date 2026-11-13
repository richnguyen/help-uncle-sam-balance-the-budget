// Visit every route at desktop and phone width; report console errors and horizontal overflow.
const { chromium } = require('playwright');
const ROUTES = ['journey', 'level-1', 'level-2', 'level-3', 'level-4', 'level-5', 'level-6', 'level-7', 'level-8', 'level-9', 'level-10', 'desk-hard', 'sandbox',
  'overview', 'spending', 'revenue', 'gap', 'debt', 'laws', 'process', 'state', 'state-ca', 'social-security', 'receipt', 'sandbox', 'glossary', 'sources'];
const base = process.argv[2] || 'http://localhost:5173/';
(async () => {
  const browser = await chromium.launch();
  for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const ctx = await browser.newContext({ viewport: vp });
    // Free roam so locked pages render their real content.
    await ctx.addInitScript(() => { try { localStorage.setItem('ftd:journey', JSON.stringify({ settings: { freeRoam: true, text: 'normal', theme: 'system', narration: true } })); } catch {} });
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
    for (const r of ROUTES) {
      errs.length = 0;
      await page.goto(base + '#' + r);
      await page.waitForTimeout(r === 'journey' ? 600 : 350);
      const ov = await page.evaluate(() => {
        const w = document.documentElement.clientWidth;
        const bad = [];
        for (const el of document.querySelectorAll('.main *')) {
          const b = el.getBoundingClientRect();
          if (b.right > w + 1 && b.width > 0 && getComputedStyle(el).position !== 'fixed') bad.push(el.tagName + '.' + (el.className?.baseVal ?? el.className) + ' ' + Math.round(b.right));
        }
        return { scroll: document.documentElement.scrollWidth > w, bad: bad.slice(0, 4) };
      });
      const steps = await page.locator('.steptrack-seg').count();
      if (errs.length || ov.scroll || ov.bad.length) console.log(vp.width, r, JSON.stringify({ errs: errs.slice(0, 3), ...ov }));
      else console.log(vp.width, r, 'ok', steps ? `${steps} steps` : '');
    }
    await ctx.close();
  }
  await browser.close();
})();
